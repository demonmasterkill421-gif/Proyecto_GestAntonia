"""Corregir y eliminar los datos de una clienta (ley 21.719: rectificación y supresión · Edson)."""
from datetime import timedelta

from django.utils import timezone
from rest_framework import status

from reservas.models import Reserva

from .test_api import API, BaseAPI, iso, manana


class EditarClientaTests(BaseAPI):
    def url(self):
        return f"{API}clientes/{self.maria.pk}/"

    def test_recepcionista_corrige_nombre_y_telefono(self):
        self.como(self.paola)
        r = self.client.patch(self.url(), {"nombre": " María José Pérez ", "telefono": "+56 9 2222 3333"},
                              format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.maria.refresh_from_db()
        self.assertEqual(self.maria.nombre, "María José Pérez")
        self.assertEqual(self.maria.telefono, "+56922223333")          # se guarda limpio

    def test_no_acepta_un_telefono_de_otra_clienta_ni_nombre_vacio(self):
        otra = self.maria.__class__.objects.create(nombre="Ana", telefono="+56977778888", consentimiento=True)
        self.como(self.paola)
        r = self.client.patch(self.url(), {"telefono": otra.telefono}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("telefono", r.data)
        r = self.client.patch(self.url(), {"nombre": "   "}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_la_trabajadora_no_puede_editar(self):
        self.como(self.camila)
        r = self.client.patch(self.url(), {"nombre": "Otra"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


class EliminarDatosTests(BaseAPI):
    def url(self):
        return f"{API}clientes/{self.maria.pk}/eliminar-datos/"

    def test_solo_la_administradora(self):
        self.como(self.paola)
        r = self.client.post(self.url())
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_borra_sus_datos_y_conserva_las_reservas_pasadas(self):
        pasada = self.reservar(self.camila, manana(11))
        Reserva.objects.filter(pk=pasada.pk).update(inicio=timezone.now() - timedelta(days=3),
                                                    fin=timezone.now() - timedelta(days=3, hours=-1),
                                                    estado=Reserva.Estado.ATENDIDA)
        self.maria.anotar("2 inasistencias", self.paola)
        telefono = self.maria.telefono
        self.como(self.admin)
        r = self.client.post(self.url())
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.maria.refresh_from_db()
        self.assertEqual(self.maria.nombre, "Datos eliminados")
        self.assertNotEqual(self.maria.telefono, telefono)
        self.assertEqual(self.maria.observacion, "")
        self.assertFalse(self.maria.consentimiento)
        self.assertEqual(self.maria.datos_eliminados_por, self.admin)
        self.assertTrue(Reserva.objects.filter(pk=pasada.pk).exists())   # la reserva sigue, sin datos personales
        r = self.client.get(f"{API}clientes/", {"telefono": telefono})
        self.assertEqual(r.data, [])                                    # ya no aparece al buscarla

    def test_no_se_puede_con_reservas_futuras(self):
        self.reservar(self.camila, manana(11))
        self.como(self.admin)
        r = self.client.post(self.url())
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reservas futuras", str(r.data))

    def test_una_reserva_suspendida_no_lo_impide(self):
        self.reservar(self.camila, manana(11), estado=Reserva.Estado.CANCELADA, motivo_cancelacion="Avisó")
        self.como(self.admin)
        r = self.client.post(self.url())
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

    def test_despues_no_se_edita_ni_se_le_agenda(self):
        self.maria.eliminar_datos(self.admin)
        self.como(self.admin)
        r = self.client.patch(f"{API}clientes/{self.maria.pk}/", {"nombre": "Volvió"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        r = self.client.post(API + "reservas/", {"especialista": self.camila.pk, "servicio": self.lifting.pk,
                                                 "cliente": self.maria.pk, "inicio": iso(manana(11))}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cliente", r.data)
