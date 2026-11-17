"""python manage.py cargar_demo_reservas [--fecha AAAA-MM-DD]

Deja lista la demostración del módulo Reservas:

1. Ejecuta cargar_datos_demo (locales, cuentas, servicios y productos del repositorio común).
2. Agrega lo que Reservas necesita para mostrarse: una segunda especialista en el Local Mall,
   una recepcionista en el Local Centro 1 y cinco clientes de prueba.
3. Crea las reservas del día indicado (hoy, si no se indica) y una del día siguiente.

Se puede ejecutar las veces que quiera: cada vez borra las reservas de los clientes de prueba y las
vuelve a crear, así la demo parte siempre igual. No toca reservas de otros clientes.
"""
from datetime import date, datetime, time, timedelta

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from catalogo.models import Servicio
from locales.models import Local
from reservas.models import Cliente, Reserva
from usuarios.management.commands.cargar_datos_demo import CLAVE_DEMO
from usuarios.models import Usuario

CLIENTES_DEMO = [
    ("Valentina Muñoz", "911111111"),
    ("Matías Rojas", "922222222"),
    ("Javiera Soto", "933333333"),
    ("Carolina Díaz", "944444444"),
    ("Benjamín Pérez", "955555555"),
]

# (día: 0 = fecha de la demo, 1 = día siguiente), hora, minuto, especialista, servicio, teléfono del cliente
RESERVAS_DEMO = [
    (0, 10, 0, "fernanda@gestantonia.cl", "Manicura", "911111111"),
    (0, 11, 0, "fernanda@gestantonia.cl", "Esmaltado permanente", "922222222"),   # seguida de la anterior
    (0, 17, 0, "fernanda@gestantonia.cl", "Diseño de uñas N°1", "933333333"),     # 17:00 a 18:30, para el tope
    (0, 10, 30, "camila@gestantonia.cl", "Lifting de pestañas", "933333333"),
    (0, 16, 0, "camila@gestantonia.cl", "Lifting de pestañas", "955555555"),      # se cancela
    (0, 12, 0, "liz@gestantonia.cl", "Depilación de rostro", "944444444"),        # otro local
    (1, 15, 0, "fernanda@gestantonia.cl", "Manicura", "944444444"),
]
CANCELADA = ("camila@gestantonia.cl", 16, "El cliente avisó que no puede asistir.")


class Command(BaseCommand):
    help = "Carga clientes y reservas de prueba para la demostración del módulo Reservas."

    def add_arguments(self, parser):
        parser.add_argument("--fecha", help="Día de la demo en formato AAAA-MM-DD (por defecto, hoy).")

    @transaction.atomic
    def handle(self, *args, **opts):
        try:
            fecha = date.fromisoformat(opts["fecha"]) if opts["fecha"] else timezone.localdate()
        except ValueError:
            raise CommandError("La fecha debe tener el formato AAAA-MM-DD, por ejemplo 2026-11-03.")

        call_command("cargar_datos_demo", stdout=self.stdout)
        mall = Local.objects.get(nombre="Local Mall Plaza Calama")
        centro1 = Local.objects.get(nombre="Local Centro 1")

        self._usuario("camila@gestantonia.cl", "Camila", "Soto", Usuario.Rol.TRABAJADOR, mall,
                      cargo=Usuario.Cargo.COSMETOLOGA, porcentaje_comision=10)
        self._usuario("rocio@gestantonia.cl", "Rocío", "Recepción", Usuario.Rol.RECEPCIONISTA, centro1)

        clientes = {}
        for nombre, telefono in CLIENTES_DEMO:
            clientes[telefono] = Cliente.objects.update_or_create(
                telefono=telefono, defaults={"nombre": nombre, "consentimiento": True})[0]

        borradas, _ = Reserva.objects.filter(cliente__telefono__in=clientes).delete()

        for dia, hora, minuto, correo, servicio, telefono in RESERVAS_DEMO:
            especialista = Usuario.objects.get(email=correo)
            reserva = Reserva(
                local=especialista.local,
                cliente=clientes[telefono],
                especialista=especialista,
                servicio=Servicio.objects.get(nombre=servicio),
                inicio=timezone.make_aware(datetime.combine(fecha + timedelta(days=dia), time(hora, minuto))),
            )
            reserva.full_clean()   # pasa por las mismas reglas que el formulario (cero topes, local)
            reserva.save()
            if (correo, hora) == CANCELADA[:2]:
                reserva.cancelar(CANCELADA[2])

        self.stdout.write(self.style.SUCCESS(
            f"Demo de Reservas lista para el {fecha:%d-%m-%Y}: {len(clientes)} clientes y "
            f"{len(RESERVAS_DEMO)} reservas ({borradas} reservas de prueba anteriores reemplazadas).\n"
            f"Recepcionistas: paola@gestantonia.cl (Local Mall) y rocio@gestantonia.cl (Local Centro 1) · "
            f"clave {CLAVE_DEMO}"))

    @staticmethod
    def _usuario(correo, nombre, apellido, rol, local, **extra):
        u, creado = Usuario.objects.get_or_create(
            email=correo,
            defaults=dict(username=correo, first_name=nombre, last_name=apellido, rol=rol, local=local, **extra),
        )
        if creado:
            u.set_password(CLAVE_DEMO)
            u.save()
        return u
