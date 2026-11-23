"""Pruebas de lo pedido por la clienta en la reunión del 19/11 (Ventas, Comisiones y Reportes).

- Precios distintos por local (el Mall es más caro) y edición de precios por la administradora.
- Descuento exacto en pesos ("dejarlo en 80 mil cerrados").
- Boleta de la venta en PDF.
- Comisión por servicio guardada en cada venta, desglose en el reporte y trabajadoras inactivas.
- Reporte en Excel y PDF.
"""
from decimal import Decimal
from io import BytesIO

from django.db.models import ProtectedError
from django.test import TestCase
from openpyxl import load_workbook
from rest_framework.test import APIClient

from catalogo.models import Inventario, PrecioLocal, Producto, Servicio
from locales.models import Local
from reservas.models import EspecialistaServicio
from usuarios.models import Usuario
from ventas.models import DetalleVenta, RegistroDeVenta
from ventas.services import registrar_venta

CLAVE = "Prueba12345!"


class Base(TestCase):
    def setUp(self):
        self.mall = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        self.centro = Local.objects.create(nombre="Local Centro", ubicacion="Centro de Calama")
        self.admin = Usuario.objects.create_user(username="admin", email="admin@x.cl", password=CLAVE,
                                                 rol=Usuario.Rol.ADMINISTRADOR)
        self.recep = Usuario.objects.create_user(username="paola", email="paola@x.cl", password=CLAVE,
                                                 rol=Usuario.Rol.RECEPCIONISTA, local=self.mall)
        self.recep_centro = Usuario.objects.create_user(username="dani", email="dani@x.cl", password=CLAVE,
                                                        rol=Usuario.Rol.RECEPCIONISTA, local=self.centro)
        self.camila = Usuario.objects.create_user(username="camila", email="camila@x.cl", password=CLAVE,
                                                  first_name="Camila", last_name="Soto",
                                                  rol=Usuario.Rol.TRABAJADOR, local=self.mall, porcentaje_comision=10)
        self.depilacion = Servicio.objects.create(nombre="Depilación de rostro", tipo=Servicio.Tipo.DEPILACION,
                                                  precio=12000)
        self.lifting = Servicio.objects.create(nombre="Lifting de pestañas", tipo=Servicio.Tipo.LIFTING, precio=25000)
        self.manicura = Servicio.objects.create(nombre="Manicura", tipo=Servicio.Tipo.MANICURE, precio=20000)
        self.crema = Producto.objects.create(nombre="Crema de manos", tipo=Producto.Tipo.VENTA, precio=5990)
        Inventario.objects.create(producto=self.crema, local=self.mall, cantidad=20)
        self.api = APIClient()

    def vender(self, items, local=None, descuento=0, descuento_monto=0, recep=None):
        return registrar_venta(local or self.mall, recep or self.recep, "DEBITO", descuento, "", items,
                               descuento_monto=descuento_monto)


