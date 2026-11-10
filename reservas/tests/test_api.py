"""Pruebas de la API REST de Reservas (2.17 · Edson). Cristian las amplía en la tarea 2.7."""
from datetime import datetime, time, timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from catalogo.models import Servicio
from locales.models import Local
from reservas.models import Cliente, Reserva
from usuarios.models import Usuario

CLAVE = "Clave-de-prueba-1"
API = "/api/reservas/"


def manana(hora, minuto=0):
    dia = timezone.localdate() + timedelta(days=1)
    return timezone.make_aware(datetime.combine(dia, time(hora, minuto)))


def iso(dt):
    return timezone.localtime(dt).strftime("%Y-%m-%dT%H:%M")


class BaseAPI(APITestCase):
    def setUp(self):
        self.mall = Local.objects.create(nombre="Local Mall", ubicacion="Mall Plaza Calama")
        self.centro = Local.objects.create(nombre="Local Centro", ubicacion="Centro de Calama")
        self.lifting = Servicio.objects.create(nombre="Lifting", precio=25000, tipo=Servicio.Tipo.LIFTING, duracion=60)
        self.retirado = Servicio.objects.create(nombre="Servicio antiguo", precio=1000,
                                                tipo=Servicio.Tipo.LIFTING, duracion=30, activo=False)
        self.camila = self.usuario("camila", Usuario.Rol.TRABAJADOR, self.mall, first_name="Camila")
        self.fernanda = self.usuario("fernanda", Usuario.Rol.TRABAJADOR, self.mall, first_name="Fernanda")
        self.liz = self.usuario("liz", Usuario.Rol.TRABAJADOR, self.centro, first_name="Liz")
        self.paola = self.usuario("paola", Usuario.Rol.RECEPCIONISTA, self.mall)
        self.rocio = self.usuario("rocio", Usuario.Rol.RECEPCIONISTA, self.centro)
        self.admin = self.usuario("admin", Usuario.Rol.ADMINISTRADOR, None)
        self.maria = Cliente.objects.create(nombre="María González", telefono="+56987654321", consentimiento=True)

    def usuario(self, nombre, rol, local, **extra):
        return Usuario.objects.create_user(username=nombre, email=f"{nombre}@x.cl", password=CLAVE,
                                           rol=rol, local=local, **extra)

    def reservar(self, especialista, inicio, **extra):
        return Reserva.objects.create(local=especialista.local, cliente=self.maria, especialista=especialista,
                                      servicio=self.lifting, inicio=inicio, **extra)

    def como(self, usuario):
        self.client.force_authenticate(usuario)

    def datos_reserva(self, especialista=None, inicio=None, **extra):
        return {"cliente": self.maria.pk, "especialista": (especialista or self.camila).pk,
                "servicio": self.lifting.pk, "inicio": iso(inicio or manana(11)), **extra}


# =================================================================== acceso
class AccesoTests(BaseAPI):
    def test_sin_token_responde_401(self):
        r = self.client.get(API + "agenda/")
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_trabajadora_recibe_403(self):
        self.como(self.camila)
        for ruta in ("agenda/", "reservas/", "servicios/", "especialistas/", "clientes/?telefono=1"):
            self.assertEqual(self.client.get(API + ruta).status_code, status.HTTP_403_FORBIDDEN, ruta)

    def test_funciona_con_el_token_jwt_del_login(self):
        r = self.client.post("/api/login/", {"email": "paola@x.cl", "password": CLAVE}, format="json")
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        self.assertEqual(self.client.get(API + "agenda/").status_code, 200)


