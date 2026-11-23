"""Crea el servicio «Otro» (tipo OTRO, precio 0) si todavía no existe.

La venta lo usa para servicios con nombre y precio escritos a mano por la recepcionista (PR #25).
Así no hay que crearlo a mano en cada servidor.
"""
from django.db import migrations


def crear_servicio_otro(apps, schema_editor):
    Servicio = apps.get_model("catalogo", "Servicio")
    if not Servicio.objects.filter(nombre__iexact="Otro", tipo="OTRO").exists():
        Servicio.objects.create(nombre="Otro", tipo="OTRO", precio=0, duracion=60, activo=True)


class Migration(migrations.Migration):

    dependencies = [
        ("catalogo", "0006_precio_por_local"),
    ]

    operations = [
        migrations.RunPython(crear_servicio_otro, migrations.RunPython.noop),
    ]
