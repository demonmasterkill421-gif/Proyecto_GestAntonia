"""
Nueva reserva (tarea 1.3 · José).

La recepcionista agenda una hora para un cliente en su local. La regla de «cero topes»
vive en Reserva.clean(): form.is_valid() la ejecuta, aquí no se programa de nuevo.
"""
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido

from .disponibilidad import horarios_libres_cercanos
from .forms import ReservaForm


def _initial_desde_url(request):
    """?cliente=<id> deja a ese cliente preseleccionado (conexión con la pantalla de Cristian)."""
    cliente_id = request.GET.get("cliente", "")
    if cliente_id.isdigit():
        return {"cliente": int(cliente_id)}
    return {}


def _sugerencias(form):
    """Si el formulario falló por un tope de horario, propone horarios libres cercanos."""
    reserva = form.instance
    if form.has_error("inicio") and reserva.inicio and reserva.especialista_id and reserva.servicio_id:
        libres = horarios_libres_cercanos(reserva.especialista, reserva.servicio, reserva.inicio)
        return [
            {"valor": timezone.localtime(h).strftime("%Y-%m-%dT%H:%M"),
             "etiqueta": timezone.localtime(h).strftime("%H:%M")}
            for h in libres
        ]
    return []


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def nueva_reserva(request):
    local = request.user.local 
    if local is None:
        return render(request, "reservas/nueva.html", {"sin_local": True})

    if request.method == "POST":
        form = ReservaForm(request.POST)
    else:
        form = ReservaForm(initial=_initial_desde_url(request))

    form.fields["especialista"].queryset = Usuario.objects.filter(
        rol=Usuario.Rol.TRABAJADOR, local=local, is_active=True
    )
    form.instance.local = local

    sugerencias = []
    if request.method == "POST":
        if form.is_valid():
            reserva = form.save()
            fecha = timezone.localtime(reserva.inicio).date().isoformat()
            return redirect(f"{reverse('reservas:agenda')}?fecha={fecha}")
        sugerencias = _sugerencias(form)

    return render(request, "reservas/nueva.html",
                  {"form": form, "local": local, "sugerencias": sugerencias})