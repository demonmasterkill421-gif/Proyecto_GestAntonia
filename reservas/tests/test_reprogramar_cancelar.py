"""Pruebas de reprogramar (2.1) y cancelar (2.2)."""
from datetime import datetime, time, timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from catalogo.models import Servicio
from locales.models import Local
from reservas.models import Cliente, Reserva
from usuarios.models import Usuario

CLAVE = "Clave-de-prueba-1"


def en_dias(dias, hora, minuto=0):
    dia = timezone.localdate() + timedelta(days=dias)
    return timezone.make_aware(datetime.combine(dia, time(hora, minuto)))


def manana(hora, minuto=0):
    return en_dias(1, hora, minuto)


def valor(dt):
    """Formato que envía <input type="datetime-local">."""
    return timezone.localtime(dt).strftime("%Y-%m-%dT%H:%M")


class BaseReservas(TestCase):
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
        self.maria = Cliente.objects.create(nombre="María González", telefono="987654321", consentimiento=True)

    def reservar(self, especialista, inicio):
        return Reserva.objects.create(local=especialista.local, cliente=self.maria, especialista=especialista,
                                      servicio=self.lifting, inicio=inicio)

    def entrar(self, usuario):
        self.client.login(email=usuario.email, password=CLAVE)


# =============================================================== modelo
class ReprogramarModeloTests(BaseReservas):
    def test_cambia_la_hora_y_recalcula_el_fin(self):
        r = self.reservar(self.camila, manana(11))
        r.reprogramar(manana(15))
        r.refresh_from_db()
        self.assertEqual(r.inicio, manana(15))
        self.assertEqual(r.fin, manana(16))
        self.assertEqual(r.estado, Reserva.Estado.AGENDADA)

    def test_libera_el_bloque_anterior(self):
        r = self.reservar(self.camila, manana(11))
        r.reprogramar(manana(15))
        # El 11:00 quedó libre: otra reserva puede ocuparlo sin tope.
        nueva = Reserva(local=self.mall, cliente=self.maria, especialista=self.camila,
                        servicio=self.lifting, inicio=manana(11))
        nueva.full_clean()
        nueva.save()
        self.assertEqual(Reserva.objects.count(), 2)

    def test_no_deja_mover_a_un_horario_ocupado(self):
        self.reservar(self.camila, manana(15))
        r = self.reservar(self.camila, manana(11))
        with self.assertRaises(ValidationError):
            r.reprogramar(manana(15, 30))
        self.assertEqual(r.inicio, manana(11))          # el objeto en memoria vuelve a su hora
        r.refresh_from_db()
        self.assertEqual(r.inicio, manana(11))          # y la base no cambió
        self.assertEqual(r.fin, manana(12))

    def test_puede_moverse_a_un_horario_que_se_cruza_con_su_propio_bloque(self):
        r = self.reservar(self.camila, manana(11))
        r.reprogramar(manana(11, 30))                   # 11:30–12:30 se cruza con 11:00–12:00 (la misma)
        r.refresh_from_db()
        self.assertEqual(r.inicio, manana(11, 30))

    def test_no_deja_reprogramar_una_reserva_cancelada(self):
        r = self.reservar(self.camila, manana(11))
        r.cancelar("La cliente no puede asistir")
        with self.assertRaises(ValidationError):
            r.reprogramar(manana(15))
        r.refresh_from_db()
        self.assertEqual(r.inicio, manana(11))

    def test_no_deja_reprogramar_una_reserva_atendida(self):
        r = self.reservar(self.camila, manana(11))
        r.estado = Reserva.Estado.ATENDIDA
        r.save()
        with self.assertRaises(ValidationError):
            r.reprogramar(manana(15))


class CancelarModeloTests(BaseReservas):
    def test_motivo_vacio_no_cancela(self):
        r = self.reservar(self.camila, manana(11))
        for motivo in ("", "   ", None):
            with self.assertRaises(ValidationError):
                r.cancelar(motivo)
        r.refresh_from_db()
        self.assertEqual(r.estado, Reserva.Estado.AGENDADA)

    def test_cancelar_dos_veces_no_se_permite_y_conserva_el_primer_motivo(self):
        r = self.reservar(self.camila, manana(11))
        r.cancelar("Primer motivo")
        with self.assertRaises(ValidationError):
            r.cancelar("Segundo motivo")
        r.refresh_from_db()
        self.assertEqual(r.motivo_cancelacion, "Primer motivo")

    def test_no_se_cancela_una_reserva_atendida(self):
        r = self.reservar(self.camila, manana(11))
        r.estado = Reserva.Estado.ATENDIDA
        r.save()
        with self.assertRaises(ValidationError):
            r.cancelar("Motivo")


