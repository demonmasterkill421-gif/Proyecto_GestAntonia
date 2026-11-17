"""Pruebas del comando cargar_demo_reservas (datos para la demostración del módulo)."""
from datetime import date
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from reservas.models import Cliente, Reserva

FECHA = "2030-03-04"


class CargarDemoReservasTests(TestCase):
    def cargar(self):
        call_command("cargar_demo_reservas", fecha=FECHA, stdout=StringIO())

    def test_carga_clientes_y_reservas_del_dia(self):
        self.cargar()
        self.assertEqual(Cliente.objects.filter(telefono__startswith="9").count(), 5)
        self.assertEqual(Reserva.objects.filter(inicio__date=date(2030, 3, 4)).count(), 6)
        self.assertEqual(Reserva.objects.filter(estado=Reserva.Estado.CANCELADA).count(), 1)

    def test_se_puede_repetir_sin_duplicar(self):
        self.cargar()
        self.cargar()
        self.assertEqual(Cliente.objects.count(), 5)
        self.assertEqual(Reserva.objects.count(), 7)

    def test_la_recepcionista_del_mall_no_ve_las_reservas_del_centro(self):
        self.cargar()
        self.client.login(username="paola@gestantonia.cl", password="Antonia2026!")
        r = self.client.get(reverse("reservas:agenda"), {"fecha": FECHA})
        self.assertContains(r, "Valentina Muñoz")
        self.assertNotContains(r, "Carolina Díaz")      # su reserva es del Local Centro 1
        self.assertNotContains(r, "Benjamín Pérez")     # su reserva está cancelada
