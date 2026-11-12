"""Renombra Clienta a Cliente (el centro atiende a mujeres y hombres).

RenameModel y RenameField cambian los nombres de la tabla y de la columna sin borrar datos:
las clientas ya registradas pasan tal cual a la tabla reservas_cliente.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("reservas", "0001_initial"),
    ]

    operations = [
        migrations.RenameModel(old_name="Clienta", new_name="Cliente"),
        migrations.AlterModelOptions(
            name="cliente",
            options={"ordering": ["nombre"], "verbose_name": "cliente", "verbose_name_plural": "clientes"},
        ),
        migrations.RenameField(model_name="reserva", old_name="clienta", new_name="cliente"),
    ]
