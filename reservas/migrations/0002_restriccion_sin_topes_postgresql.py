"""
Restricción «cero topes» en la base de datos (objetivo específico 3 · OWASP A06).

Impide que una especialista tenga dos reservas activas cuyos horarios se crucen, aunque dos
recepcionistas guarden al mismo tiempo. Usa funciones que solo existen en PostgreSQL, por eso
se aplica únicamente cuando la base es PostgreSQL: si alguien usa SQLite para pruebas rápidas,
esta migración no hace nada y el proyecto funciona igual (la validación en Python sigue activa).
"""
from django.db import migrations

CREAR = """
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE reservas_reserva
  ADD CONSTRAINT reserva_sin_topes_por_especialista
  EXCLUDE USING gist (
    especialista_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  )
  WHERE (estado <> 'CANCELADA');
"""

ELIMINAR = "ALTER TABLE reservas_reserva DROP CONSTRAINT IF EXISTS reserva_sin_topes_por_especialista;"


def crear(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(CREAR)


def eliminar(apps, schema_editor):
    if schema_editor.connection.vendor == "postgresql":
        schema_editor.execute(ELIMINAR)


class Migration(migrations.Migration):
    dependencies = [("reservas", "0001_initial")]
    operations = [migrations.RunPython(crear, eliminar)]
