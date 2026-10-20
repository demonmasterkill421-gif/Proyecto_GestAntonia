"""Pruebas de la versión inicial del módulo de Reservas (tareas 1.1 y 1.2)."""
from datetime import datetime, time, timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Servicio
from locales.models import Local
from reservas.models import Clienta, Reserva
from usuarios.models import Usuario

CLAVE = "Clave-de-prueba-1"


def manana(hora, minuto=0):
    dia = timezone.localdate() + timedelta(days=1)
    return timezone.make_aware(datetime.combine(dia, time(hora, minuto)))


class ReservasTests(TestCase):
    def setUp(self):
        self.mall = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        self.centro = Local.objects.create(nombre="Local Centro", ubicacion="Centro de Calama")
        self.lifting = Servicio.objects.create(nombre="Lifting", precio=25000, tipo=Servicio.Tipo.LIFTING, duracion=60)
        self.camila = Usuario.objects.create_user(username="camila", email="camila@x.cl", password=CLAVE,
                                                  first_name="Camila", rol=Usuario.Rol.TRABAJADOR, local=self.mall)
        self.liz = Usuario.objects.create_user(username="liz", email="liz@x.cl", password=CLAVE,
                                               first_name="Liz", rol=Usuario.Rol.TRABAJADOR, local=self.centro)
        Usuario.objects.create_user(username="paola", email="paola@x.cl", password=CLAVE,
                                    rol=Usuario.Rol.RECEPCIONISTA, local=self.mall)
        self.maria = Clienta.objects.create(nombre="María González", telefono="987654321", consentimiento=True)

    def nueva(self, especialista, inicio):
        return Reserva(local=especialista.local, clienta=self.maria, especialista=especialista,
                       servicio=self.lifting, inicio=inicio)

    def test_fin_se_calcula_con_la_duracion_del_servicio(self):
        r = self.nueva(self.camila, manana(11)); r.save()
        self.assertEqual(r.fin, manana(12))

    def test_no_se_permite_un_tope_de_horario(self):
        self.nueva(self.camila, manana(11)).save()
        with self.assertRaises(ValidationError):
            self.nueva(self.camila, manana(11, 30)).full_clean()

    def test_bloques_seguidos_si_se_permiten(self):
        self.nueva(self.camila, manana(11)).save()
        self.nueva(self.camila, manana(12)).full_clean()   # 11:00–12:00 y 12:00–13:00 no chocan

    def test_cancelar_libera_el_bloque(self):
        r = self.nueva(self.camila, manana(11)); r.save()
        r.cancelar("La clienta no puede asistir")
        self.nueva(self.camila, manana(11)).full_clean()

    def test_recepcionista_ve_solo_su_local(self):
        self.nueva(self.camila, manana(11)).save()
        otra = Clienta.objects.create(nombre="Clienta Centro", telefono="912345678")
        Reserva.objects.create(local=self.centro, clienta=otra, especialista=self.liz,
                               servicio=self.lifting, inicio=manana(15))
        self.client.login(email="paola@x.cl", password=CLAVE)
        r = self.client.get(reverse("reservas:agenda"), {"fecha": manana(0).date().isoformat()})
        self.assertContains(r, "María González")
        self.assertNotContains(r, "Clienta Centro")

    def test_trabajadora_no_entra_a_la_agenda(self):
        self.client.login(email="camila@x.cl", password=CLAVE)
        self.assertEqual(self.client.get(reverse("reservas:agenda")).status_code, 403)
