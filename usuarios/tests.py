from django.test import TestCase
from django.urls import reverse

from locales.models import Local
from usuarios.models import Administrador, Trabajador, Usuario


class UsuariosTests(TestCase):
    """Pruebas de EA_001 / EA_002 (inicio y cierre de sesión por rol) y del diagrama de clases."""

    def setUp(self):
        self.local = Local.objects.create(nombre="Local Mall", ubicacion="Mall")
        self.trab = Usuario.objects.create_user(username="fer", email="fer@x.cl", password="Clave12345!",
                                                rol=Usuario.Rol.TRABAJADOR, local=self.local)

    def test_contrasena_guardada_con_hash(self):
        self.assertNotEqual(self.trab.password, "Clave12345!")
        self.assertTrue(self.trab.password.startswith("pbkdf2_sha256$"))

    def test_superusuario_queda_como_administrador(self):
        admin = Usuario.objects.create_superuser(username="admin", email="admin@x.cl", password="Clave12345!")
        self.assertEqual(admin.rol, Usuario.Rol.ADMINISTRADOR)
        self.assertIn(admin, Administrador.objects.all())

    def test_login_con_correo_redirige_segun_rol(self):
        r = self.client.post(reverse("usuarios:login"), {"username": "fer@x.cl", "password": "Clave12345!"},
                             follow=True)
        self.assertRedirects(r, reverse("usuarios:panel_trabajador"))

    def test_login_incorrecto(self):
        r = self.client.post(reverse("usuarios:login"), {"username": "fer@x.cl", "password": "mala"})
        self.assertContains(r, "Correo o contraseña incorrectos")

    def test_cerrar_sesion(self):
        self.client.login(email="fer@x.cl", password="Clave12345!")
        self.client.post(reverse("usuarios:logout"))
        r = self.client.get(reverse("usuarios:inicio"))
        self.assertEqual(r.status_code, 302)
        self.assertIn(reverse("usuarios:login"), r.url)

    def test_asociar_y_remover_trabajador(self):
        otro = Local.objects.create(nombre="Local Centro", ubicacion="Centro")
        otro.asociar_trabajador(self.trab)
        self.assertIn(self.trab, otro.trabajadores)
        self.assertTrue(otro.remover_trabajador(self.trab))
        self.assertNotIn(self.trab, otro.trabajadores)

    def test_trabajadora_no_entra_a_paneles_de_otros_roles(self):
        """RNF-SA02: cada rol solo accede a su propio panel."""
        self.client.login(email="fer@x.cl", password="Clave12345!")
        self.assertEqual(self.client.get(reverse("usuarios:panel_administrador")).status_code, 403)
        self.assertEqual(self.client.get(reverse("usuarios:panel_recepcionista")).status_code, 403)
        self.assertEqual(self.client.get(reverse("usuarios:panel_trabajador")).status_code, 200)

    def test_recepcionista_no_entra_al_panel_de_administracion(self):
        Usuario.objects.create_user(username="paola", email="paola@x.cl", password="Clave12345!",
                                    rol=Usuario.Rol.RECEPCIONISTA, local=self.local)
        self.client.login(email="paola@x.cl", password="Clave12345!")
        self.assertEqual(self.client.get(reverse("usuarios:panel_administrador")).status_code, 403)
        self.assertEqual(self.client.get(reverse("usuarios:panel_recepcionista")).status_code, 200)

    def test_sin_sesion_redirige_al_login(self):
        r = self.client.get(reverse("usuarios:panel_recepcionista"))
        self.assertEqual(r.status_code, 302)
        self.assertIn(reverse("usuarios:login"), r.url)

    def test_proxy_trabajador_filtra_por_rol(self):
        self.assertEqual(list(Trabajador.objects.all()), [Trabajador.objects.get(pk=self.trab.pk)])
