from datetime import datetime
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from catalogo.models import Servicio
from locales.models import Local
from usuarios.models import Usuario
from ventas.models import DetalleVenta, RegistroDeVenta


class ReporteResumenTests(TestCase):
    def setUp(self):
        self.local = Local.objects.create(nombre="Local de prueba", ubicacion="Calama")
        self.admin = Usuario.objects.create_user(
            username="admin-prueba", email="admin-prueba@example.org", password="PruebaSegura123!",
            rol=Usuario.Rol.ADMINISTRADOR,
        )
        self.recepcionista = Usuario.objects.create_user(
            username="recep-prueba", email="recep-prueba@example.org", password="PruebaSegura123!",
            rol=Usuario.Rol.RECEPCIONISTA, local=self.local,
        )
        self.trabajadora = Usuario.objects.create_user(
            username="trab-prueba", email="trab-prueba@example.org", password="PruebaSegura123!",
            rol=Usuario.Rol.TRABAJADOR, local=self.local, porcentaje_comision=10,
        )
        self.client = APIClient()
        self.url = "/api/reportes/resumen/"
        self.params = {"local_id": self.local.pk, "desde": "2026-10-01", "hasta": "2026-10-10"}

    def test_se_requiere_autenticacion(self):
        respuesta = self.client.get(self.url, self.params)
        self.assertEqual(respuesta.status_code, 401)

    def test_no_administradora_no_puede_leer_reportes(self):
        self.client.force_authenticate(user=self.recepcionista)
        respuesta = self.client.get(self.url, self.params)
        self.assertEqual(respuesta.status_code, 403)

    def test_reporte_vacio_con_trabajadora_activa(self):
        self.client.force_authenticate(user=self.admin)
        respuesta = self.client.get(self.url, self.params)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["indicadores"]["ganancias"], 0)
        self.assertEqual(respuesta.data["indicadores"]["trabajadoresActivos"], 1)
        self.assertIsNone(respuesta.data["indicadores"]["asistencia"])

    def test_ventas_y_servicios_confirmados(self):
        servicio = Servicio.objects.create(
            nombre="Manicure de prueba", precio=15000,
            tipo=Servicio.Tipo.MANICURE, duracion=60,
        )
        venta = RegistroDeVenta.objects.create(
            local=self.local, recepcionista=self.recepcionista,
            trabajador=self.trabajadora, estado=RegistroDeVenta.Estado.CONFIRMADA,
            monto_total=30000,
            fecha=datetime(2026, 10, 5, 13, tzinfo=ZoneInfo("America/Santiago")),
        )
        DetalleVenta.objects.create(venta=venta, item=servicio, cantidad=2, precio_unitario=15000)
        self.client.force_authenticate(user=self.admin)
        respuesta = self.client.get(self.url, self.params)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["indicadores"]["ganancias"], 30000)
        self.assertEqual(respuesta.data["indicadores"]["servicios"], 2)
        self.assertEqual(respuesta.data["trabajadores"][0]["comision"], 3000)
        self.assertEqual(respuesta.data["serviciosPorTipo"][0]["porcentaje"], 100.0)

    def test_fecha_invalida(self):
        self.client.force_authenticate(user=self.admin)
        respuesta = self.client.get(self.url, {**self.params, "desde": "texto"})
        self.assertEqual(respuesta.status_code, 400)
