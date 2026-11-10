from django.test import TestCase
from django.urls import reverse
from locales.models import Local
from usuarios.models import Usuario
from reservas.models import Cliente

class ClientesTests(TestCase):
    def setUp(self):
        # 1. Crear entorno: Un local y una recepcionista (Cumple seguridad A01)
        self.local = Local.objects.create(nombre="Local Test", ubicacion="Calama")
        self.recepcionista = Usuario.objects.create_user(
            username="recepcion", email="rec@test.com", password="123",
            rol=Usuario.Rol.RECEPCIONISTA, local=self.local
        )
        # 2. Iniciar sesión en el navegador de pruebas
        self.client.login(email="rec@test.com", password="123")
        # 3. Dejar un cliente lista en la base de datos
        self.cliente_bd = Cliente.objects.create(nombre="Ana", telefono="+56900000000", consentimiento=True)
        self.url = reverse("reservas:buscar_cliente")

    def test_buscar_cliente_existente(self):
        # Enviar petición GET con un teléfono que sí existe (HU-03 CA-3)
        respuesta = self.client.get(self.url, {"telefono": "+56900000000"})
        self.assertContains(respuesta, "Ana")
        self.assertContains(respuesta, "Confirmar y Agendar")

    def test_registrar_cliente_nueva_con_exito(self):
        # Enviar petición POST con datos correctos
        datos = {"nombre": "Maria", "telefono": "+56911111111", "consentimiento": "on"}
        respuesta = self.client.post(self.url, datos)
        
        # Debe redirigir (código 302) y el cliente debe existir en BD
        self.assertEqual(respuesta.status_code, 302)
        self.assertTrue(Cliente.objects.filter(telefono="+56911111111").exists())

    def test_no_se_registra_sin_consentimiento(self):
        # Enviar petición POST sin el campo "consentimiento" (Validación Ley 19.628)
        datos = {"nombre": "Laura", "telefono": "+56922222222"}
        respuesta = self.client.post(self.url, datos)
        
        # Debe dar error y no guardar en la BD
        self.assertContains(respuesta, "Debe aceptar el consentimiento")
        self.assertFalse(Cliente.objects.filter(telefono="+56922222222").exists())