"""Crea ventas de prueba en la BD local para visualizar reportes con datos persistentes.

Ejecutar SOLO en una base de desarrollo. Es idempotente por descripción/local/fecha.
"""
from datetime import datetime, time, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from catalogo.models import Servicio
from locales.models import Local
from usuarios.models import Usuario
from ventas.models import RegistroDeVenta


class Command(BaseCommand):
    help = "Carga ventas ficticias recientes para Panel de control; solo con DEBUG=True."

    @transaction.atomic
    def handle(self, *args, **kwargs):
        if not settings.DEBUG:
            raise CommandError("La carga de prueba requiere DJANGO_DEBUG=True.")

        locales = list(Local.objects.all().order_by("pk"))
        servicio = Servicio.objects.first()
        admin_o_recepcionista = Usuario.objects.filter(
            rol__in=[Usuario.Rol.ADMINISTRADOR, Usuario.Rol.RECEPCIONISTA], is_active=True
        ).first()
        if not locales or servicio is None or admin_o_recepcionista is None:
            raise CommandError("Primero ejecuta python manage.py cargar_datos_demo.")

        hoy = timezone.localdate()
        total = 0
        for local in locales:
            recepcionista = (Usuario.objects.filter(
                rol=Usuario.Rol.RECEPCIONISTA, local=local, is_active=True
            ).first() or admin_o_recepcionista)
            trabajadora = Usuario.objects.filter(
                rol=Usuario.Rol.TRABAJADOR, local=local, is_active=True
            ).first()
            for dias_atras in range(10):
                dia = hoy - timedelta(days=dias_atras)
                marca = f"DASHBOARD-PRUEBA-{local.pk}-{dia.isoformat()}"
                if RegistroDeVenta.objects.filter(local=local, descripcion=marca).exists():
                    continue
                fecha = timezone.make_aware(datetime.combine(dia, time(12, 0)))
                venta = RegistroDeVenta.objects.create(
                    local=local, recepcionista=recepcionista, trabajador=trabajadora,
                    descripcion=marca, estado=RegistroDeVenta.Estado.BORRADOR,
                )
                venta.agregar_item(servicio, cantidad=1 + (dias_atras % 3))
                venta.confirmar_venta()
                # Fecha de venta para la demostración de un período; sin alterar lógica de stock.
                RegistroDeVenta.objects.filter(pk=venta.pk).update(fecha=fecha)
                total += 1

        self.stdout.write(self.style.SUCCESS(
            f"Ventas ficticias nuevas: {total}. Repetir el comando no duplica registros."
        ))
