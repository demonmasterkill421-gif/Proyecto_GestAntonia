"""Estados de la reserva con los nombres de Reservo, cambio desde la agenda e histórico de la clienta (Edson)."""
from django.core.exceptions import ValidationError
from rest_framework import status

from reservas.models import Reserva

from .test_api import API, BaseAPI, manana


class EstadosModeloTests(BaseAPI):
    def test_nombres_de_reservo(self):
        nombres = dict(Reserva.Estado.choices)
        self.assertEqual(nombres["AGENDADA"], "No confirmado")
        self.assertEqual(nombres["CANCELADA"], "Suspendió")
        self.assertEqual(len(nombres), 8)

    def test_no_llego_y_lista_de_espera_liberan_el_horario(self):
        for estado in (Reserva.Estado.NO_LLEGO, Reserva.Estado.ESPERA, Reserva.Estado.CANCELADA):
            with self.subTest(estado=estado):
                Reserva.objects.all().delete()
                self.reservar(self.camila, manana(11), estado=estado)
                otra = Reserva(local=self.mall, cliente=self.maria, especialista=self.camila,
                               servicio=self.lifting, inicio=manana(11))
                otra.full_clean()          # sin tope: el horario quedó libre

    def test_confirmada_llego_y_en_atencion_ocupan_el_horario(self):
        for estado in (Reserva.Estado.CONFIRMADA, Reserva.Estado.LLEGO, Reserva.Estado.EN_ATENCION):
            with self.subTest(estado=estado):
                Reserva.objects.all().delete()
                self.reservar(self.camila, manana(11), estado=estado)
                otra = Reserva(local=self.mall, cliente=self.maria, especialista=self.camila,
                               servicio=self.lifting, inicio=manana(11))
                with self.assertRaises(ValidationError):
                    otra.full_clean()

    def test_suspender_exige_motivo(self):
        r = self.reservar(self.camila, manana(11))
        with self.assertRaises(ValidationError):
            r.cambiar_estado(Reserva.Estado.CANCELADA, "")
        r.cambiar_estado(Reserva.Estado.CANCELADA, "Avisó que viaja")
        r.refresh_from_db()
        self.assertEqual(r.estado, Reserva.Estado.CANCELADA)
        self.assertEqual(r.motivo_cancelacion, "Avisó que viaja")

    def test_volver_a_ocupar_revisa_que_el_horario_siga_libre(self):
        falto = self.reservar(self.camila, manana(11), estado=Reserva.Estado.NO_LLEGO)
        self.reservar(self.camila, manana(11))                         # otra clienta tomó el horario
        with self.assertRaises(ValidationError):
            falto.cambiar_estado(Reserva.Estado.LLEGO)
        falto.refresh_from_db()
        self.assertEqual(falto.estado, Reserva.Estado.NO_LLEGO)        # no quedó a medias

    def test_reactivar_una_suspendida_borra_el_motivo(self):
        r = self.reservar(self.camila, manana(11))
        r.cambiar_estado(Reserva.Estado.CANCELADA, "Se enfermó")
        r.cambiar_estado(Reserva.Estado.CONFIRMADA)
        r.refresh_from_db()
        self.assertEqual(r.estado, Reserva.Estado.CONFIRMADA)
        self.assertEqual(r.motivo_cancelacion, "")


class EstadosAPITests(BaseAPI):
    def test_cambiar_estado_desde_la_agenda(self):
        r = self.reservar(self.camila, manana(11))
        self.como(self.paola)
        resp = self.client.post(f"{API}reservas/{r.pk}/estado/", {"estado": "LLEGO"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["estado"], "LLEGO")
        self.assertEqual(resp.data["estado_nombre"], "Llegó")
        self.assertTrue(resp.data["ocupa_horario"])

    def test_estado_invalido_responde_400(self):
        r = self.reservar(self.camila, manana(11))
        self.como(self.paola)
        resp = self.client.post(f"{API}reservas/{r.pk}/estado/", {"estado": "INVENTADO"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_suspender_sin_motivo_responde_400(self):
        r = self.reservar(self.camila, manana(11))
        self.como(self.paola)
        resp = self.client.post(f"{API}reservas/{r.pk}/estado/", {"estado": "CANCELADA"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_cambia_reservas_de_otro_local(self):
        r = self.reservar(self.camila, manana(11))
        self.como(self.rocio)                                          # recepcionista de Centro
        resp = self.client.post(f"{API}reservas/{r.pk}/estado/", {"estado": "LLEGO"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_la_agenda_lista_las_reservas_que_no_ocupan_horario(self):
        self.reservar(self.camila, manana(11), estado=Reserva.Estado.NO_LLEGO)
        self.como(self.paola)
        resp = self.client.get(API + "agenda/", {"fecha": manana(0).date().isoformat()})
        self.assertEqual(len(resp.data["sin_horario"]), 1)
        self.assertEqual(resp.data["sin_horario"][0]["estado_nombre"], "No llegó")
        celdas = [c for b in resp.data["bloques"] for c in b["celdas"] if c["especialista"] == self.camila.pk]
        self.assertTrue(all(c["estado"] == "LIBRE" for c in celdas))   # su horario quedó libre


class HistorialTests(BaseAPI):
    def test_historial_de_la_clienta_con_resumen(self):
        self.reservar(self.camila, manana(10), estado=Reserva.Estado.ATENDIDA)
        self.reservar(self.camila, manana(12), estado=Reserva.Estado.NO_LLEGO)
        self.reservar(self.fernanda, manana(15))
        self.como(self.paola)
        resp = self.client.get(f"{API}clientes/{self.maria.pk}/historial/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data["reservas"]), 3)
        self.assertEqual(resp.data["reservas"][0]["especialista"], self.fernanda.pk)   # la más nueva primero
        resumen = {f["estado"]: f["total"] for f in resp.data["resumen"]}
        self.assertEqual(resumen["NO_LLEGO"], 1)
        self.assertEqual(resumen["ATENDIDA"], 1)

    def test_recepcionista_solo_ve_el_historial_de_su_local(self):
        self.reservar(self.camila, manana(10))                         # Local Mall
        self.reservar(self.liz, manana(10))                            # Local Centro
        self.como(self.rocio)
        resp = self.client.get(f"{API}clientes/{self.maria.pk}/historial/")
        self.assertEqual(len(resp.data["reservas"]), 1)
        self.assertEqual(resp.data["reservas"][0]["local"], self.centro.pk)
        self.como(self.admin)
        resp = self.client.get(f"{API}clientes/{self.maria.pk}/historial/")
        self.assertEqual(len(resp.data["reservas"]), 2)
