"""la recepcionista ve las reservas de su local."""
from datetime import date

from django.shortcuts import render
from django.utils import timezone

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido

from .models import Reserva


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def agenda_del_dia(request):
    try:
        fecha = date.fromisoformat(request.GET.get("fecha", ""))
    except ValueError:
        fecha = timezone.localdate()

    local = request.user.local  # el local sale de la cuenta, no de la dirección (RF-22)
    reservas = (Reserva.objects.filter(local=local, inicio__date=fecha)
                .exclude(estado=Reserva.Estado.CANCELADA)
                .select_related("clienta", "especialista", "servicio"))

    return render(request, "reservas/agenda.html", {"fecha": fecha, "local": local, "reservas": reservas})
