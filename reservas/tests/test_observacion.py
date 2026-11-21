"""Observación interna de la clienta, en texto libre (pedido del local · Edson)."""
from rest_framework import status

from .test_api import API, BaseAPI, manana


class ObservacionTests(BaseAPI):
    def url(self):
        return f"{API}clientes/{self.maria.pk}/observacion/"

    def test_recepcionista_anota_y_queda_quien_y_cuando(self):
        self.como(self.paola)
        r = self.client.post(self.url(), {"observacion": "  3 inasistencias sin aviso  "}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.maria.refresh_from_db()
        self.assertEqual(self.maria.observacion, "3 inasistencias sin aviso")
        self.assertEqual(self.maria.observacion_por, self.paola)
        self.assertIsNotNone(self.maria.observacion_actualizada)
        self.assertEqual(r.data["observacion_por_nombre"], self.paola.email)

    def test_vacia_quita_la_observacion(self):
        self.maria.anotar("Algo", self.admin)
        self.como(self.admin)
        self.client.post(self.url(), {"observacion": ""}, format="json")
        self.maria.refresh_from_db()
        self.assertEqual(self.maria.observacion, "")

    def test_maximo_500_caracteres(self):
        self.como(self.paola)
        r = self.client.post(self.url(), {"observacion": "x" * 501}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_la_trabajadora_no_puede_anotar(self):
        self.como(self.camila)
        r = self.client.post(self.url(), {"observacion": "x"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_se_escribe_al_crear_ni_editar_la_clienta(self):
        self.como(self.paola)
        r = self.client.post(f"{API}clientes/", {"nombre": "Ana", "telefono": "+56911112222",
                                                "consentimiento": True, "observacion": "no debería"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data["observacion"], "")                    # solo por la acción observacion/

    def test_se_ve_en_la_reserva_y_en_la_agenda(self):
        self.maria.anotar("Llega siempre tarde", self.admin)
        reserva = self.reservar(self.camila, manana(11))
        self.como(self.paola)
        r = self.client.get(f"{API}reservas/{reserva.pk}/")
        self.assertEqual(r.data["cliente_observacion"], "Llega siempre tarde")
        r = self.client.get(API + "agenda/", {"fecha": manana(0).date().isoformat()})
        celda = next(c for b in r.data["bloques"] for c in b["celdas"] if c["reserva"])
        self.assertEqual(celda["reserva"]["cliente_observacion"], "Llega siempre tarde")
