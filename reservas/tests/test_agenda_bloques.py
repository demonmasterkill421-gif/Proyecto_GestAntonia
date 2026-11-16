"""Pruebas de la integración del Sprint 2: agenda por bloques (2.3) unida al detalle (2.1 y 2.2),
a las especialistas activas (2.4) y a la búsqueda de clientes con teléfono normalizado (1.4)."""
from datetime import datetime, time, timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Servicio
from locales.models import Local
from reservas.models import Cliente, Reserva
from reservas.views_clientes import normalizar_telefono
from usuarios.models import Usuario

CLAVE = "Clave-de-prueba-1"


def manana(hora, minuto=0):
    dia = timezone.localdate() + timedelta(days=1)
    return timezone.make_aware(datetime.combine(dia, time(hora, minuto)))


class AgendaBloquesTests(TestCase):
    def setUp(self):
        self.mall = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        self.manicura = Servicio.objects.create(nombre="Manicura", precio=12000, tipo=Servicio.Tipo.MANICURE, duracion=30)
        self.camila = Usuario.objects.create_user(username="camila", email="camila@x.cl", password=CLAVE,
                                                  first_name="Camila", rol=Usuario.Rol.TRABAJADOR, local=self.mall)
        self.paola = Usuario.objects.create_user(username="paola", email="paola@x.cl", password=CLAVE,
                                                 rol=Usuario.Rol.RECEPCIONISTA, local=self.mall)
        self.ana = Cliente.objects.create(nombre="Ana Pérez", telefono="987654321", consentimiento=True)
        self.client.login(email="paola@x.cl", password=CLAVE)

    def reservar(self, inicio, especialista=None):
        return Reserva.objects.create(local=self.mall, cliente=self.ana, especialista=especialista or self.camila,
                                      servicio=self.manicura, inicio=inicio)

    def agenda(self):
        return self.client.get(reverse("reservas:agenda"), {"fecha": manana(0).date().isoformat()})

    def celda(self, respuesta, hora):
        fila = next(f for f in respuesta.context["bloques"] if f["hora_texto"] == hora)
        return fila["celdas"][0]

    def test_el_bloque_ocupado_enlaza_al_detalle_de_la_reserva(self):
        r = self.reservar(manana(10))
        resp = self.agenda()
        self.assertEqual(self.celda(resp, "10:00")["estado"], "Ocupado")
        self.assertEqual(self.celda(resp, "10:30")["estado"], "Libre")
        self.assertContains(resp, reverse("reservas:detalle", args=[r.pk]))

    def test_una_reserva_que_empieza_a_mitad_de_bloque_ocupa_los_dos_bloques(self):
        self.reservar(manana(10, 15))                       # 10:15 a 10:45
        resp = self.agenda()
        self.assertEqual(self.celda(resp, "10:00")["estado"], "Ocupado")
        self.assertEqual(self.celda(resp, "10:30")["estado"], "Ocupado")

    def test_una_reserva_fuera_del_horario_tambien_se_ve(self):
        self.reservar(manana(8))
        resp = self.agenda()
        self.assertEqual(self.celda(resp, "08:00")["estado"], "Ocupado")

    def test_una_especialista_desactivada_sin_reservas_no_aparece(self):
        Usuario.objects.create_user(username="ines", email="ines@x.cl", password=CLAVE, first_name="Inés",
                                    rol=Usuario.Rol.TRABAJADOR, local=self.mall, is_active=False)
        resp = self.agenda()
        self.assertNotContains(resp, "Inés")

    def test_la_agenda_conserva_el_boton_nueva_reserva(self):
        self.assertContains(self.agenda(), "Nueva reserva")


class TelefonoNormalizadoTests(TestCase):
    def setUp(self):
        local = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        Usuario.objects.create_user(username="paola", email="paola@x.cl", password=CLAVE,
                                    rol=Usuario.Rol.RECEPCIONISTA, local=local)
        self.client.login(email="paola@x.cl", password=CLAVE)
        Cliente.objects.create(nombre="Ana Pérez", telefono="987654321", consentimiento=True)

    def test_quita_espacios_y_guiones_y_conserva_el_mas(self):
        self.assertEqual(normalizar_telefono(" 9 8765-4321 "), "987654321")
        self.assertEqual(normalizar_telefono("+56 9 8765 4321"), "+56987654321")

    def test_encuentra_al_cliente_aunque_se_escriba_con_espacios(self):
        resp = self.client.get(reverse("reservas:buscar_cliente"), {"telefono": "9 8765 4321"})
        self.assertContains(resp, "Ana Pérez")

    def test_no_registra_dos_veces_el_mismo_telefono_con_otro_formato(self):
        self.client.post(reverse("reservas:buscar_cliente"),
                         {"nombre": "Otra Ana", "telefono": "9-8765-4321", "consentimiento": "on"})
        self.assertEqual(Cliente.objects.count(), 1)
