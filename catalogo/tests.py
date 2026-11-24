from django.test import TestCase
from rest_framework.test import APIClient
from usuarios.models import Usuario
from locales.models import Local
from .models import Producto, Inventario


class InventarioAPITests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = Usuario.objects.create_user(username='admin', email='admin@test.cl', password='Prueba123!', rol='ADMIN')
        cls.trabajador = Usuario.objects.create_user(username='trab', email='trab@test.cl', rol='TRAB')
        cls.local = Local.objects.create(nombre='Centro', ubicacion='Calama')
        otro = Local.objects.create(nombre='Mall', ubicacion='Calama')
        esmalte = Producto.objects.create(nombre='Esmalte rojo', precio=3000)
        crema = Producto.objects.create(nombre='Crema', precio=5000)
        Inventario.objects.create(producto=esmalte, local=cls.local, cantidad=2, stock_minimo=2)
        Inventario.objects.create(producto=crema, local=otro, cantidad=10, stock_minimo=1)

    def setUp(self):
        self.client = APIClient()

    def test_acceso_restringido(self):
        for url in ['/api/catalogo/inventario/', '/api/catalogo/locales/']:
            self.assertEqual(self.client.get(url).status_code, 401)
            self.client.force_authenticate(self.trabajador)
            self.assertEqual(self.client.get(url).status_code, 403)
            self.client.force_authenticate(None)

    def test_busqueda_y_stock_minimo_inclusivo(self):
        self.client.force_authenticate(self.admin)
        respuesta = self.client.get('/api/catalogo/inventario/', {'busqueda': 'ESMALTE', 'local': self.local.pk, 'bajo_minimo': 'true'})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(respuesta.data["registros"]), 1)
        self.assertTrue(respuesta.data["registros"][0]['bajo_minimo'])
        self.assertEqual(respuesta.data["registros"][0]['producto'], 'Esmalte rojo')

    def test_filtros_invalidos_y_vacios(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get('/api/catalogo/inventario/', {'local': 'no'}).status_code, 400)
        self.assertEqual(self.client.get('/api/catalogo/inventario/', {'busqueda': 'inexistente'}).data['registros'], [])
        self.assertEqual(len(self.client.get('/api/catalogo/locales/').data), 2)

    def test_login_jwt_y_consulta(self):
        respuesta = self.client.post('/api/login/', {'email': 'admin@test.cl', 'password': 'Prueba123!'}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + respuesta.data['access'])
        self.assertEqual(len(self.client.get('/api/catalogo/inventario/').data['registros']), 2)

    def test_resumen_general_no_cambia_con_busqueda(self):
        self.client.force_authenticate(self.admin)
        producto = Producto.objects.get(nombre="Esmalte rojo")
        otro = Local.objects.exclude(pk=self.local.pk).first()
        Inventario.objects.create(producto=producto, local=otro, cantidad=3, stock_minimo=1)
        respuesta = self.client.get('/api/catalogo/inventario/', {'busqueda': 'inexistente'})
        self.assertEqual(respuesta.data['registros'], [])
        self.assertEqual(respuesta.data['resumen'], {'total_productos': 2, 'stock_total': 15, 'stock_bajo': 1})



