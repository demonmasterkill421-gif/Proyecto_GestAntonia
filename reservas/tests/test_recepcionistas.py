"""Recepcionistas desde React: crear, editar, cambiar de local, desactivar y activar (personal · Edson)."""
from django.core.cache import cache
from rest_framework import status

from usuarios.models import Usuario

from .test_api import API, CLAVE, BaseAPI

URL = API + "recepcionistas/"


class RecepcionistasTests(BaseAPI):
    def setUp(self):
        super().setUp()
        cache.clear()                     # el bloqueo de intentos de login usa la caché

    def nueva(self, **cambios):
        datos = {"nombre": "Daniela", "apellido": "Rojas", "email": "Daniela@X.cl", "local": self.mall.pk,
                 "clave": "Una-clave-segura-1"}
        datos.update(cambios)
        return datos

    def test_solo_la_administradora(self):
        for usuario in (self.paola, self.camila):
            self.como(usuario)
            self.assertEqual(self.client.get(URL).status_code, status.HTTP_403_FORBIDDEN)
            self.assertEqual(self.client.post(URL, self.nueva(), format="json").status_code,
                             status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_lista_solo_recepcionistas_y_filtra_por_local(self):
        self.como(self.admin)
        r = self.client.get(URL)
        self.assertEqual({x["email"] for x in r.data}, {"paola@x.cl", "rocio@x.cl"})   # sin especialistas ni admin
        r = self.client.get(URL, {"local": self.centro.pk})
        self.assertEqual([x["email"] for x in r.data], ["rocio@x.cl"])

    def test_crea_una_recepcionista_que_puede_iniciar_sesion(self):
        self.como(self.admin)
        r = self.client.post(URL, self.nueva(), format="json")
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertNotIn("clave", r.data)
        daniela = Usuario.objects.get(email="daniela@x.cl")             # el correo se guarda en minúsculas
        self.assertEqual(daniela.rol, Usuario.Rol.RECEPCIONISTA)
        self.assertEqual(daniela.local, self.mall)
        self.client.force_authenticate(None)
        r = self.client.post("/api/login/", {"email": "daniela@x.cl", "password": "Una-clave-segura-1"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)

    def test_valida_campos_correo_repetido_y_clave_segura(self):
        self.como(self.admin)
        r = self.client.post(URL, {"email": "sin-datos@x.cl"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        for campo in ("nombre", "apellido", "local", "clave"):
            self.assertIn(campo, r.data)
        r = self.client.post(URL, self.nueva(email="camila@x.cl"), format="json")    # ya lo usa una especialista
        self.assertIn("ya lo usa otra persona", str(r.data["email"]))
        r = self.client.post(URL, self.nueva(clave="123"), format="json")
        self.assertIn("clave", r.data)

    def test_edita_y_cambia_de_local_sin_pedir_clave(self):
        self.como(self.admin)
        r = self.client.patch(f"{URL}{self.paola.pk}/", {"nombre": "Paola", "apellido": "Muñoz", "local": self.centro.pk}, format="json")
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.paola.refresh_from_db()
        self.assertEqual((self.paola.last_name, self.paola.local), ("Muñoz", self.centro))
        self.assertTrue(self.paola.check_password(CLAVE))                # la clave no cambió

    def test_no_edita_especialistas_por_esta_ruta(self):
        self.como(self.admin)
        r = self.client.patch(f"{URL}{self.camila.pk}/", {"apellido": "X"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_desactivada_no_inicia_sesion_y_al_activarla_vuelve(self):
        self.como(self.admin)
        r = self.client.post(f"{URL}{self.paola.pk}/desactivar/")
        self.assertFalse(r.data["activa"])
        self.client.force_authenticate(None)
        datos = {"email": "paola@x.cl", "password": CLAVE}
        self.assertEqual(self.client.post("/api/login/", datos, format="json").status_code,
                         status.HTTP_401_UNAUTHORIZED)
        self.como(self.admin)
        self.client.post(f"{URL}{self.paola.pk}/activar/")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post("/api/login/", datos, format="json").status_code, status.HTTP_200_OK)