# =================================================================== agenda
class AgendaAPITests(BaseAPI):
    def test_bloques_de_30_min_de_9_a_20_con_la_reserva_ocupada(self):
        self.reservar(self.camila, manana(11))
        self.como(self.paola)
        r = self.client.get(API + "agenda/", {"fecha": manana(0).date().isoformat()})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["local"]["id"], self.mall.pk)
        horas = [b["hora"] for b in r.data["bloques"]]
        self.assertEqual(horas[0], "09:00")
        self.assertEqual(horas[-1], "20:00")
        self.assertEqual(len(horas), 23)
        ids = [e["id"] for e in r.data["especialistas"]]
        self.assertEqual(set(ids), {self.camila.pk, self.fernanda.pk})      # Liz es de otro local
        bloque_11 = r.data["bloques"][horas.index("11:00")]
        celda = next(c for c in bloque_11["celdas"] if c["especialista"] == self.camila.pk)
        self.assertEqual(celda["estado"], "OCUPADO")
        self.assertEqual(celda["reserva"]["cliente_nombre"], "María González")
        libre = next(c for c in bloque_11["celdas"] if c["especialista"] == self.fernanda.pk)
        self.assertEqual(libre["estado"], "LIBRE")

    def test_fecha_mal_escrita_responde_400(self):
        self.como(self.paola)
        self.assertEqual(self.client.get(API + "agenda/", {"fecha": "09-11-2026"}).status_code, 400)

    def test_recepcionista_no_puede_ver_otro_local(self):
        self.como(self.paola)
        r = self.client.get(API + "agenda/", {"local": self.centro.pk})
        self.assertEqual(r.data["local"]["id"], self.mall.pk)               # se ignora ?local=

    def test_administradora_elige_el_local(self):
        self.como(self.admin)
        self.assertEqual(self.client.get(API + "agenda/").status_code, 400)  # sin local asignado
        r = self.client.get(API + "agenda/", {"local": self.centro.pk})
        self.assertEqual(r.status_code, 200)
        self.assertEqual([e["id"] for e in r.data["especialistas"]], [self.liz.pk])


