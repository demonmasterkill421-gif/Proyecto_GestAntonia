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

    def test_pantalla_django_original(self):
        self.client.force_login(self.admin)
        respuesta = self.client.get('/inventario/', {'buscar': 'Esmalte'})
        self.assertEqual(respuesta.status_code, 200)
        self.assertContains(respuesta, 'Esmalte rojo')
        self.assertNotContains(respuesta, '<td>Crema</td>')
