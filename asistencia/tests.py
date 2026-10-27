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

    def test_primer_escaneo_entrada_y_segundo_salida(self):
        reg = self.trab.escanear_codigo_qr(self.qr.token)
        self.assertIsNotNone(reg.hora_entrada)
        self.assertIsNone(reg.hora_salida)
        reg.hora_entrada = timezone.now() - timedelta(hours=8)
        reg.save()
        reg = self.trab.escanear_codigo_qr(self.qr.token)
        self.assertEqual(reg.estado, RegistroDeAsistencia.Estado.COMPLETA)
        self.assertAlmostEqual(reg.horas_trabajadas, 8, delta=0.05)

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
