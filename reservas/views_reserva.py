"""
Pantallas de reservas de José: nueva (1.3), detalle, reprogramar (2.1) y cancelar (2.2).

La recepcionista agenda una hora para un cliente en su local. La regla de «cero topes»
vive en Reserva.clean(): form.is_valid() la ejecuta, aquí no se programa de nuevo.
Las reglas de negocio viven en el modelo (Reserva.clean, reprogramar y cancelar);
las vistas solo piden los datos, llaman al modelo y muestran el resultado.
"""
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_POST

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido

from .disponibilidad import horarios_libres_cercanos
from .forms import CancelarForm, ReprogramarForm, ReservaForm
from .models import Reserva


# ----------------------------------------------------------------- utilidades
def _a_la_agenda(fecha):
    return redirect(f"{reverse('reservas:agenda')}?fecha={fecha.isoformat()}")


def _fecha_local(momento):
    return timezone.localtime(momento).date()


def _reserva_del_local(request, pk):
    """Solo las reservas del local de la usuaria; las de otro local responden 404 (RF-22)."""
    return get_object_or_404(
        Reserva.objects.select_related("cliente", "especialista", "servicio", "local"),
        pk=pk, local=request.user.local,
    )


def _errores_al_formulario(form, campo, error):
    """Pasa un ValidationError del modelo a un campo del formulario."""
    if hasattr(error, "error_dict"):
        mensajes = [m for lista in error.message_dict.values() for m in lista]
    else:
        mensajes = error.messages
    for mensaje in mensajes:
        form.add_error(campo, mensaje)


def _mostrar_detalle(request, reserva, form_reprogramar=None, form_cancelar=None):
    if form_reprogramar is None:
        form_reprogramar = ReprogramarForm(initial={"inicio": reserva.inicio})
    if form_cancelar is None:
        form_cancelar = CancelarForm()
    return render(request, "reservas/detalle.html", {
        "reserva": reserva,
        "form_reprogramar": form_reprogramar,
        "form_cancelar": form_cancelar,
    })


# ------------------------------------------------------------- nueva (1.3)
def _initial_desde_url(request):
    """?cliente=<id> deja a ese cliente preseleccionado (conexión con la pantalla de Cristian)."""
    cliente_id = request.GET.get("cliente", "")
    if cliente_id.isdigit():
        return {"cliente": int(cliente_id)}
    return {}


def _sugerencias(form):
    """Si el formulario falló por un tope de horario, propone horarios libres cercanos."""
    reserva = form.instance
    # Solo el tope (Reserva.clean) marca error en «inicio» con el inicio ya leído.
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
    local = request.user.local  # el local sale de la cuenta, no del formulario (RF-22)
    if local is None:
        # Un administrador sin local asignado no puede agendar: la reserva exige local.
        return render(request, "reservas/nueva.html", {"sin_local": True})

    if request.method == "POST":
        form = ReservaForm(request.POST)
    else:
        form = ReservaForm(initial=_initial_desde_url(request))

    # Solo las especialistas activas del local de la recepcionista (también al validar el POST).
    form.fields["especialista"].queryset = Usuario.objects.filter(
        rol=Usuario.Rol.TRABAJADOR, local=local, is_active=True
    )
    # El local no viene del formulario: se asigna ANTES de is_valid() para que
    # la validación del modelo (especialista del mismo local, topes) lo tenga disponible.
    form.instance.local = local

    sugerencias = []
    if request.method == "POST":
        if form.is_valid():
            reserva = form.save()
            return _a_la_agenda(_fecha_local(reserva.inicio))
        sugerencias = _sugerencias(form)

    return render(request, "reservas/nueva.html",
                  {"form": form, "local": local, "sugerencias": sugerencias})


# ------------------------------------------------- detalle, reprogramar, cancelar
@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def detalle_reserva(request, pk):
    return _mostrar_detalle(request, _reserva_del_local(request, pk))


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
@require_POST
def reprogramar_reserva(request, pk):
    reserva = _reserva_del_local(request, pk)
    form = ReprogramarForm(request.POST)
    if form.is_valid():
        try:
            reserva.reprogramar(form.cleaned_data["inicio"])
        except ValidationError as error:
            _errores_al_formulario(form, "inicio", error)
        else:
            return _a_la_agenda(_fecha_local(reserva.inicio))
    return _mostrar_detalle(request, reserva, form_reprogramar=form)


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
@require_POST
def cancelar_reserva(request, pk):
    reserva = _reserva_del_local(request, pk)
    form = CancelarForm(request.POST)
    if form.is_valid():
        try:
            reserva.cancelar(form.cleaned_data["motivo"])
        except ValidationError as error:
            _errores_al_formulario(form, "motivo", error)
        else:
            return _a_la_agenda(_fecha_local(reserva.inicio))
    return _mostrar_detalle(request, reserva, form_cancelar=form)