from django.core.exceptions import ValidationError
from django.test import TestCase

from catalogo.models import Inventario, Producto, Servicio
from locales.models import Local
from usuarios.models import Recepcionista, Trabajador, Usuario
from ventas.models import DetalleVenta, RegistroDeVenta


class RegistroDeVentaTests(TestCase):
    """Pruebas del CU-01 Registrar atención (RF-R01 a RF-R05).

    La trabajadora ya no se asocia a la venta completa: se indica en cada línea de servicio
    (DetalleVenta.trabajador) y de ahí sale su comisión. Los insumos se descuentan del stock
    pero NO se cobran (precio 0 en la venta).
    """

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
        venta.agregar_item(self.manicura, trabajador=self.trab)   # la trabajadora va en la línea del servicio
        venta.agregar_item(self.esmalte, 2)
        venta.agregar_item(self.algodon, 1)
        return venta

    def test_insumos_no_se_cobran(self):
        venta = self.venta_del_mockup()
        precios = {d.item.nombre: d.precio_unitario for d in venta.detalles.select_related("item")}
        self.assertEqual(precios["Manicura"], 20000)
        self.assertEqual(precios["Esmalte rojo"], 0)   # el insumo tiene precio en el catálogo, pero no se cobra
        self.assertEqual(precios["Algodón"], 0)

    def test_total_con_descuento(self):
        venta = self.venta_del_mockup()
        self.assertEqual(venta.monto_base, 20000)            # solo el servicio: los insumos no suman
        self.assertEqual(venta.aplicar_descuento(15), 17000)  # 20.000 menos 15 %

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
        # Comisión de la línea de la trabajadora: 10 % de 17.000 (el servicio con el descuento aplicado)
        self.assertEqual(DetalleVenta.comision_de(self.trab), 1700)
        venta.anular()
        self.assertEqual(self.esmalte.stock_en(self.local), 10)
        self.assertEqual(DetalleVenta.comision_de(self.trab), 0)   # una venta anulada no genera comisión

    def test_venta_confirmada_no_se_modifica(self):
        venta = self.venta_del_mockup()
        venta.confirmar_venta()
        with self.assertRaises(ValidationError):
            venta.agregar_item(self.manicura)

class TrabajadorasVentaApiTests(TestCase):
    """GET /api/ventas/trabajadoras/: las especialistas del formulario de venta salen de la base de datos.

    Reproduce el error de AWS: allí los IDs no coincidían con la lista fija del frontend
    (Fernanda = 3), porque la cuenta de la administradora se creó antes que las demás.
    """

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.local = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        self.otro_local = Local.objects.create(nombre="Local Centro", ubicacion="Calama")
        # Primero la administradora y luego el resto, igual que en el servidor de AWS
        self.admin = Usuario.objects.create_user(
            username="antonia", email="antonia@x.cl", password="Clave12345!",
            rol=Usuario.Rol.ADMINISTRADOR)
        self.recep = Usuario.objects.create_user(
            username="paola", email="paola@x.cl", password="Clave12345!", first_name="Paola",
            rol=Usuario.Rol.RECEPCIONISTA, local=self.local)
        self.fernanda = Usuario.objects.create_user(
            username="fernanda", email="fernanda@x.cl", password="Clave12345!", first_name="Fernanda",
            last_name="Rojas", rol=Usuario.Rol.TRABAJADOR, local=self.local, porcentaje_comision=10)
        self.liz = Usuario.objects.create_user(
            username="liz", email="liz@x.cl", password="Clave12345!", first_name="Liz",
            rol=Usuario.Rol.TRABAJADOR, local=self.otro_local, porcentaje_comision=10)
        self.inactiva = Usuario.objects.create_user(
            username="ex", email="ex@x.cl", password="Clave12345!", first_name="Ex",
            rol=Usuario.Rol.TRABAJADOR, local=self.local, is_active=False)
        self.manicura = Servicio.objects.create(nombre="Manicura", tipo=Servicio.Tipo.MANICURE, precio=20000)

    def ids(self, respuesta):
        return [t["id"] for t in respuesta.json()]

    def test_recepcionista_ve_solo_trabajadoras_activas_de_su_local(self):
        self.client.force_authenticate(self.recep)
        r = self.client.get("/api/ventas/trabajadoras/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.ids(r), [self.fernanda.id])  # ni Liz (otro local), ni la inactiva, ni Paola
        self.assertEqual(r.json()[0]["nombre"], "Fernanda Rojas")

    def test_administradora_ve_todas_o_filtra_por_local(self):
        self.client.force_authenticate(self.admin)
        r = self.client.get("/api/ventas/trabajadoras/")
        self.assertEqual(sorted(self.ids(r)), sorted([self.fernanda.id, self.liz.id]))
        r = self.client.get(f"/api/ventas/trabajadoras/?local={self.otro_local.id}")
        self.assertEqual(self.ids(r), [self.liz.id])
        r = self.client.get("/api/ventas/trabajadoras/?local=abc")
        self.assertEqual(r.status_code, 400)

    def test_trabajadora_no_puede_consultar_la_lista(self):
        self.client.force_authenticate(self.fernanda)
        self.assertEqual(self.client.get("/api/ventas/trabajadoras/").status_code, 403)

    def test_venta_con_la_trabajadora_de_la_lista_se_registra(self):
        self.client.force_authenticate(self.recep)
        fernanda_id = self.ids(self.client.get("/api/ventas/trabajadoras/"))[0]
        self.assertEqual(fernanda_id, self.fernanda.id)  # el ID sale de la base de datos, no de una lista fija
        r = self.client.post("/api/ventas/", {
            "detalles": [{"item": self.manicura.id, "cantidad": 1, "trabajador": fernanda_id}],
            "metodo_pago": "DEBITO", "descuento": 10, "descripcion": "Prueba",
        }, format="json")
        self.assertEqual(r.status_code, 201, r.json())
        self.assertEqual(r.json()["detalles"][0]["trabajador_nombre"], "Fernanda Rojas")

    def test_la_recepcionista_no_sirve_como_trabajadora(self):
        # Era lo que pasaba en AWS: el ID 3 era Paola y el servidor lo rechazaba
        self.client.force_authenticate(self.recep)
        r = self.client.post("/api/ventas/", {
            "detalles": [{"item": self.manicura.id, "cantidad": 1, "trabajador": self.recep.id}],
            "metodo_pago": "DEBITO",
        }, format="json")
        self.assertEqual(r.status_code, 400)
