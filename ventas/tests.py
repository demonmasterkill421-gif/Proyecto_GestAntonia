from django.core.exceptions import ValidationError
from django.test import TestCase

from catalogo.models import Inventario, Producto, Servicio
from locales.models import Local
from usuarios.models import Recepcionista, Trabajador, Usuario
from ventas.models import RegistroDeVenta


class RegistroDeVentaTests(TestCase):
    """Pruebas del CU-01 Registrar atención (RF-R01 a RF-R05)."""

    def setUp(self):
        self.local = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        self.recep = Recepcionista.objects.create_user(
            username="paola", email="paola@x.cl", password="Clave12345!", rol=Usuario.Rol.RECEPCIONISTA,
            local=self.local)
        self.trab = Trabajador.objects.create_user(
            username="fer", email="fer@x.cl", password="Clave12345!", rol=Usuario.Rol.TRABAJADOR,
            local=self.local, porcentaje_comision=10)
        self.manicura = Servicio.objects.create(nombre="Manicura", tipo=Servicio.Tipo.MANICURE, precio=20000)
        self.esmalte = Producto.objects.create(nombre="Esmalte rojo", tipo=Producto.Tipo.INSUMO, precio=1550)
        self.algodon = Producto.objects.create(nombre="Algodón", tipo=Producto.Tipo.INSUMO, precio=2500)
        Inventario.objects.create(producto=self.esmalte, local=self.local, cantidad=10, stock_minimo=3)
        Inventario.objects.create(producto=self.algodon, local=self.local, cantidad=1)

    def venta_del_mockup(self):
        venta = Recepcionista.objects.get(pk=self.recep.pk).iniciar_venta()
        venta.agregar_item(self.manicura)
        venta.agregar_item(self.esmalte, 2)
        venta.agregar_item(self.algodon, 1)
        venta.asociar_trabajador(self.trab)
        return venta

    def test_total_con_descuento_igual_al_mockup(self):
        venta = self.venta_del_mockup()
        self.assertEqual(venta.monto_base, 25600)            # 20.000 + 2 x 1.550 + 2.500
        self.assertEqual(venta.aplicar_descuento(15), 21760)  # total del mockup «Registrar venta»

    def test_confirmar_descuenta_stock_y_asigna_folio(self):
        venta = self.venta_del_mockup()
        self.assertTrue(venta.confirmar_venta())
        self.assertEqual(venta.estado, RegistroDeVenta.Estado.CONFIRMADA)
        self.assertEqual(venta.folio, 1)
        self.assertEqual(self.esmalte.stock_en(self.local), 8)
        self.assertEqual(self.algodon.stock_en(self.local), 0)

    def test_sin_stock_no_se_confirma(self):
        venta = self.venta_del_mockup()
        venta.agregar_item(self.algodon, 1)                  # pide 2 algodones y hay 1
        with self.assertRaises(ValidationError):
            venta.confirmar_venta()
        venta.refresh_from_db()
        self.assertEqual(venta.estado, RegistroDeVenta.Estado.BORRADOR)
        self.assertEqual(self.esmalte.stock_en(self.local), 10)   # la transacción se revierte completa

    def test_folio_correlativo_por_local(self):
        for esperado in (1, 2):
            v = Recepcionista.objects.get(pk=self.recep.pk).iniciar_venta()
            v.agregar_item(self.manicura)
            v.confirmar_venta()
            self.assertEqual(v.folio, esperado)

    def test_comision_y_anulacion(self):
        venta = self.venta_del_mockup()
        venta.aplicar_descuento(15)
        venta.confirmar_venta()
        self.assertEqual(venta.comision_trabajador, 2176)    # 10% de 21.760
        venta.anular()
        self.assertEqual(self.esmalte.stock_en(self.local), 10)
        self.assertEqual(venta.comision_trabajador, 0)

    def test_venta_confirmada_no_se_modifica(self):
        venta = self.venta_del_mockup()
        venta.confirmar_venta()
        with self.assertRaises(ValidationError):
            venta.agregar_item(self.manicura)
