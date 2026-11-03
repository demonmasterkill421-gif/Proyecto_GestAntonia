"""Agenda del día (1.2 · Edson) con bloques ocupados y disponibles (2.3 · Cristian).

La recepcionista ve las reservas de su local en una tabla: una columna por especialista y una
fila por cada bloque de 30 minutos.
"""
from datetime import date, datetime, time, timedelta

from django.db.models import Q
from django.shortcuts import render
from django.utils import timezone
from django.utils.timezone import make_aware

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido

from .models import Reserva

BLOQUE = timedelta(minutes=30)
APERTURA, CIERRE = time(9, 0), time(20, 0)


def _media_hora_anterior(momento):
    """Redondea hacia abajo a la media hora (10:47 → 10:30)."""
    return momento.replace(minute=0 if momento.minute < 30 else 30, second=0, microsecond=0)


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def agenda_del_dia(request):
    # 1. Sacar la fecha del buscador (o poner la de hoy si falla)
    try:
        fecha = date.fromisoformat(request.GET.get("fecha", ""))
    except ValueError:
        fecha = timezone.localdate()

    # 2. Saber en qué local trabaja la recepcionista actual (el local sale de la cuenta, RF-22)
    local = request.user.local

    # 3. Buscar todas las reservas del día en este local (que no estén canceladas)
    reservas_del_dia = list(
        Reserva.objects.filter(local=local, inicio__date=fecha)
        .exclude(estado=Reserva.Estado.CANCELADA)
        .select_related("cliente", "especialista", "servicio")
    )

    # 4. Especialistas del local: las activas (2.4) y también las que tienen reservas ese día,
    #    para no esconder una reserva antigua de alguien que después se desactivó.
    con_reservas = {r.especialista_id for r in reservas_del_dia}
    especialistas = list(
        Usuario.objects.filter(rol=Usuario.Rol.TRABAJADOR, local=local)
        .filter(Q(is_active=True) | Q(pk__in=con_reservas))
        .order_by("first_name")
    )

    # 5. Armar los bloques de 30 min. Van de 09:00 a 20:00, y se amplían si hay
    #    una reserva antes o después de ese horario, para que nunca quede oculta.
    hora_actual = make_aware(datetime.combine(fecha, APERTURA))
    limite = make_aware(datetime.combine(fecha, CIERRE)) + BLOQUE      # el último bloque es el de las 20:00
    if reservas_del_dia:
        hora_actual = min(hora_actual, _media_hora_anterior(timezone.localtime(reservas_del_dia[0].inicio)))
        limite = max(limite, max(timezone.localtime(r.fin) for r in reservas_del_dia))

    bloques = []
    while hora_actual < limite:
        fin_bloque = hora_actual + BLOQUE
        fila = {"hora_texto": hora_actual.strftime("%H:%M"), "celdas": []}

        # Revisamos si cada especialista está libre u ocupada en este bloque
        for esp in especialistas:
            reserva = next(
                # Ocupado si la reserva se cruza con el bloque, aunque empiece o termine a mitad de él
                (r for r in reservas_del_dia
                 if r.especialista_id == esp.pk and r.inicio < fin_bloque and r.fin > hora_actual),
                None,
            )
            if reserva:
                fila["celdas"].append({"estado": "Ocupado", "reserva": reserva})
            else:
                fila["celdas"].append({"estado": "Libre", "reserva": None})

        bloques.append(fila)
        hora_actual = fin_bloque

    contexto = {
        "fecha": fecha,
        "local": local,
        "especialistas": especialistas,
        "bloques": bloques,
    }
    return render(request, "reservas/agenda.html", contexto)