class EditarInventarioAPITests(TestCase):
    """M11: editar producto y reponer stock desde la pantalla de Inventario."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = Usuario.objects.create_user(username='admin', email='admin@test.cl', password='Prueba123!', rol='ADMIN')
        cls.trabajador = Usuario.objects.create_user(username='trab', email='trab@test.cl', rol='TRAB')
        cls.local = Local.objects.create(nombre='Centro', ubicacion='Calama')
        cls.producto = Producto.objects.create(nombre='Esmalte rojo', precio=3000, tipo='VENTA')
        cls.inventario = Inventario.objects.create(producto=cls.producto, local=cls.local, cantidad=5, stock_minimo=2)

    def setUp(self):
        self.client = APIClient()
        self.url = f'/api/catalogo/inventario/{self.inventario.pk}/'
        self.url_ajustar = f'/api/catalogo/inventario/{self.inventario.pk}/ajustar/'

    def test_solo_administradora(self):
        self.assertEqual(self.client.patch(self.url, {'nombre': 'X'}, format='json').status_code, 401)
        self.assertEqual(self.client.post(self.url_ajustar, {'cantidad': 1}, format='json').status_code, 401)
        self.client.force_authenticate(self.trabajador)
        self.assertEqual(self.client.patch(self.url, {'nombre': 'X'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(self.url_ajustar, {'cantidad': 1}, format='json').status_code, 403)

    def test_editar_datos_del_producto_y_stock_minimo(self):
        self.client.force_authenticate(self.admin)
        respuesta = self.client.patch(self.url, {
            'nombre': 'Esmalte rojo pasión', 'marca': 'Essie', 'precio': 3500, 'stock_minimo': 4,
        }, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.producto.refresh_from_db()
        self.inventario.refresh_from_db()
        self.assertEqual(self.producto.nombre, 'Esmalte rojo pasión')
        self.assertEqual(self.producto.marca, 'Essie')
        self.assertEqual(self.producto.precio, 3500)
        self.assertEqual(self.inventario.stock_minimo, 4)
        self.assertEqual(respuesta.data['producto'], 'Esmalte rojo pasión')

    def test_editar_no_cambia_la_cantidad(self):
        # La cantidad solo cambia con /ajustar/, para que quede el movimiento.
        self.client.force_authenticate(self.admin)
        self.client.patch(self.url, {'cantidad': 999}, format='json')
        self.inventario.refresh_from_db()
        self.assertEqual(self.inventario.cantidad, 5)

    def test_editar_con_datos_invalidos(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch(self.url, {'nombre': ''}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(self.url, {'precio': -1}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(self.url, {'stock_minimo': -1}, format='json').status_code, 400)
        self.assertEqual(self.client.patch(self.url, {'tipo': 'OTRO'}, format='json').status_code, 400)

    def test_reponer_stock_deja_movimiento(self):
        self.client.force_authenticate(self.admin)
        respuesta = self.client.post(self.url_ajustar, {'cantidad': 10, 'motivo': 'COMPRA'}, format='json')
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['cantidad'], 15)
        self.assertEqual(self.inventario.movimientos.first().cantidad, 10)
        self.assertEqual(self.inventario.movimientos.first().motivo, 'COMPRA')
        listado = self.client.get('/api/catalogo/inventario/').data['registros'][0]
        self.assertEqual(listado['cantidad'], 15)
        self.assertEqual(listado['ultimo_movimiento'], 10)

    def test_no_permite_stock_bajo_cero(self):
        self.client.force_authenticate(self.admin)
        respuesta = self.client.post(self.url_ajustar, {'cantidad': -6, 'motivo': 'DANADO'}, format='json')
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn('Stock insuficiente', respuesta.data['detail'])
        self.inventario.refresh_from_db()
        self.assertEqual(self.inventario.cantidad, 5)
        self.assertFalse(self.inventario.movimientos.exists())

    def test_cantidad_invalida(self):
        self.client.force_authenticate(self.admin)
        for valor in [None, 'diez', 0, 1.5]:
            datos = {'motivo': 'COMPRA'} if valor is None else {'cantidad': valor, 'motivo': 'COMPRA'}
            self.assertEqual(self.client.post(self.url_ajustar, datos, format='json').status_code, 400, valor)

    def test_registro_inexistente(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.patch('/api/catalogo/inventario/9999/', {'nombre': 'X'}, format='json').status_code, 404)
        self.assertEqual(self.client.post('/api/catalogo/inventario/9999/ajustar/', {'cantidad': 1}, format='json').status_code, 404)

    def test_ajuste_requiere_motivo_valido(self):
        self.client.force_authenticate(self.admin)
        casos = [
            {'cantidad': 3},                          # sin motivo
            {'cantidad': 3, 'motivo': 'DANADO'},      # dañado solo sirve para restar
            {'cantidad': -1, 'motivo': 'COMPRA'},     # compra solo sirve para sumar
            {'cantidad': -1, 'motivo': 'VENTA'},      # venta es automático, no se elige
        ]
        for datos in casos:
            self.assertEqual(self.client.post(self.url_ajustar, datos, format='json').status_code, 400, datos)
        self.assertFalse(self.inventario.movimientos.exists())

    def test_motivos_automaticos_desde_ventas(self):
        insumo = Producto.objects.create(nombre='Algodón', precio=0, tipo='INSUMO')
        Inventario.objects.create(producto=insumo, local=self.local, cantidad=5)
        # Así llama Ventas a actualizar_stock(): sin motivo.
        self.producto.actualizar_stock(self.local, -1)
        self.assertEqual(self.inventario.movimientos.first().motivo, 'VENTA')
        self.producto.actualizar_stock(self.local, 1)
        self.assertEqual(self.inventario.movimientos.first().motivo, 'ANULACION')
        insumo.actualizar_stock(self.local, -2)
        self.assertEqual(insumo.inventarios.get().movimientos.first().motivo, 'USO_SERVICIO')

    def test_historial_movimientos(self):
        url = f'/api/catalogo/inventario/{self.inventario.pk}/movimientos/'
        self.assertEqual(self.client.get(url).status_code, 401)
        self.client.force_authenticate(self.trabajador)
        self.assertEqual(self.client.get(url).status_code, 403)
        self.client.force_authenticate(self.admin)
        self.client.post(self.url_ajustar, {'cantidad': 10, 'motivo': 'COMPRA'}, format='json')
        self.client.post(self.url_ajustar, {'cantidad': -2, 'motivo': 'DANADO'}, format='json')
        respuesta = self.client.get(url)
        self.assertEqual(respuesta.status_code, 200)
        movimientos = respuesta.data['movimientos']
        # Del más nuevo al más viejo, con el stock que quedó después de cada uno (5 + 10 - 2)
        self.assertEqual([m['cantidad'] for m in movimientos], [-2, 10])
        self.assertEqual([m['motivo'] for m in movimientos], ['DANADO', 'COMPRA'])
        self.assertEqual([m['stock_resultante'] for m in movimientos], [13, 15])
        self.assertEqual(self.client.get('/api/catalogo/inventario/9999/movimientos/').status_code, 404)