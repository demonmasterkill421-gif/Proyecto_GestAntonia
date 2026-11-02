"""Horarios libres cercanos de una especialista (extra de HU-03, criterio CA-2).

Cuando el bloque pedido está ocupado, la pantalla de nueva reserva sugiere los horarios libres
más cercanos del mismo día, en la grilla de 30 minutos que usa la agenda (informe de diseño, 3.3).
"""
from datetime import datetime, time, timedelta

from django.utils import timezone

from .models import Reserva

PASO = timedelta(minutes=30)
HORA_APERTURA = time(8, 0)
HORA_CIERRE = time(21, 0)


def horarios_libres_cercanos(especialista, servicio, inicio, cantidad=3):
    inicio = timezone.localtime(inicio)
    dia = inicio.date()
    duracion = timedelta(minutes=servicio.duracion)
    abre = timezone.make_aware(datetime.combine(dia, HORA_APERTURA))
    cierra = timezone.make_aware(datetime.combine(dia, HORA_CIERRE))
    ahora = timezone.now()
    ocupadas = list(
        Reserva.objects.filter(especialista=especialista, inicio__date=dia)
        .exclude(estado=Reserva.Estado.CANCELADA)
        .values_list("inicio", "fin")
    )

    libres = []
    candidato = abre
    while candidato + duracion <= cierra:
        fin = candidato + duracion
        choca = any(o_inicio < fin and o_fin > candidato for o_inicio, o_fin in ocupadas)
        if candidato > ahora and candidato != inicio and not choca:
            libres.append(candidato)
        candidato += PASO

    libres.sort(key=lambda c: abs(c - inicio))
    return sorted(libres[:cantidad])