# =================================================================== reservas
class ReservaAPITests(BaseAPI):
    def test_crea_la_reserva_en_el_local_de_la_cuenta_y_calcula_el_fin(self):
        self.como(self.paola)
        r = self.client.post(API + "reservas/", self.datos_reserva(local=self.centro.pk), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        reserva = Reserva.objects.get()
        self.assertEqual(reserva.local, self.mall)                          # no el que vino en el JSON
        self.assertEqual(reserva.fin, manana(12))
        self.assertEqual(r.data["estado"], "AGENDADA")
        self.assertEqual(r.data["especialista_nombre"], "Camila")

    def test_tope_responde_400_con_horarios_sugeridos(self):
        self.reservar(self.camila, manana(11))
        self.como(self.paola)
        r = self.client.post(API + "reservas/", self.datos_reserva(inicio=manana(11, 30)), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("inicio", r.data)
        self.assertTrue(r.data["sugerencias"])
        for texto in r.data["sugerencias"]:
            inicio = datetime.fromisoformat(texto)
            self.assertFalse(inicio < manana(12) and inicio + timedelta(minutes=60) > manana(11))
        self.assertEqual(Reserva.objects.count(), 1)

    def test_bloque_seguido_si_se_guarda(self):
        self.reservar(self.camila, manana(11))
        self.como(self.paola)
        r = self.client.post(API + "reservas/", self.datos_reserva(inicio=manana(12)), format="json")
        self.assertEqual(r.status_code, 201, r.data)

    def test_no_acepta_especialista_de_otro_local(self):
        self.como(self.paola)
        r = self.client.post(API + "reservas/", self.datos_reserva(especialista=self.liz), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("especialista", r.data)
        self.assertNotIn("sugerencias", r.data)

    def test_no_acepta_especialista_inactiva_ni_servicio_retirado(self):
        self.fernanda.is_active = False
        self.fernanda.save()
        self.como(self.paola)
        r = self.client.post(API + "reservas/", self.datos_reserva(especialista=self.fernanda), format="json")
        self.assertIn("especialista", r.data)
        datos = self.datos_reserva()
        datos["servicio"] = self.retirado.pk
        r = self.client.post(API + "reservas/", datos, format="json")
        self.assertIn("servicio", r.data)
        self.assertFalse(Reserva.objects.exists())

    def test_administradora_sin_local_agenda_en_el_local_de_la_especialista(self):
        self.como(self.admin)
        r = self.client.post(API + "reservas/", self.datos_reserva(especialista=self.liz), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Reserva.objects.get().local, self.centro)

    def test_lista_solo_las_del_local_y_filtra_por_fecha(self):
        propia = self.reservar(self.camila, manana(11))
        self.reservar(self.camila, manana(11) + timedelta(days=1))
        self.reservar(self.liz, manana(11))
        self.como(self.paola)
        r = self.client.get(API + "reservas/", {"fecha": manana(0).date().isoformat()})
        self.assertEqual([x["id"] for x in r.data], [propia.pk])
        self.como(self.admin)
        self.assertEqual(len(self.client.get(API + "reservas/").data), 3)
        self.assertEqual(len(self.client.get(API + "reservas/", {"local": self.centro.pk}).data), 1)

    def test_detalle_de_otro_local_responde_404(self):
        ajena = self.reservar(self.liz, manana(11))
        self.como(self.paola)
        self.assertEqual(self.client.get(f"{API}reservas/{ajena.pk}/").status_code, 404)

    def test_no_se_edita_ni_se_borra_por_la_api(self):
        reserva = self.reservar(self.camila, manana(11))
        self.como(self.paola)
        url = f"{API}reservas/{reserva.pk}/"
        self.assertEqual(self.client.delete(url).status_code, 405)
        self.assertEqual(self.client.put(url, {}, format="json").status_code, 405)


class ReprogramarCancelarAPITests(BaseAPI):
    def test_reprogramar_mueve_la_hora(self):
        reserva = self.reservar(self.camila, manana(11))
        self.como(self.paola)
        r = self.client.post(f"{API}reservas/{reserva.pk}/reprogramar/", {"inicio": iso(manana(15))}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        reserva.refresh_from_db()
        self.assertEqual((reserva.inicio, reserva.fin), (manana(15), manana(16)))

    def test_reprogramar_a_un_tope_responde_400_con_sugerencias_y_no_cambia(self):
        self.reservar(self.camila, manana(15))
        reserva = self.reservar(self.camila, manana(11))
        self.como(self.paola)
        r = self.client.post(f"{API}reservas/{reserva.pk}/reprogramar/", {"inicio": iso(manana(15))}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("sugerencias", r.data)
        reserva.refresh_from_db()
        self.assertEqual(reserva.inicio, manana(11))

    def test_no_reprograma_una_cancelada(self):
        reserva = self.reservar(self.camila, manana(11), estado=Reserva.Estado.CANCELADA)
        self.como(self.paola)
        r = self.client.post(f"{API}reservas/{reserva.pk}/reprogramar/", {"inicio": iso(manana(15))}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("detail", r.data)

    def test_cancelar_con_motivo(self):
        reserva = self.reservar(self.camila, manana(11))
        self.como(self.paola)
        r = self.client.post(f"{API}reservas/{reserva.pk}/cancelar/", {"motivo": "Avisó por WhatsApp"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["estado"], "CANCELADA")
        self.assertEqual(r.data["motivo_cancelacion"], "Avisó por WhatsApp")

    def test_cancelar_sin_motivo_responde_400(self):
        reserva = self.reservar(self.camila, manana(11))
        self.como(self.paola)
        r = self.client.post(f"{API}reservas/{reserva.pk}/cancelar/", {"motivo": "  "}, format="json")
        self.assertEqual(r.status_code, 400)
        reserva.refresh_from_db()
        self.assertEqual(reserva.estado, Reserva.Estado.AGENDADA)

    def test_no_cancela_reservas_de_otro_local(self):
        ajena = self.reservar(self.liz, manana(11))
        self.como(self.paola)
        r = self.client.post(f"{API}reservas/{ajena.pk}/cancelar/", {"motivo": "x"}, format="json")
        self.assertEqual(r.status_code, 404)


# =================================================================== clientes y servicios
class ClienteAPITests(BaseAPI):
    def test_busca_por_telefono_aunque_venga_con_espacios(self):
        self.como(self.paola)
        r = self.client.get(API + "clientes/", {"telefono": "+56 9 8765 4321"})
        self.assertEqual([c["id"] for c in r.data], [self.maria.pk])

    def test_sin_telefono_no_lista_la_base_completa(self):
        self.como(self.paola)
        self.assertEqual(self.client.get(API + "clientes/").status_code, 400)

    def test_crea_cliente_con_telefono_limpio_y_conserva_el_mas(self):
        self.como(self.paola)
        r = self.client.post(API + "clientes/", {"nombre": "Ana", "telefono": "+56 9 1234-5678",
                                                 "consentimiento": True}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Cliente.objects.get(nombre="Ana").telefono, "+56912345678")

    def test_exige_consentimiento(self):
        self.como(self.paola)
        r = self.client.post(API + "clientes/", {"nombre": "Ana", "telefono": "912345678",
                                                 "consentimiento": False}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("consentimiento", r.data)

    def test_telefono_repetido_aunque_venga_con_otro_formato(self):
        self.como(self.paola)
        r = self.client.post(API + "clientes/", {"nombre": "Otra", "telefono": "+56 9 8765-4321",
                                                 "consentimiento": True}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("telefono", r.data)


class ServicioAPITests(BaseAPI):
    def test_solo_servicios_vigentes_con_duracion(self):
        self.como(self.paola)
        r = self.client.get(API + "servicios/")
        self.assertEqual([s["nombre"] for s in r.data], ["Lifting"])
        self.assertEqual(r.data[0]["duracion"], 60)


class LocalAPITests(BaseAPI):
    def test_lista_los_locales_con_id_y_nombre(self):
        self.como(self.paola)
        r = self.client.get(API + "locales/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([l["nombre"] for l in r.data], ["Local Centro", "Local Mall"])
        self.assertEqual(set(r.data[0]), {"id", "nombre", "ubicacion", "estado"})

    def test_trabajadora_no_entra_y_no_se_pueden_crear_locales(self):
        self.como(self.camila)
        self.assertEqual(self.client.get(API + "locales/").status_code, 403)
        self.como(self.admin)
        self.assertEqual(self.client.post(API + "locales/", {"nombre": "Nuevo"}, format="json").status_code, 405)


# =================================================================== especialistas
class EspecialistaAPITests(BaseAPI):
    def nueva(self, **extra):
        return {"nombre": "Javiera", "apellido": "Rojas", "email": "javiera@x.cl", "local": self.mall.pk,
                "cargo": "MANICURISTA", "porcentaje_comision": "40", "clave": "Una-clave-segura-1", **extra}

    def test_administradora_crea_una_especialista_que_puede_iniciar_sesion(self):
        self.como(self.admin)
        r = self.client.post(API + "especialistas/", self.nueva(), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertNotIn("clave", r.data)
        javiera = Usuario.objects.get(email="javiera@x.cl")
        self.assertEqual((javiera.rol, javiera.username), (Usuario.Rol.TRABAJADOR, "javiera@x.cl"))
        self.assertTrue(javiera.check_password("Una-clave-segura-1"))

    def test_clave_debil_y_sin_local_se_rechazan(self):
        self.como(self.admin)
        r = self.client.post(API + "especialistas/", self.nueva(clave="123", local=None), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("clave", r.data)
        self.assertIn("local", r.data)

    def test_recepcionista_solo_lee_las_activas_de_su_local(self):
        self.fernanda.is_active = False
        self.fernanda.save()
        self.como(self.paola)
        r = self.client.get(API + "especialistas/")
        self.assertEqual([e["id"] for e in r.data], [self.camila.pk])
        self.assertEqual(self.client.post(API + "especialistas/", self.nueva(), format="json").status_code, 403)
        self.assertEqual(self.client.post(f"{API}especialistas/{self.camila.pk}/desactivar/").status_code, 403)

    def test_administradora_filtra_por_local_y_edita_con_patch(self):
        self.liz.last_name, self.liz.cargo = "Soto", Usuario.Cargo.DEPILADORA   # el formulario los exige
        self.liz.save()
        self.como(self.admin)
        r = self.client.get(API + "especialistas/", {"local": self.centro.pk})
        self.assertEqual([e["id"] for e in r.data], [self.liz.pk])
        r = self.client.patch(f"{API}especialistas/{self.liz.pk}/", {"porcentaje_comision": "35"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.liz.refresh_from_db()
        self.assertEqual(str(self.liz.porcentaje_comision), "35.00")

    def test_no_cambia_de_local_ni_desactiva_con_reservas_futuras(self):
        self.reservar(self.camila, manana(11))
        self.como(self.admin)
        r = self.client.patch(f"{API}especialistas/{self.camila.pk}/", {"local": self.centro.pk}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("local", r.data)
        r = self.client.post(f"{API}especialistas/{self.camila.pk}/desactivar/")
        self.assertEqual(r.status_code, 400)
        self.camila.refresh_from_db()
        self.assertTrue(self.camila.is_active)
        self.assertEqual(self.camila.local, self.mall)

    def test_desactivar_y_activar(self):
        self.como(self.admin)
        r = self.client.post(f"{API}especialistas/{self.fernanda.pk}/desactivar/")
        self.assertEqual((r.status_code, r.data["activa"]), (200, False))
        r = self.client.post(f"{API}especialistas/{self.fernanda.pk}/activar/")
        self.assertEqual((r.status_code, r.data["activa"]), (200, True))

    def test_no_se_borran(self):
        self.como(self.admin)
        self.assertEqual(self.client.delete(f"{API}especialistas/{self.fernanda.pk}/").status_code, 405)
