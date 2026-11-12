"""Pruebas de la tarea 2.4: administración de especialistas por local."""
from datetime import datetime, time, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Servicio
from locales.models import Local
from reservas.forms_especialistas import EspecialistaForm
from reservas.models import Cliente, Reserva
from usuarios.models import Usuario

CLAVE = "Clave-de-prueba-1"


def manana(hora):
    dia = timezone.localdate() + timedelta(days=1)
    return timezone.make_aware(datetime.combine(dia, time(hora)))


class EspecialistasTests(TestCase):
    def setUp(self):
        self.mall = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        self.centro = Local.objects.create(nombre="Local Centro", ubicacion="Centro de Calama")
        self.admin = Usuario.objects.create_user(username="admin@x.cl", email="admin@x.cl", password=CLAVE,
                                                 rol=Usuario.Rol.ADMINISTRADOR)
        self.paola = Usuario.objects.create_user(username="paola@x.cl", email="paola@x.cl", password=CLAVE,
                                                 rol=Usuario.Rol.RECEPCIONISTA, local=self.mall)
        self.camila = Usuario.objects.create_user(username="camila@x.cl", email="camila@x.cl", password=CLAVE,
                                                  first_name="Camila", last_name="Soto", rol=Usuario.Rol.TRABAJADOR,
                                                  local=self.mall, cargo=Usuario.Cargo.COSMETOLOGA)
        self.liz = Usuario.objects.create_user(username="liz@x.cl", email="liz@x.cl", password=CLAVE,
                                               first_name="Liz", last_name="Díaz", rol=Usuario.Rol.TRABAJADOR,
                                               local=self.centro, cargo=Usuario.Cargo.DEPILADORA)
        self.lifting = Servicio.objects.create(nombre="Lifting", precio=25000, tipo=Servicio.Tipo.LIFTING, duracion=60)
        self.client.login(email="admin@x.cl", password=CLAVE)

    def datos(self, **cambios):
        d = {"first_name": "Fernanda", "last_name": "Rojas", "email": "fernanda@x.cl", "local": self.mall.pk,
             "cargo": Usuario.Cargo.MANICURISTA, "porcentaje_comision": "10", "clave": "Una-clave-segura-26"}
        d.update(cambios)
        return d

    def reserva_futura(self, especialista):
        cliente = Cliente.objects.create(nombre="Ana", telefono="900000001", consentimiento=True)
        return Reserva.objects.create(local=especialista.local, cliente=cliente, especialista=especialista,
                                      servicio=self.lifting, inicio=manana(10))

    # ---- acceso
    def test_la_recepcionista_no_entra(self):
        self.client.login(email="paola@x.cl", password=CLAVE)
        self.assertEqual(self.client.get(reverse("reservas:especialistas")).status_code, 403)

    def test_la_lista_muestra_solo_especialistas_y_filtra_por_local(self):
        r = self.client.get(reverse("reservas:especialistas"), {"local": self.mall.pk})
        self.assertContains(r, "Camila Soto")
        self.assertNotContains(r, "Liz Díaz")          # es de otro local
        self.assertNotContains(r, "paola@x.cl")        # es recepcionista, no especialista

    # ---- crear
    def test_crea_una_especialista_con_rol_trabajador_y_su_clave(self):
        r = self.client.post(reverse("reservas:nueva_especialista"), self.datos())
        self.assertRedirects(r, reverse("reservas:especialistas"))
        f = Usuario.objects.get(email="fernanda@x.cl")
        self.assertEqual(f.rol, Usuario.Rol.TRABAJADOR)
        self.assertEqual(f.username, "fernanda@x.cl")
        self.assertTrue(f.check_password("Una-clave-segura-26"))

    def test_local_y_cargo_son_obligatorios(self):
        form = EspecialistaForm(self.datos(local="", cargo=""))
        self.assertFalse(form.is_valid())
        self.assertIn("local", form.errors)
        self.assertIn("cargo", form.errors)

    def test_rechaza_una_clave_debil(self):
        form = EspecialistaForm(self.datos(clave="123"))
        self.assertFalse(form.is_valid())
        self.assertIn("clave", form.errors)

    def test_rechaza_un_correo_repetido(self):
        form = EspecialistaForm(self.datos(email="camila@x.cl"))
        self.assertFalse(form.is_valid())
        self.assertIn("email", form.errors)

    def test_la_comision_no_puede_pasar_de_100(self):
        form = EspecialistaForm(self.datos(porcentaje_comision="120"))
        self.assertFalse(form.is_valid())
        self.assertIn("porcentaje_comision", form.errors)

    # ---- editar
    def test_edita_cargo_y_comision(self):
        url = reverse("reservas:editar_especialista", args=[self.camila.pk])
        self.client.post(url, self.datos(first_name="Camila", last_name="Soto", email="camila@x.cl",
                                         cargo=Usuario.Cargo.MASOTERAPEUTA, porcentaje_comision="15"))
        self.camila.refresh_from_db()
        self.assertEqual(self.camila.cargo, Usuario.Cargo.MASOTERAPEUTA)
        self.assertEqual(self.camila.porcentaje_comision, 15)

    def test_no_cambia_de_local_si_tiene_reservas_futuras(self):
        self.reserva_futura(self.camila)
        form = EspecialistaForm(self.datos(email="camila@x.cl", local=self.centro.pk), instance=self.camila)
        self.assertFalse(form.is_valid())
        self.assertIn("local", form.errors)

    def test_no_edita_a_una_recepcionista(self):
        r = self.client.get(reverse("reservas:editar_especialista", args=[self.paola.pk]))
        self.assertEqual(r.status_code, 404)

    # ---- desactivar y activar
    def test_desactivar_la_saca_de_la_agenda_de_nuevas_reservas(self):
        self.client.post(reverse("reservas:estado_especialista", args=[self.camila.pk]))
        self.camila.refresh_from_db()
        self.assertFalse(self.camila.is_active)
        self.client.login(email="paola@x.cl", password=CLAVE)
        r = self.client.get(reverse("reservas:nueva"))
        self.assertNotIn(self.camila, r.context["form"].fields["especialista"].queryset)

    def test_no_desactiva_si_tiene_reservas_futuras(self):
        self.reserva_futura(self.camila)
        self.client.post(reverse("reservas:estado_especialista", args=[self.camila.pk]))
        self.camila.refresh_from_db()
        self.assertTrue(self.camila.is_active)

    def test_se_puede_volver_a_activar(self):
        self.camila.is_active = False
        self.camila.save()
        self.client.post(reverse("reservas:estado_especialista", args=[self.camila.pk]))
        self.camila.refresh_from_db()
        self.assertTrue(self.camila.is_active)

    def test_cambiar_estado_solo_por_post(self):
        r = self.client.get(reverse("reservas:estado_especialista", args=[self.camila.pk]))
        self.assertEqual(r.status_code, 405)