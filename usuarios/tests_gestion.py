"""Pruebas: gestión de usuarios y locales por la administradora, primera administradora y clave de anulación."""
from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from locales.models import Local
from usuarios.models import Usuario

CLAVE = "UnaClaveSegura2026!"


class BaseGestion(TestCase):
    def setUp(self):
        cache.clear()  # el límite de intentos (throttle) se guarda en la caché
        self.local = Local.objects.create(nombre="Local Centro", ubicacion="Calama")
        self.admin = Usuario.objects.create_user(username="admin@x.cl", email="admin@x.cl", password=CLAVE,
                                                 first_name="Antonia", rol=Usuario.Rol.ADMINISTRADOR)
        self.recep = Usuario.objects.create_user(username="paola@x.cl", email="paola@x.cl", password=CLAVE,
                                                 first_name="Paola", rol=Usuario.Rol.RECEPCIONISTA, local=self.local)
        self.trab = Usuario.objects.create_user(username="fer@x.cl", email="fer@x.cl", password=CLAVE,
                                                first_name="Fernanda", rol=Usuario.Rol.TRABAJADOR, local=self.local)
        self.api = APIClient()

    def tearDown(self):
        cache.clear()  # no dejar intentos gastados a las pruebas que siguen


class GestionUsuariosTests(BaseGestion):
    def test_crear_recepcionista_y_que_pueda_iniciar_sesion(self):
        self.api.force_authenticate(self.admin)
        r = self.api.post("/api/usuarios/", {"nombre": "Daniela", "apellido": "Torres", "email": "Daniela@X.cl",
                                             "rol": "RECEP", "local": self.local.pk, "clave": CLAVE}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertNotIn("clave", r.data)
        nueva = Usuario.objects.get(email="daniela@x.cl")
        self.assertEqual(nueva.rol, Usuario.Rol.RECEPCIONISTA)
        self.assertTrue(nueva.check_password(CLAVE))
        login = APIClient().post("/api/login/", {"email": "daniela@x.cl", "password": CLAVE}, format="json")
        self.assertEqual(login.status_code, 200)

    def test_crear_otra_administradora_sin_local(self):
        self.api.force_authenticate(self.admin)
        r = self.api.post("/api/usuarios/", {"nombre": "Socia", "email": "socia@x.cl", "rol": "ADMIN",
                                             "local": None, "clave": CLAVE}, format="json")
        self.assertEqual(r.status_code, 201, r.data)

    def test_validaciones(self):
        self.api.force_authenticate(self.admin)
        base = {"nombre": "X", "email": "nuevo@x.cl", "rol": "RECEP", "local": self.local.pk, "clave": CLAVE}
        casos = [
            ({**base, "email": "PAOLA@x.cl"}, "email"),          # correo repetido
            ({**base, "local": None}, "local"),                   # recepcionista sin local
            ({**base, "rol": "TRAB"}, "rol"),                     # especialistas van en su pantalla
            ({**base, "clave": "123"}, "clave"),                  # contraseña débil
            ({k: v for k, v in base.items() if k != "clave"}, "clave"),
        ]
        for datos, campo in casos:
            r = self.api.post("/api/usuarios/", datos, format="json")
            self.assertEqual(r.status_code, 400, datos)
            self.assertIn(campo, r.data, (datos, r.data))

    def test_lista_sin_especialistas_y_solo_para_administradora(self):
        self.api.force_authenticate(self.admin)
        correos = [u["email"] for u in self.api.get("/api/usuarios/").data]
        self.assertIn("paola@x.cl", correos)
        self.assertNotIn("fer@x.cl", correos)
        self.api.force_authenticate(self.recep)
        self.assertEqual(self.api.get("/api/usuarios/").status_code, 403)
        self.assertEqual(self.api.post("/api/usuarios/", {}, format="json").status_code, 403)

    def test_editar_y_cambiar_clave(self):
        self.api.force_authenticate(self.admin)
        r = self.api.patch(f"/api/usuarios/{self.recep.pk}/", {"apellido": "Rojas", "clave": "OtraClaveSegura99"},
                           format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.recep.refresh_from_db()
        self.assertEqual(self.recep.last_name, "Rojas")
        self.assertTrue(self.recep.check_password("OtraClaveSegura99"))

    def test_desactivar_y_protecciones(self):
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.post(f"/api/usuarios/{self.recep.pk}/desactivar/").status_code, 200)
        self.recep.refresh_from_db()
        self.assertFalse(self.recep.is_active)
        # No puede desactivarse a sí misma ni quitarse el rol
        self.assertEqual(self.api.post(f"/api/usuarios/{self.admin.pk}/desactivar/").status_code, 400)
        r = self.api.patch(f"/api/usuarios/{self.admin.pk}/", {"rol": "RECEP", "local": self.local.pk}, format="json")
        self.assertEqual(r.status_code, 400)
        # Las especialistas no se tocan desde aquí
        self.assertEqual(self.api.post(f"/api/usuarios/{self.trab.pk}/desactivar/").status_code, 404)

    def test_debe_quedar_una_administradora_activa(self):
        otra = Usuario.objects.create_user(username="o@x.cl", email="o@x.cl", password=CLAVE, rol=Usuario.Rol.ADMINISTRADOR)
        self.api.force_authenticate(otra)
        self.assertEqual(self.api.post(f"/api/usuarios/{self.admin.pk}/desactivar/").status_code, 200)
        # Ahora "otra" es la única activa: nadie puede desactivarla (ni ella misma)
        self.assertEqual(self.api.post(f"/api/usuarios/{otra.pk}/desactivar/").status_code, 400)


class GestionLocalesTests(BaseGestion):
    def test_crear_editar_y_cerrar_local(self):
        self.api.force_authenticate(self.admin)
        r = self.api.post("/api/locales/", {"nombre": "  Local   Centro 3 ", "ubicacion": "Sotomayor 1234"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["nombre"], "Local Centro 3")
        self.assertEqual(r.data["estado"], "ACTIVO")
        r = self.api.patch(f"/api/locales/{r.data['id']}/", {"estado": "INACTIVO"}, format="json")
        self.assertEqual(r.data["estado"], "INACTIVO")
        self.assertEqual(len(self.api.get("/api/locales/").data), 2)

    def test_validaciones_y_permisos(self):
        self.api.force_authenticate(self.admin)
        self.assertEqual(self.api.post("/api/locales/", {"nombre": "local centro", "ubicacion": "x"},
                                       format="json").status_code, 400)  # nombre repetido
        self.assertEqual(self.api.post("/api/locales/", {"nombre": "Nuevo", "ubicacion": "  "},
                                       format="json").status_code, 400)
        self.assertEqual(self.api.delete(f"/api/locales/{self.local.pk}/").status_code, 405)  # no se borran
        self.api.force_authenticate(self.recep)
        self.assertEqual(self.api.post("/api/locales/", {"nombre": "X", "ubicacion": "Y"}, format="json").status_code, 403)


class PrimeraAdministradoraTests(TestCase):
    datos = {"nombre": "Antonia", "apellido": "Pérez", "email": "Antonia@Estetica.cl",
             "clave": CLAVE, "repetir_clave": CLAVE, "codigo": "abcd1234"}

    def setUp(self):
        cache.clear()
        self.api = APIClient()

    def tearDown(self):
        cache.clear()

    @mock.patch.dict("os.environ", {"CODIGO_INSTALACION": "abcd1234"})
    def test_crea_la_primera_administradora_solo_una_vez(self):
        self.assertEqual(self.api.get("/api/instalacion/").data, {"pendiente": True, "pide_codigo": True})
        r = self.api.post("/api/instalacion/", self.datos, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        admin = Usuario.objects.get()
        self.assertEqual(admin.email, "antonia@estetica.cl")
        self.assertTrue(admin.es_administrador)
        self.assertEqual(self.api.get("/api/instalacion/").data["pendiente"], False)
        # Ya hay un usuario: no se puede crear otra "primera" cuenta
        r = self.api.post("/api/instalacion/", {**self.datos, "email": "otra@x.cl"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(Usuario.objects.count(), 1)

    @mock.patch.dict("os.environ", {"CODIGO_INSTALACION": "abcd1234"})
    def test_codigo_incorrecto_o_claves_distintas(self):
        self.assertEqual(self.api.post("/api/instalacion/", {**self.datos, "codigo": "mal"}, format="json").status_code, 400)
        r = self.api.post("/api/instalacion/", {**self.datos, "repetir_clave": "otra"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Usuario.objects.exists())

    @override_settings(DEBUG=False)
    @mock.patch.dict("os.environ", {"CODIGO_INSTALACION": ""})
    def test_sin_codigo_en_produccion_no_se_puede(self):
        r = self.api.post("/api/instalacion/", self.datos, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Usuario.objects.exists())


class ClaveAnulacionSinCrearTests(BaseGestion):
    def test_mensaje_claro_si_aun_no_existe_y_la_administradora_la_crea(self):
        self.api.force_authenticate(self.recep)
        r = self.api.post("/api/ventas/verificar-clave/", {"clave": "cualquiera"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Aún no hay clave", r.data["detail"])
        self.api.force_authenticate(self.admin)
        self.assertFalse(self.api.get("/api/ventas/clave-anulacion/").data["existe"])
        r = self.api.post("/api/ventas/clave-anulacion/", {"clave": "anular123", "repetir_clave": "anular123"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["existe"])
        self.api.force_authenticate(self.recep)
        self.assertEqual(self.api.post("/api/ventas/verificar-clave/", {"clave": "anular123"}, format="json").status_code, 200)
