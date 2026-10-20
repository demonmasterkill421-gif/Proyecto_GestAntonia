"""Agenda del día (tarea 1.2 · Edson). La recepcionista ve solo su local; la administradora elige el local."""
from datetime import date, timedelta

from django.shortcuts import render
from django.utils import timezone

from locales.models import Local
from usuarios.models import Usuario
from usuarios.permisos import rol_requerido

from .models import Reserva


def _leer_fecha(texto):
    """Lee ?fecha=AAAA-MM-DD; si viene vacía o mal escrita, usa el día de hoy."""
    try:
        return date.fromisoformat(texto)
    except (TypeError, ValueError):
        return timezone.localdate()


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def agenda_del_dia(request):
    usuario = request.user
    fecha = _leer_fecha(request.GET.get("fecha"))
    locales = []

    if usuario.es_administrador:
        # La administradora ve los tres locales: elige cuál mirar con ?local=<id>.
        locales = list(Local.objects.filter(estado=Local.Estado.ACTIVO))
        local_id = request.GET.get("local")
        local = next((l for l in locales if str(l.pk) == local_id), locales[0] if locales else None)
    else:
        # La recepcionista solo ve su local (RF-22). Se ignora cualquier ?local= que envíe.
        local = usuario.local

    grupos = []
    total = 0
    if local is not None:
        reservas = (Reserva.objects.activas().del_local(local).del_dia(fecha)
                    .select_related("clienta", "servicio", "especialista"))
        especialistas = list(local.trabajadores.order_by("first_name"))
        # Una fila por especialista del local, aunque no tenga reservas ese día.
        por_especialista = {e.pk: [] for e in especialistas}
        for r in reservas:
            por_especialista.setdefault(r.especialista_id, []).append(r)
            if r.especialista not in especialistas:
                especialistas.append(r.especialista)
            total += 1
        grupos = [(e, por_especialista.get(e.pk, [])) for e in especialistas]

    return render(request, "reservas/agenda.html", {
        "fecha": fecha,
        "hoy": timezone.localdate(),
        "anterior": fecha - timedelta(days=1),
        "siguiente": fecha + timedelta(days=1),
        "local": local,
        "locales": locales,
        "grupos": grupos,
        "total": total,
    })