class PreciosPorLocalTests(Base):
    def test_el_mall_cobra_su_precio_y_los_demas_el_base(self):
        PrecioLocal.objects.create(item=self.manicura, local=self.mall, precio=24000)
        venta_mall = self.vender([{"item": self.manicura, "cantidad": 1, "trabajador": self.camila}])
        venta_centro = self.vender([{"item": self.manicura, "cantidad": 1, "trabajador": None}],
                                   local=self.centro, recep=self.recep_centro)
        self.assertEqual(venta_mall.monto_total, 24000)
        self.assertEqual(venta_centro.monto_total, 20000)

    def test_lista_de_servicios_de_la_recepcionista_trae_el_precio_de_su_local(self):
        PrecioLocal.objects.create(item=self.manicura, local=self.mall, precio=24000)
        self.api.force_authenticate(self.recep)
        datos = {s["nombre"]: s for s in self.api.get("/api/ventas/servicios/").data}
        self.assertEqual(datos["Manicura"]["precio"], 24000)
        self.assertEqual(datos["Manicura"]["precio_base"], 20000)
        self.api.force_authenticate(self.recep_centro)
        datos = {s["nombre"]: s for s in self.api.get("/api/ventas/servicios/").data}
        self.assertEqual(datos["Manicura"]["precio"], 20000)

    def test_administradora_edita_precio_base_y_por_local(self):
        self.api.force_authenticate(self.admin)
        r = self.api.patch(f"/api/catalogo/precios/{self.manicura.pk}/",
                           {"precio_base": 21000, "precios": {str(self.mall.pk): 26000}}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["precio_base"], 21000)
        self.assertEqual(r.data["precios"][str(self.mall.pk)], 26000)
        self.assertIsNone(r.data["precios"][str(self.centro.pk)])
        # null quita el precio especial: el Mall vuelve al precio base
        r = self.api.patch(f"/api/catalogo/precios/{self.manicura.pk}/",
                           {"precios": {str(self.mall.pk): None}}, format="json")
        self.assertIsNone(r.data["precios"][str(self.mall.pk)])
        self.assertFalse(PrecioLocal.objects.exists())

    def test_lista_de_precios_sin_insumos(self):
        Producto.objects.create(nombre="Algodón", tipo=Producto.Tipo.INSUMO, precio=2500)
        self.api.force_authenticate(self.admin)
        r = self.api.get("/api/catalogo/precios/")
        self.assertEqual(r.status_code, 200)
        nombres = [i["nombre"] for i in r.data["items"]]
        self.assertIn("Crema de manos", nombres)
        self.assertNotIn("Algodón", nombres)

    def test_solo_la_administradora_edita_precios(self):
        self.api.force_authenticate(self.recep)
        self.assertEqual(self.api.get("/api/catalogo/precios/").status_code, 403)
        r = self.api.patch(f"/api/catalogo/precios/{self.manicura.pk}/", {"precio_base": 1}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_precio_invalido_y_local_inexistente(self):
        self.api.force_authenticate(self.admin)
        url = f"/api/catalogo/precios/{self.manicura.pk}/"
        self.assertEqual(self.api.patch(url, {"precio_base": -5}, format="json").status_code, 400)
        self.assertEqual(self.api.patch(url, {"precios": {"999": 1000}}, format="json").status_code, 400)


class DescuentoEnPesosTests(Base):
    def test_total_exacto_en_80_mil_cerrados(self):
        venta = self.vender([
            {"item": self.lifting, "cantidad": 1, "trabajador": self.camila},
            {"item": self.manicura, "cantidad": 3, "trabajador": self.camila},
        ], descuento_monto=5000)  # 85.000 - 5.000
        self.assertEqual(venta.monto_base, 85000)
        self.assertEqual(venta.monto_total, 80000)
        self.assertEqual(venta.descuento_clp, 5000)
        self.assertEqual(venta.descuento, Decimal("5.88"))
        # La comisión se calcula sobre lo efectivamente cobrado: 80.000 × 10 %
        self.assertEqual(sum(venta.comisiones.values()), 8000)

    def test_por_api_y_no_ambos_descuentos(self):
        self.api.force_authenticate(self.recep)
        base = {"metodo_pago": "EFECTIVO",
                "detalles": [{"item": self.lifting.pk, "cantidad": 1, "trabajador": self.camila.pk}]}
        r = self.api.post("/api/ventas/", {**base, "descuento_monto": 5000}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["monto_total"], 20000)
        r = self.api.post("/api/ventas/", {**base, "descuento_monto": 5000, "descuento": 10}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.api.post("/api/ventas/", {**base, "descuento_monto": 30000}, format="json")
        self.assertEqual(r.status_code, 400)


class ComisionPorServicioTests(Base):
    def test_cada_servicio_con_su_porcentaje_y_queda_guardado(self):
        # Ejemplo de la clienta: Camila gana un % en depilación y otro en lifting
        EspecialistaServicio.objects.create(especialista=self.camila, servicio=self.depilacion, porcentaje_comision=3)
        EspecialistaServicio.objects.create(especialista=self.camila, servicio=self.lifting, porcentaje_comision=40)
        venta = self.vender([
            {"item": self.depilacion, "cantidad": 1, "trabajador": self.camila},
            {"item": self.lifting, "cantidad": 1, "trabajador": self.camila},
            {"item": self.manicura, "cantidad": 1, "trabajador": self.camila},  # sin % propio: usa el base (10 %)
        ])
        lineas = {d.item.nombre: d for d in venta.detalles.select_related("item")}
        self.assertEqual(lineas["Depilación de rostro"].comision, 360)    # 12.000 × 3 %
        self.assertEqual(lineas["Lifting de pestañas"].comision, 10000)   # 25.000 × 40 %
        self.assertEqual(lineas["Manicura"].comision, 2000)               # 20.000 × 10 %
        self.assertTrue(lineas["Lifting de pestañas"].comision_por_servicio)
        self.assertFalse(lineas["Manicura"].comision_por_servicio)

        # Si después cambian los %, la venta ya hecha NO cambia
        EspecialistaServicio.objects.filter(servicio=self.lifting).update(porcentaje_comision=50)
        self.camila.porcentaje_comision = 20
        self.camila.save()
        self.assertEqual(DetalleVenta.objects.get(pk=lineas["Lifting de pestañas"].pk).comision, 10000)
        self.assertEqual(DetalleVenta.objects.get(pk=lineas["Manicura"].pk).comision, 2000)

    def test_trabajadora_con_ventas_no_se_puede_borrar(self):
        self.vender([{"item": self.manicura, "cantidad": 1, "trabajador": self.camila}])
        with self.assertRaises(ProtectedError):
            self.camila.delete()


class ReportesNuevosTests(Base):
    def setUp(self):
        super().setUp()
        EspecialistaServicio.objects.create(especialista=self.camila, servicio=self.lifting, porcentaje_comision=40)
        self.vender([
            {"item": self.lifting, "cantidad": 1, "trabajador": self.camila},
            {"item": self.manicura, "cantidad": 1, "trabajador": self.camila},
            {"item": self.crema, "cantidad": 2, "trabajador": None},
        ])
        self.venta = RegistroDeVenta.objects.get()
        self.dia = self.venta.fecha.astimezone().date().isoformat()
        self.params = {"local_id": self.mall.pk, "desde": self.dia, "hasta": self.dia}
        self.api.force_authenticate(self.admin)

    def test_desglose_de_comision_por_servicio(self):
        r = self.api.get("/api/reportes/resumen/", self.params)
        self.assertEqual(r.status_code, 200)
        camila = r.data["trabajadores"][0]
        self.assertEqual(camila["comision"], 12000)   # 25.000 × 40 % + 20.000 × 10 %
        detalle = {d["servicio"]: d for d in camila["detalleComision"]}
        self.assertEqual(detalle["Lifting de pestañas"]["comision"], 10000)
        self.assertTrue(detalle["Lifting de pestañas"]["porServicio"])
        self.assertEqual(detalle["Manicura"]["porcentaje"], 10.0)
        self.assertFalse(detalle["Manicura"]["porServicio"])

    def test_trabajadora_inactiva_sigue_en_el_reporte(self):
        self.camila.is_active = False
        self.camila.save()
        r = self.api.get("/api/reportes/resumen/", self.params)
        camila = r.data["trabajadores"][0]
        self.assertEqual(camila["estado"], "Inactiva")
        self.assertEqual(camila["comision"], 12000)
        self.assertEqual(r.data["indicadores"]["trabajadoresActivos"], 0)

    def test_excel_con_hojas_de_analisis(self):
        r = self.api.get("/api/reportes/excel/", self.params)
        self.assertEqual(r.status_code, 200)
        self.assertIn("spreadsheetml", r["Content-Type"])
        self.assertIn(".xlsx", r["Content-Disposition"])
        libro = load_workbook(BytesIO(r.content))
        for hoja in ["Resumen", "Ventas por día", "Servicios", "Trabajadoras", "Comisiones por servicio",
                     "Comparativa locales", "Detalle de ventas", "Asistencia"]:
            self.assertIn(hoja, libro.sheetnames)
        valores = [c.value for fila in libro["Comisiones por servicio"].iter_rows() for c in fila]
        self.assertIn("Lifting de pestañas", valores)
        self.assertIn(10000, valores)

    def test_pdf_del_reporte(self):
        r = self.api.get("/api/reportes/pdf/", self.params)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertTrue(r.content.startswith(b"%PDF"))

    def test_descargas_solo_para_la_administradora_y_con_periodo_valido(self):
        self.api.force_authenticate(self.recep)
        self.assertEqual(self.api.get("/api/reportes/excel/", self.params).status_code, 403)
        self.assertEqual(self.api.get("/api/reportes/pdf/", self.params).status_code, 403)
        self.api.force_authenticate(self.admin)
        r = self.api.get("/api/reportes/excel/", {**self.params, "desde": "2026-01-01", "hasta": "2026-12-31"})
        self.assertEqual(r.status_code, 400)


class BoletaTests(Base):
    def test_boleta_pdf_de_la_venta(self):
        venta = self.vender([{"item": self.manicura, "cantidad": 1, "trabajador": self.camila}], descuento_monto=2000)
        self.api.force_authenticate(self.recep)
        r = self.api.get(f"/api/ventas/{venta.pk}/boleta/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertIn(f"Boleta_{venta.folio}_Local_Mall_", r["Content-Disposition"])
        self.assertTrue(r.content.startswith(b"%PDF"))

    def test_recepcionista_de_otro_local_no_ve_la_boleta(self):
        venta = self.vender([{"item": self.manicura, "cantidad": 1, "trabajador": self.camila}])
        self.api.force_authenticate(self.recep_centro)
        self.assertEqual(self.api.get(f"/api/ventas/{venta.pk}/boleta/").status_code, 404)

    def test_boleta_de_venta_anulada(self):
        venta = self.vender([{"item": self.manicura, "cantidad": 1, "trabajador": self.camila}])
        venta.anular()
        self.api.force_authenticate(self.admin)
        r = self.api.get(f"/api/ventas/{venta.pk}/boleta/")
        self.assertEqual(r.status_code, 200)


class ServicioOtroTests(Base):
    """El servicio «Otro» (PR #25): precio escrito a mano, con comisión guardada y su nombre en boleta y reporte."""

    def setUp(self):
        super().setUp()
        self.otro = Servicio.objects.get(nombre="Otro", tipo=Servicio.Tipo.OTRO)  # lo crea la migración

    def test_otro_guarda_comision_y_nombre_escrito(self):
        venta = registrar_venta(self.mall, self.recep, "EFECTIVO", 0, "", [
            {"item": self.otro, "cantidad": 1, "trabajador": self.camila,
             "precio_manual": 15000, "nombre_manual": "Retoque de cejas"},
        ])
        linea = venta.detalles.get()
        self.assertEqual(linea.nombre_visible, "Retoque de cejas")
        self.assertEqual(linea.porcentaje_comision, Decimal("10"))
        self.assertEqual(linea.comision, 1500)

        self.api.force_authenticate(self.admin)
        dia = venta.fecha.astimezone().date().isoformat()
        r = self.api.get("/api/reportes/resumen/", {"local_id": self.mall.pk, "desde": dia, "hasta": dia})
        self.assertEqual(r.data["servicios"][0]["nombre"], "Retoque de cejas")
        self.assertEqual(r.data["trabajadores"][0]["detalleComision"][0]["servicio"], "Retoque de cejas")
        self.assertEqual(self.api.get(f"/api/ventas/{venta.pk}/boleta/").status_code, 200)

    def test_otro_no_aparece_en_precios(self):
        self.api.force_authenticate(self.admin)
        nombres = [i["nombre"] for i in self.api.get("/api/catalogo/precios/").data["items"]]
        self.assertNotIn("Otro", nombres)

    def test_otro_servicio_de_tipo_otro_cobra_su_precio(self):
        # Solo el servicio llamado «Otro» pide precio a mano: "Limpieza facial" (tipo OTRO) cobra su precio
        facial = Servicio.objects.create(nombre="Limpieza facial", tipo=Servicio.Tipo.OTRO, precio=28000)
        self.api.force_authenticate(self.recep)
        r = self.api.post("/api/ventas/", {"metodo_pago": "DEBITO", "detalles": [
            {"item": facial.pk, "cantidad": 1, "trabajador": self.camila.pk}]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["monto_total"], 28000)
        self.api.force_authenticate(self.admin)
        nombres = [i["nombre"] for i in self.api.get("/api/catalogo/precios/").data["items"]]
        self.assertIn("Limpieza facial", nombres)
