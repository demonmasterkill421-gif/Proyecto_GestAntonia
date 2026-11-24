from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from asistencia.models import CodigoQR, RegistroDeAsistencia
from locales.models import Local
from usuarios.models import Trabajador, Usuario


class AsistenciaQRTests(TestCase):
    """Pruebas del CU-02 Registrar asistencia (RF-A07, RF-A10, RF-T01)."""

    def setUp(self):
        self.local = Local.objects.create(nombre="Local Centro 1", ubicacion="Centro")
        self.otro = Local.objects.create(nombre="Local Centro 2", ubicacion="Centro")
        self.admin = Usuario.objects.create_superuser(username="admin", email="admin@x.cl", password="Clave12345!")
        self.trab = Trabajador.objects.create_user(username="liz", email="liz@x.cl", password="Clave12345!",
                                                   rol=Usuario.Rol.TRABAJADOR, local=self.local)
        self.qr = CodigoQR.generar(self.local, self.admin)

    def test_cuatro_escaneos_con_colacion_y_descuento_horas(self):
        # 1. Entrada
        reg = self.trab.escanear_codigo_qr(self.qr.token)
        self.assertIsNotNone(reg.hora_entrada)
        self.assertEqual(reg.estado, RegistroDeAsistencia.Estado.EN_JORNADA)
        self.assertIsNone(reg.inicio_colacion)
        self.assertIsNone(reg.hora_salida)

        # 2. Salida a colación (después de 4 horas)
        reg.hora_entrada = timezone.now() - timedelta(hours=4)
        reg.save()
        reg = self.trab.escanear_codigo_qr(self.qr.token)
        self.assertIsNotNone(reg.inicio_colacion)
        self.assertEqual(reg.estado, RegistroDeAsistencia.Estado.EN_COLACION)

        # 3. Regreso de colación / 2° turno (1 hora de colación)
        ahora = timezone.now()
        reg.hora_entrada = ahora - timedelta(hours=5)
        reg.inicio_colacion = ahora - timedelta(hours=1)
        reg.save()
        reg = self.trab.escanear_codigo_qr(self.qr.token)
        self.assertIsNotNone(reg.fin_colacion)
        self.assertEqual(reg.estado, RegistroDeAsistencia.Estado.EN_JORNADA)

        # 4. Salida definitiva (9 horas totales - 1 hora de colación = 8 horas trabajadas)
        ahora = timezone.now()
        reg.hora_entrada = ahora - timedelta(hours=9)
        reg.inicio_colacion = ahora - timedelta(hours=5)
        reg.fin_colacion = ahora - timedelta(hours=4)
        reg.save()
        reg = self.trab.escanear_codigo_qr(self.qr.token)
        self.assertIsNotNone(reg.hora_salida)
        self.assertEqual(reg.estado, RegistroDeAsistencia.Estado.COMPLETA)
        self.assertAlmostEqual(reg.horas_trabajadas, 8, delta=0.05)

    def test_rechaza_escaneo_antes_de_cinco_minutos(self):
        self.trab.escanear_codigo_qr(self.qr.token)
        with self.assertRaises(ValidationError):
            self.trab.escanear_codigo_qr(self.qr.token)

    def test_qr_vencido_es_rechazado(self):
        self.qr.vigente_hasta = timezone.now() - timedelta(minutes=1)
        self.qr.save()
        with self.assertRaises(ValidationError):
            self.trab.escanear_codigo_qr(self.qr.token)

    def test_qr_de_otro_local_es_rechazado(self):
        qr_otro = CodigoQR.generar(self.otro, self.admin)
        with self.assertRaises(ValidationError):
            self.trab.escanear_codigo_qr(qr_otro.token)

    def test_correccion_exige_motivo(self):
        reg = self.trab.escanear_codigo_qr(self.qr.token)
        with self.assertRaises(ValidationError):
            reg.corregir(self.admin, motivo="  ")
        reg.corregir(self.admin, motivo="Olvidó marcar la salida",
                     hora_salida=reg.hora_entrada + timedelta(hours=9))
        self.assertEqual(reg.estado, RegistroDeAsistencia.Estado.CORREGIDA)
        self.assertEqual(reg.corregido_por, self.admin)


class ExportarAsistenciaPdfTests(TestCase):
    """La asistencia del período también se descarga en PDF (?formato=pdf)."""

    def setUp(self):
        from datetime import datetime, time
        from django.utils import timezone as tz
        from locales.models import Local
        from usuarios.models import Usuario
        self.local = Local.objects.create(nombre="Local Centro", ubicacion="Calama")
        self.admin = Usuario.objects.create_user(username="a@x.cl", email="a@x.cl", password="ClaveSegura2026!",
                                                 rol=Usuario.Rol.ADMINISTRADOR)
        trab = Usuario.objects.create_user(username="t@x.cl", email="t@x.cl", password="ClaveSegura2026!",
                                           first_name="Camila", rol=Usuario.Rol.TRABAJADOR, local=self.local)
        hoy = tz.localdate()
        RegistroDeAsistencia.objects.create(
            trabajador=trab, local=self.local, fecha=hoy,
            hora_entrada=tz.make_aware(datetime.combine(hoy, time(9, 0))),
            hora_salida=tz.make_aware(datetime.combine(hoy, time(18, 30))),
            estado=RegistroDeAsistencia.Estado.COMPLETA)
        self.params = {"local": self.local.pk, "desde": hoy.isoformat(), "hasta": hoy.isoformat()}

    def test_pdf_y_excel(self):
        from rest_framework.test import APIClient
        api = APIClient()
        api.force_authenticate(self.admin)
        r = api.get("/api/asistencias/exportar/", {**self.params, "formato": "pdf"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertTrue(r.content.startswith(b"%PDF"))
        self.assertIn(".pdf", r["Content-Disposition"])
        r = api.get("/api/asistencias/exportar/", self.params)
        self.assertIn("spreadsheetml", r["Content-Type"])