"""Servicios que realiza cada especialista y su comisión en cada uno (regla acordada con el local · Edson)."""
from decimal import Decimal

from rest_framework import status

from catalogo.models import Servicio
from reservas.comisiones import porcentaje_comision
from reservas.models import EspecialistaServicio
from usuarios.models import Usuario

from .test_api import API, BaseAPI, iso, manana


class BaseServicios(BaseAPI):
    def setUp(self):
        super().setUp()
        self.manicura = Servicio.objects.create(nombre="Manicura", precio=12000, tipo=Servicio.Tipo.MANICURE, duracion=60)
        self.depilacion = Servicio.objects.create(nombre="Depilación", precio=8000,
                                                  tipo=Servicio.Tipo.DEPILACION, duracion=30)

    def asignar(self, especialista, servicio, porcentaje):
        return EspecialistaServicio.objects.create(especialista=especialista, servicio=servicio,
                                                   porcentaje_comision=porcentaje)

    def nueva(self, servicios):
        return {"nombre": "Javiera", "apellido": "Rojas", "email": "javiera@x.cl", "local": self.mall.pk,
                "cargo": "MANICURISTA", "porcentaje_comision": "10", "clave": "Una-clave-segura-1",
                "servicios": servicios}


class AsignarServiciosTests(BaseServicios):
    def test_al_crear_se_guarda_un_porcentaje_por_servicio(self):
        self.como(self.admin)
        r = self.client.post(API + "especialistas/", self.nueva([
            {"servicio": self.manicura.pk, "porcentaje_comision": "5"},
            {"servicio": self.depilacion.pk, "porcentaje_comision": "12"}]), format="json")
        self.assertEqual(r.status_code, 201, r.data)
        javiera = Usuario.objects.get(email="javiera@x.cl")
        pares = dict(javiera.servicios_asignados.values_list("servicio__nombre", "porcentaje_comision"))
        self.assertEqual(pares, {"Manicura": Decimal("5"), "Depilación": Decimal("12")})

    def test_al_crear_exige_al_menos_un_servicio(self):
        self.como(self.admin)
        datos = self.nueva([])
        del datos["servicios"]
        r = self.client.post(API + "especialistas/", datos, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("servicios", r.data)

    def test_rechaza_repetidos_y_porcentajes_fuera_de_rango(self):
        self.como(self.admin)
        r = self.client.post(API + "especialistas/", self.nueva([
            {"servicio": self.manicura.pk, "porcentaje_comision": "5"},
            {"servicio": self.manicura.pk, "porcentaje_comision": "8"}]), format="json")
        self.assertEqual(r.status_code, 400)
        r = self.client.post(API + "especialistas/", self.nueva([
            {"servicio": self.manicura.pk, "porcentaje_comision": "120"}]), format="json")
        self.assertEqual(r.status_code, 400)

    def test_dos_especialistas_cobran_distinto_por_el_mismo_servicio(self):
        self.asignar(self.camila, self.manicura, 5)
        self.asignar(self.fernanda, self.manicura, 15)
        self.assertEqual(porcentaje_comision(self.camila, self.manicura), (Decimal("5"), True))
        self.assertEqual(porcentaje_comision(self.fernanda, self.manicura), (Decimal("15"), True))

    def test_editar_agrega_quita_y_cambia_porcentajes(self):
        self.camila.last_name, self.camila.cargo = "Soto", Usuario.Cargo.MANICURISTA
        self.camila.save()
        self.asignar(self.camila, self.manicura, 5)
        self.como(self.admin)
        r = self.client.patch(f"{API}especialistas/{self.camila.pk}/", {"servicios": [
            {"servicio": self.depilacion.pk, "porcentaje_comision": "20"}]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([s["servicio_nombre"] for s in r.data["servicios"]], ["Depilación"])

    def test_no_quita_un_servicio_con_reservas_futuras(self):
        self.camila.last_name, self.camila.cargo = "Soto", Usuario.Cargo.MANICURISTA
        self.camila.save()
        self.asignar(self.camila, self.lifting, 10)
        self.asignar(self.camila, self.manicura, 5)
        self.reservar(self.camila, manana(11))                         # 2 reservas de Lifting
        self.reservar(self.camila, manana(15))
        self.como(self.admin)
        r = self.client.patch(f"{API}especialistas/{self.camila.pk}/", {"servicios": [
            {"servicio": self.manicura.pk, "porcentaje_comision": "5"}]}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Lifting", r.data["servicios"][0])
        self.assertEqual(r.data["servicios"][0].count("Lifting"), 1)  # el nombre no se repite por cada reserva

    def test_la_recepcionista_ve_los_servicios_pero_no_las_comisiones(self):
        self.asignar(self.camila, self.manicura, 5)
        self.como(self.paola)
        r = self.client.get(f"{API}especialistas/{self.camila.pk}/")
        self.assertEqual(r.data["servicios"], [{"servicio": self.manicura.pk, "servicio_nombre": "Manicura"}])
        self.como(self.admin)
        r = self.client.get(f"{API}especialistas/{self.camila.pk}/")
        self.assertEqual(r.data["servicios"][0]["porcentaje_comision"], "5.00")


class AgendarSoloServiciosAsignadosTests(BaseServicios):
    def test_no_agenda_un_servicio_que_la_especialista_no_realiza(self):
        self.asignar(self.camila, self.manicura, 5)
        self.como(self.paola)
        r = self.client.post(API + "reservas/", self.datos_reserva(servicio=self.depilacion.pk), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("servicio", r.data)
        r = self.client.post(API + "reservas/", self.datos_reserva(servicio=self.manicura.pk), format="json")
        self.assertEqual(r.status_code, 201, r.data)

    def test_especialista_sin_servicios_asignados_puede_agendar_cualquiera(self):
        self.como(self.paola)                                          # especialistas creadas antes del cambio
        r = self.client.post(API + "reservas/", self.datos_reserva(servicio=self.depilacion.pk), format="json")
        self.assertEqual(r.status_code, 201, r.data)


class ComisionSinConfigurarTests(BaseServicios):
    def test_usa_la_comision_base_y_avisa(self):
        self.camila.porcentaje_comision = Decimal("10")
        self.camila.save()
        self.asignar(self.camila, self.manicura, 5)
        self.assertEqual(porcentaje_comision(self.camila, self.depilacion), (Decimal("10"), False))
        self.assertEqual(porcentaje_comision(self.camila, self.manicura.pk), (Decimal("5"), True))
