"""Pruebas de seguridad (tarea 3.10)."""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from usuarios.api import LoginView

User = get_user_model()

CLAVE = "Zk9#mLq2wP"      # clave correcta (10 caracteres)
MALA = "clave-incorrecta"
NOMBRE = "cristian@test.cl"


def login_api(clave):
    peticion = APIRequestFactory().post(
        "/login/", {User.USERNAME_FIELD: NOMBRE, "password": clave}, format="json"
    )
    respuesta = LoginView.as_view()(peticion)
    respuesta.render()
    return respuesta


class SeguridadTests(TestCase):
    def setUp(self):
        cache.clear()
        usuario = User(**{User.USERNAME_FIELD: NOMBRE})
        usuario.set_password(CLAVE)
        usuario.save()

    def test_clave_minima_10_caracteres(self):
        with self.assertRaises(ValidationError):
            validate_password("Zk9#mLq2w")   # 9 caracteres: rechazada
        validate_password(CLAVE)             # 10 caracteres: aceptada

    def test_sesion_de_15_minutos(self):
        self.assertEqual(settings.SESSION_COOKIE_AGE, 15 * 60)
        self.assertEqual(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds(), 15 * 60)

    def test_bloqueo_al_5to_intento_fallido_login_django(self):
        for _ in range(4):
            self.assertFalse(self.client.login(username=NOMBRE, password=MALA))
        self.assertTrue(self.client.login(username=NOMBRE, password=CLAVE))   # al 4to fallo aún entra
        self.client.logout()

        for _ in range(5):
            self.assertFalse(self.client.login(username=NOMBRE, password=MALA))
        self.assertFalse(self.client.login(username=NOMBRE, password=CLAVE))  # bloqueado

    def test_bloqueo_al_5to_intento_fallido_api(self):
        for _ in range(4):
            self.assertEqual(login_api(MALA).status_code, 401)
        self.assertEqual(login_api(MALA).status_code, 429)        # el 5to ya avisa que quedó bloqueada

        respuesta = login_api(CLAVE)                              # aun con la clave correcta
        self.assertEqual(respuesta.status_code, 429)              # JSON limpio, no 500
        self.assertEqual(respuesta["Content-Type"], "application/json")
        self.assertIn("bloqueada", respuesta.data["detail"])

    def test_login_api_correcto(self):
        respuesta = login_api(CLAVE)
        self.assertEqual(respuesta.status_code, 200)
        self.assertIn("access", respuesta.data)
