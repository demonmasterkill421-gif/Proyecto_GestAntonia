"""Pruebas de «Nueva reserva» (tarea 1.3): guarda bien, rechaza un tope y la trabajadora recibe 403."""
from datetime import datetime, time, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Servicio
from locales.models import Local
from reservas.disponibilidad import horarios_libres_cercanos
from reservas.models import Clienta, Reserva
from usuarios.models import Usuario

CLAVE = "Clave-de-prueba-1"
URL = "reservas:nueva"


def manana(hora, minuto=0):
    dia = timezone.localdate() + timedelta(days=1)
    return timezone.make_aware(datetime.combine(dia, time(hora, minuto)))


def valor(dt):
    """Formato que envía <input type="datetime-local">."""
    return timezone.localtime(dt).strftime("%Y-%m-%dT%H:%M")


class NuevaReservaTests(TestCase):
    def setUp(self):
        self.mall = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        self.centro = Local.objects.create(nombre="Local Centro", ubicacion="Centro de Calama")
        self.lifting = Servicio.objects.create(nombre="Lifting", precio=25000, tipo=Servicio.Tipo.LIFTING, duracion=60)
        self.camila = Usuario.objects.create_user(username="camila", email="camila@x.cl", password=CLAVE,
                                                  first_name="Camila", rol=Usuario.Rol.TRABAJADOR, local=self.mall)
        self.liz = Usuario.objects.create_user(username="liz", email="liz@x.cl", password=CLAVE,
                                               first_name="Liz", rol=Usuario.Rol.TRABAJADOR, local=self.centro)
        self.paola = Usuario.objects.create_user(username="paola", email="paola@x.cl", password=CLAVE,
                                                 rol=Usuario.Rol.RECEPCIONISTA, local=self.mall)
        self.maria = Clienta.objects.create(nombre="María González", telefono="987654321", consentimiento=True)

    # utilidades
    def datos(self, especialista=None, inicio=None):
        return {
            "clienta": self.maria.pk,
            "especialista": (especialista or self.camila).pk,
            "servicio": self.lifting.pk,
            "inicio": valor(inicio or manana(11)),
        }

    def reservar(self, especialista, inicio):
        return Reserva.objects.create(local=especialista.local, clienta=self.maria, especialista=especialista,
                                      servicio=self.lifting, inicio=inicio)

    def entrar(self, usuario):
        self.client.login(email=usuario.email, password=CLAVE)

    # guarda bien
    def test_guarda_la_reserva_y_vuelve_a_la_agenda_con_la_fecha(self):
        self.entrar(self.paola)
        r = self.client.post(reverse(URL), self.datos())

        reserva = Reserva.objects.get()
        self.assertEqual(reserva.local, self.mall)            # el local sale de la sesión
        self.assertEqual(reserva.estado, Reserva.Estado.AGENDADA)
        self.assertEqual(reserva.fin, manana(12))
        self.assertRedirects(r, f"{reverse('reservas:agenda')}?fecha={manana(11).date().isoformat()}",
                             fetch_redirect_response=False)

    # rechaza un tope
    def test_rechaza_una_reserva_que_se_cruza_con_otra_de_la_especialista(self):
        self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        r = self.client.post(reverse(URL), self.datos(inicio=manana(11, 30)))

        self.assertEqual(r.status_code, 200)                   # vuelve a mostrar el formulario
        self.assertEqual(Reserva.objects.count(), 1)           # la segunda no se guardó
        self.assertTrue(r.context["form"].has_error("inicio"))
        self.assertContains(r, "ya tiene una reserva en ese horario")

    def test_un_bloque_seguido_si_se_guarda(self):
        self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        self.client.post(reverse(URL), self.datos(inicio=manana(12)))
        self.assertEqual(Reserva.objects.count(), 2)

    # la trabajadora recibe 403
    def test_trabajadora_recibe_403(self):
        self.entrar(self.camila)
        self.assertEqual(self.client.get(reverse(URL)).status_code, 403)
        self.assertEqual(self.client.post(reverse(URL), self.datos()).status_code, 403)
        self.assertEqual(Reserva.objects.count(), 0)

    #  otras reglas de la tarea
    def test_clienta_preseleccionada_desde_la_url(self):
        self.entrar(self.paola)
        r = self.client.get(reverse(URL), {"clienta": self.maria.pk})
        self.assertEqual(r.context["form"].initial["clienta"], self.maria.pk)

    def test_clienta_invalida_en_la_url_se_ignora(self):
        self.entrar(self.paola)
        r = self.client.get(reverse(URL), {"clienta": "abc"})
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("clienta", r.context["form"].initial)

    def test_solo_ofrece_especialistas_del_local(self):
        self.entrar(self.paola)
        r = self.client.get(reverse(URL))
        self.assertEqual(list(r.context["form"].fields["especialista"].queryset), [self.camila])

    def test_no_acepta_una_especialista_de_otro_local(self):
        self.entrar(self.paola)
        r = self.client.post(reverse(URL), self.datos(especialista=self.liz))
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.context["form"].has_error("especialista"))
        self.assertEqual(Reserva.objects.count(), 0)

    def test_usuario_sin_local_no_puede_agendar(self):
        sin_local = Usuario.objects.create_user(username="sin", email="sin@x.cl", password=CLAVE,
                                                rol=Usuario.Rol.RECEPCIONISTA)
        self.entrar(sin_local)
        self.assertContains(self.client.get(reverse(URL)), "no tiene un local asignado")
        self.client.post(reverse(URL), self.datos())
        self.assertEqual(Reserva.objects.count(), 0)

    #  horarios libres cercanos
    def test_ante_un_tope_sugiere_horarios_libres_cercanos(self):
        self.reservar(self.camila, manana(11))                  # ocupa 11:00–12:00
        self.entrar(self.paola)
        r = self.client.post(reverse(URL), self.datos(inicio=manana(11, 30)))

        valores = [s["valor"] for s in r.context["sugerencias"]]
        self.assertIn(valor(manana(12)), valores)               # justo después del bloque ocupado
        self.assertNotIn(valor(manana(11)), valores)            # ocupado
        self.assertNotIn(valor(manana(11, 30)), valores)        # el pedido, que choca
        self.assertContains(r, 'data-inicio="%s"' % valor(manana(12)))

    def test_sin_tope_no_hay_sugerencias(self):
        self.entrar(self.paola)
        r = self.client.post(reverse(URL), self.datos(especialista=self.liz))  # otro error, no un tope
        self.assertEqual(r.context["sugerencias"], [])

    def test_horarios_libres_no_se_cruzan_y_liberan_lo_cancelado(self):
        activa = self.reservar(self.camila, manana(11))
        libres = horarios_libres_cercanos(self.camila, self.lifting, manana(11, 30))
        self.assertEqual(len(libres), 3)
        for h in libres:
            self.assertFalse(h < activa.fin and h + timedelta(minutes=60) > activa.inicio)

        activa.cancelar("La clienta no puede asistir")
        libres = horarios_libres_cercanos(self.camila, self.lifting, manana(11, 30))
        self.assertIn(manana(11), libres)                       # el bloque cancelado vuelve a estar libre