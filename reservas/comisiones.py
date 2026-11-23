"""Comisión de una especialista por un servicio (regla acordada con el local · Edson).

Para Ventas (cálculo de la comisión de cada línea de venta, módulo de Cristóbal):

    from reservas.comisiones import porcentaje_comision
    porcentaje, configurado = porcentaje_comision(detalle.trabajador, detalle.item)

- Si la dueña configuró el % de ese servicio para esa especialista, se usa ese.
- Si no, se usa su comisión base (Usuario.porcentaje_comision) y configurado=False, para que el
  reporte pueda marcar «sin % configurado para este servicio».
- El % que resulte debe GUARDARSE en la venta: si la dueña lo cambia después, los pagos ya hechos no cambian.
"""
from decimal import Decimal

from .models import EspecialistaServicio


def porcentaje_comision(especialista, servicio):
    """Devuelve (porcentaje: Decimal, configurado: bool)."""
    asignado = (EspecialistaServicio.objects
                .filter(especialista=especialista, servicio_id=getattr(servicio, "pk", servicio))
                .values_list("porcentaje_comision", flat=True).first())
    if asignado is not None:
        return Decimal(asignado), True
    return Decimal(especialista.porcentaje_comision or 0), False