# =============================================================== pantallas
class DetalleReservaTests(BaseReservas):
    def test_la_recepcionista_ve_el_detalle_con_las_dos_acciones(self):
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        resp = self.client.get(reverse("reservas:detalle", args=[r.pk]))
        self.assertContains(resp, "María González")
        self.assertContains(resp, "Lifting")
        self.assertContains(resp, "Reprogramar")
        self.assertContains(resp, "Cancelar reserva")

    def test_una_reserva_cancelada_no_ofrece_acciones(self):
        r = self.reservar(self.camila, manana(11))
        r.cancelar("Imprevisto")
        self.entrar(self.paola)
        resp = self.client.get(reverse("reservas:detalle", args=[r.pk]))
        self.assertContains(resp, "Imprevisto")
        self.assertNotContains(resp, 'name="inicio"')
        self.assertNotContains(resp, 'name="motivo"')

    def test_la_trabajadora_recibe_403(self):
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.camila)
        self.assertEqual(self.client.get(reverse("reservas:detalle", args=[r.pk])).status_code, 403)
        resp = self.client.post(reverse("reservas:cancelar", args=[r.pk]), {"motivo": "x"})
        self.assertEqual(resp.status_code, 403)

    def test_una_reserva_de_otro_local_responde_404_y_no_cambia(self):
        ajena = self.reservar(self.liz, manana(11))        # local Centro
        self.entrar(self.paola)                            # recepcionista del Mall
        self.assertEqual(self.client.get(reverse("reservas:detalle", args=[ajena.pk])).status_code, 404)
        r = self.client.post(reverse("reservas:cancelar", args=[ajena.pk]), {"motivo": "Intento"})
        self.assertEqual(r.status_code, 404)
        r = self.client.post(reverse("reservas:reprogramar", args=[ajena.pk]), {"inicio": valor(manana(15))})
        self.assertEqual(r.status_code, 404)
        ajena.refresh_from_db()
        self.assertEqual(ajena.estado, Reserva.Estado.AGENDADA)
        self.assertEqual(ajena.inicio, manana(11))

    def test_reprogramar_y_cancelar_solo_aceptan_post(self):
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        self.assertEqual(self.client.get(reverse("reservas:reprogramar", args=[r.pk])).status_code, 405)
        self.assertEqual(self.client.get(reverse("reservas:cancelar", args=[r.pk])).status_code, 405)


class ReprogramarPantallaTests(BaseReservas):
    def test_reprograma_y_vuelve_a_la_agenda_del_nuevo_dia(self):
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        resp = self.client.post(reverse("reservas:reprogramar", args=[r.pk]),
                                {"inicio": valor(en_dias(2, 14))})
        r.refresh_from_db()
        self.assertEqual(r.inicio, en_dias(2, 14))
        self.assertEqual(r.fin, en_dias(2, 15))
        self.assertRedirects(resp, f"{reverse('reservas:agenda')}?fecha={en_dias(2, 14).date().isoformat()}",
                             fetch_redirect_response=False)

    def test_rechaza_un_horario_ocupado_y_explica_el_motivo(self):
        self.reservar(self.camila, manana(15))
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        resp = self.client.post(reverse("reservas:reprogramar", args=[r.pk]), {"inicio": valor(manana(15, 30))})
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "ya tiene una reserva en ese horario")
        r.refresh_from_db()
        self.assertEqual(r.inicio, manana(11))

    def test_rechaza_reprogramar_una_reserva_cancelada(self):
        r = self.reservar(self.camila, manana(11))
        r.cancelar("Imprevisto")
        self.entrar(self.paola)
        resp = self.client.post(reverse("reservas:reprogramar", args=[r.pk]), {"inicio": valor(manana(15))})
        self.assertEqual(resp.status_code, 200)
        r.refresh_from_db()
        self.assertEqual(r.inicio, manana(11))

    def test_fecha_invalida_muestra_error_y_no_cambia_nada(self):
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        resp = self.client.post(reverse("reservas:reprogramar", args=[r.pk]), {"inicio": "no es una fecha"})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.context["form_reprogramar"].has_error("inicio"))
        r.refresh_from_db()
        self.assertEqual(r.inicio, manana(11))


class CancelarPantallaTests(BaseReservas):
    def test_cancela_con_motivo_y_libera_el_bloque(self):
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        resp = self.client.post(reverse("reservas:cancelar", args=[r.pk]), {"motivo": "  La cliente se enfermó  "})
        r.refresh_from_db()
        self.assertEqual(r.estado, Reserva.Estado.CANCELADA)
        self.assertEqual(r.motivo_cancelacion, "La cliente se enfermó")   # sin espacios sobrantes
        self.assertRedirects(resp, f"{reverse('reservas:agenda')}?fecha={manana(11).date().isoformat()}",
                             fetch_redirect_response=False)
        # La agenda ya no la muestra y el bloque queda libre.
        agenda = self.client.get(reverse("reservas:agenda"), {"fecha": manana(11).date().isoformat()})
        self.assertNotContains(agenda, "María González")
        otra = Reserva(local=self.mall, cliente=self.maria, especialista=self.camila,
                       servicio=self.lifting, inicio=manana(11))
        otra.full_clean()

    def test_motivo_vacio_muestra_error_y_no_cancela(self):
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        for motivo in ("", "    "):
            resp = self.client.post(reverse("reservas:cancelar", args=[r.pk]), {"motivo": motivo})
            self.assertEqual(resp.status_code, 200)
            self.assertContains(resp, "Indique el motivo de la cancelación")
        r.refresh_from_db()
        self.assertEqual(r.estado, Reserva.Estado.AGENDADA)

    def test_cancelar_dos_veces_muestra_error_y_conserva_el_primer_motivo(self):
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        self.client.post(reverse("reservas:cancelar", args=[r.pk]), {"motivo": "Primer motivo"})
        resp = self.client.post(reverse("reservas:cancelar", args=[r.pk]), {"motivo": "Segundo motivo"})
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Esta reserva está cancelada")   # ya no se ofrece el formulario
        self.assertContains(resp, "Primer motivo")
        r.refresh_from_db()
        self.assertEqual(r.motivo_cancelacion, "Primer motivo")

    def test_motivo_demasiado_largo_se_rechaza(self):
        r = self.reservar(self.camila, manana(11))
        self.entrar(self.paola)
        resp = self.client.post(reverse("reservas:cancelar", args=[r.pk]), {"motivo": "x" * 201})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.context["form_cancelar"].has_error("motivo"))
        r.refresh_from_db()
        self.assertEqual(r.estado, Reserva.Estado.AGENDADA)