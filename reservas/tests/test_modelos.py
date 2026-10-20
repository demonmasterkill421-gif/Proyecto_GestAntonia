"""
Pruebas de la tarea 1.1 (modelos) y 1.2 (agenda del día) · Edson.

Comprueban que la regla «cero topes» la protege la base de datos (objetivo específico 3, OWASP A06)
y que cada recepcionista ve solo la agenda de su local (RF-22).
"""
from datetime import datetime, time, timedelta
from unittest import skipUnless

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Servicio
from locales.models import Local
from reservas.models import Clienta, Reserva
from usuarios.models import Usuario

CLAVE = "Clave-de-prueba-1"


def manana_a_las(hora, minuto=0):
    fecha = timezone.localdate() + timedelta(days=1)
    return timezone.make_aware(datetime.combine(fecha, time(hora, minuto)))


class BaseReservas(TestCase):
    def setUp(self):
        self.mall = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        self.centro = Local.objects.create(nombre="Local Centro", ubicacion="Centro de Calama")
        self.lifting = Servicio.objects.create(nombre="Lifting de pestañas", precio=25000,
                                               tipo=Servicio.Tipo.LIFTING, duracion=60)
        self.camila = Usuario.objects.create_user(username="camila", email="camila@x.cl", password=CLAVE,
                                                  first_name="Camila", rol=Usuario.Rol.TRABAJADOR, local=self.mall)
        self.liz = Usuario.objects.create_user(username="liz", email="liz@x.cl", password=CLAVE,
                                               first_name="Liz", rol=Usuario.Rol.TRABAJADOR, local=self.centro)
        self.paola = Usuario.objects.create_user(username="paola", email="paola@x.cl", password=CLAVE,
                                                 rol=Usuario.Rol.RECEPCIONISTA, local=self.mall)
        self.maria = Clienta.objects.create(nombre="María González", telefono="+56 9 8765 4321", consentimiento=True)

    def reservar(self, especialista, inicio, local=None, clienta=None):
        return Reserva.objects.create(local=local or especialista.local, clienta=clienta or self.maria,
                                      especialista=especialista, servicio=self.lifting, inicio=inicio)


class ModelosTests(BaseReservas):
    def test_telefono_se_normaliza_a_9_digitos(self):
        self.assertEqual(self.maria.telefono, "987654321")

    def test_telefono_no_se_repite(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Clienta.objects.create(nombre="Otra", telefono="9 8765 4321")

    def test_fin_se_calcula_con_la_duracion_del_servicio(self):
        r = self.reservar(self.camila, manana_a_las(11))
        self.assertEqual(r.fin, manana_a_las(12))

    @skipUnless(connection.vendor == "postgresql", "La restricción de exclusión solo existe en PostgreSQL")
    def test_la_base_rechaza_dos_reservas_que_se_topan(self):
        """Objetivo 3: aunque dos recepcionistas guarden a la vez, PostgreSQL acepta solo una."""
        self.reservar(self.camila, manana_a_las(11))
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.reservar(self.camila, manana_a_las(11, 30))

    def test_bloques_seguidos_no_son_tope(self):
        """El intervalo es [inicio, fin): terminar a las 12:00 y empezar a las 12:00 está permitido."""
        self.reservar(self.camila, manana_a_las(11))
        self.reservar(self.camila, manana_a_las(12))
        self.assertEqual(Reserva.objects.count(), 2)

    def test_otra_especialista_puede_tener_el_mismo_horario(self):
        self.reservar(self.camila, manana_a_las(11))
        self.reservar(self.liz, manana_a_las(11))
        self.assertEqual(Reserva.objects.count(), 2)

    def test_cancelar_libera_el_bloque(self):
        r = self.reservar(self.camila, manana_a_las(11))
        r.cancelar("La clienta avisó que no puede asistir")
        self.reservar(self.camila, manana_a_las(11))
        self.assertEqual(Reserva.objects.activas().count(), 1)

    def test_cancelar_exige_motivo(self):
        r = self.reservar(self.camila, manana_a_las(11))
        with self.assertRaises(ValidationError):
            r.cancelar("   ")

    def test_especialista_de_otro_local_no_es_valida(self):
        r = Reserva(local=self.mall, clienta=self.maria, especialista=self.liz, servicio=self.lifting,
                    inicio=manana_a_las(11))
        with self.assertRaises(ValidationError):
            r.full_clean()

    def test_validacion_del_formulario_detecta_el_tope(self):
        """full_clean() (lo que usan el admin y los formularios) avisa el tope antes de llegar a la base."""
        self.reservar(self.camila, manana_a_las(11))
        r = Reserva(local=self.mall, clienta=self.maria, especialista=self.camila, servicio=self.lifting,
                    inicio=manana_a_las(11, 30))
        with self.assertRaises(ValidationError):
            r.full_clean()


class AgendaTests(BaseReservas):
    def test_recepcionista_ve_solo_las_reservas_de_su_local(self):
        mia = self.reservar(self.camila, manana_a_las(11))
        ajena = self.reservar(self.liz, manana_a_las(15), clienta=Clienta.objects.create(
            nombre="Clienta Centro", telefono="912345678"))
        self.client.login(email="paola@x.cl", password=CLAVE)
        fecha = mia.inicio.astimezone(timezone.get_current_timezone()).date().isoformat()
        r = self.client.get(reverse("reservas:agenda"), {"fecha": fecha, "local": self.centro.pk})
        self.assertEqual(r.status_code, 200)
        self.assertContains(r, "María González")
        self.assertNotContains(r, ajena.clienta.nombre)

    def test_las_canceladas_no_aparecen_en_la_agenda(self):
        r = self.reservar(self.camila, manana_a_las(11))
        r.cancelar("Reagendó por teléfono")
        self.client.login(email="paola@x.cl", password=CLAVE)
        resp = self.client.get(reverse("reservas:agenda"), {"fecha": (timezone.localdate() + timedelta(days=1)).isoformat()})
        self.assertNotContains(resp, "María González")

    def test_trabajadora_no_entra_a_la_agenda(self):
        self.client.login(email="camila@x.cl", password=CLAVE)
        self.assertEqual(self.client.get(reverse("reservas:agenda")).status_code, 403)

    def test_sin_sesion_redirige_al_login(self):
        r = self.client.get(reverse("reservas:agenda"))
        self.assertEqual(r.status_code, 302)
        self.assertIn(reverse("usuarios:login"), r.url)

    def test_administradora_elige_el_local(self):
        Usuario.objects.create_superuser(username="admin", email="admin@x.cl", password=CLAVE)
        self.reservar(self.liz, manana_a_las(15))
        self.client.login(email="admin@x.cl", password=CLAVE)
        r = self.client.get(reverse("reservas:agenda"), {
            "local": self.centro.pk, "fecha": (timezone.localdate() + timedelta(days=1)).isoformat()})
        self.assertContains(r, "Liz")
        self.assertContains(r, "María González")
