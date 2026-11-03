"""
2.4 Administración de especialistas por local (HU-05). Responsable: Edson Peralta.

Solo la administradora entra. Puede ver las especialistas de cada local, agregar una nueva,
editar sus datos y desactivarla o volver a activarla. No se borran: una especialista desactivada
conserva su historial de reservas, no puede iniciar sesión y no aparece al agendar.
"""
from django.contrib import messages
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from locales.models import Local
from usuarios.models import Usuario
from usuarios.permisos import rol_requerido

from .forms_especialistas import EspecialistaForm, reservas_futuras
from .models import Reserva

SOLO_ADMIN = rol_requerido(Usuario.Rol.ADMINISTRADOR)


@SOLO_ADMIN
def lista_especialistas(request):
    locales = Local.objects.all()
    local_id = request.GET.get("local", "")
    especialistas = (Usuario.objects.filter(rol=Usuario.Rol.TRABAJADOR)
                     .select_related("local")
                     .annotate(futuras=Count("reservas_asignadas", filter=Q(
                         reservas_asignadas__inicio__gte=timezone.now()) & ~Q(
                         reservas_asignadas__estado=Reserva.Estado.CANCELADA)))
                     .order_by("local__nombre", "-is_active", "first_name"))
    if local_id.isdigit():
        especialistas = especialistas.filter(local_id=int(local_id))
    return render(request, "reservas/especialistas/lista.html", {
        "especialistas": especialistas, "locales": locales, "local_id": local_id,
    })


@SOLO_ADMIN
def nueva_especialista(request):
    form = EspecialistaForm(request.POST or None, initial={"local": request.GET.get("local")})
    if request.method == "POST" and form.is_valid():
        e = form.save()
        messages.success(request, f"Especialista {e.get_full_name()} agregada en {e.local}.")
        return redirect("reservas:especialistas")
    return render(request, "reservas/especialistas/form.html", {"form": form, "titulo": "Nueva especialista"})


@SOLO_ADMIN
def editar_especialista(request, pk):
    especialista = get_object_or_404(Usuario, pk=pk, rol=Usuario.Rol.TRABAJADOR)
    form = EspecialistaForm(request.POST or None, instance=especialista)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, f"Datos de {especialista.get_full_name()} actualizados.")
        return redirect("reservas:especialistas")
    return render(request, "reservas/especialistas/form.html",
                  {"form": form, "titulo": f"Editar a {especialista.get_full_name()}", "especialista": especialista})


@require_POST
@SOLO_ADMIN
def cambiar_estado_especialista(request, pk):
    """Desactiva o reactiva. No desactiva si tiene reservas futuras, para no dejar clientes sin atención."""
    especialista = get_object_or_404(Usuario, pk=pk, rol=Usuario.Rol.TRABAJADOR)
    if especialista.is_active:
        futuras = reservas_futuras(especialista).count()
        if futuras:
            messages.error(request, f"{especialista.get_full_name()} tiene {futuras} reserva(s) futura(s). "
                                    "Reprográmelas o cancélelas antes de desactivarla.")
            return redirect("reservas:especialistas")
        especialista.is_active = False
        messages.success(request, f"{especialista.get_full_name()} quedó desactivada.")
    else:
        especialista.is_active = True
        messages.success(request, f"{especialista.get_full_name()} quedó activa otra vez.")
    especialista.save(update_fields=["is_active"])
    return redirect("reservas:especialistas")