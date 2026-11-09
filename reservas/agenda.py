"""Agenda del día como datos (para la API, 2.17 · Edson).

Arma la misma grilla que la pantalla Django de views.agenda_del_dia: una columna por especialista
del local y una fila por bloque de 30 minutos entre APERTURA y CIERRE, ampliada si hay reservas
fuera de ese horario. Usa las mismas constantes y el mismo redondeo de views.py, así que si cambia
el horario de atención allá, cambia también en la API.
"""
from datetime import datetime

from django.db.models import Q
from django.utils import timezone

from usuarios.models import Usuario

from .models import Reserva
from .views import APERTURA, BLOQUE, CIERRE, _media_hora_anterior


def armar_agenda(local, fecha):
    """Devuelve (especialistas, bloques). Cada bloque: {"inicio", "fin", "celdas": [(especialista, reserva|None)]}."""
    reservas = list(
        Reserva.objects.filter(local=local, inicio__date=fecha)
        .exclude(estado=Reserva.Estado.CANCELADA)
        .select_related("cliente", "especialista", "servicio")
    )
    # Activas, más las inactivas que tengan reservas ese día (para no esconder una reserva).
    con_reservas = {r.especialista_id for r in reservas}
    especialistas = list(
        Usuario.objects.filter(rol=Usuario.Rol.TRABAJADOR, local=local)
        .filter(Q(is_active=True) | Q(pk__in=con_reservas))
        .order_by("first_name")
    )

    hora = timezone.make_aware(datetime.combine(fecha, APERTURA))
    limite = timezone.make_aware(datetime.combine(fecha, CIERRE)) + BLOQUE
    if reservas:
        hora = min(hora, _media_hora_anterior(timezone.localtime(reservas[0].inicio)))
        limite = max(limite, max(timezone.localtime(r.fin) for r in reservas))

    bloques = []
    while hora < limite:
        fin = hora + BLOQUE
        celdas = []
        for esp in especialistas:
            reserva = next((r for r in reservas
                            if r.especialista_id == esp.pk and r.inicio < fin and r.fin > hora), None)
            celdas.append((esp, reserva))
        bloques.append({"inicio": hora, "fin": fin, "celdas": celdas})
        hora = fin
    return especialistas, bloques
