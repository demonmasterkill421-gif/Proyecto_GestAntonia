from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from asistencia.models import RegistroDeAsistencia

from .models import Usuario
from .permisos import rol_requerido


@login_required
def inicio(request):
    """Redirige a cada usuario al panel de su rol después de iniciar sesión (EA_001)."""
    u = request.user
    if u.es_administrador:
        return redirect("usuarios:panel_administrador")
    if u.es_recepcionista:
        return redirect("usuarios:panel_recepcionista")
    return redirect("usuarios:panel_trabajador")


@rol_requerido(Usuario.Rol.ADMINISTRADOR)
def panel_administrador(request):
    return render(request, "usuarios/panel_administrador.html")


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def panel_recepcionista(request):
    return render(request, "usuarios/panel_recepcionista.html")


@rol_requerido(Usuario.Rol.TRABAJADOR, solo_rol=True)
def panel_trabajador(request):
    ultimo = RegistroDeAsistencia.objects.filter(trabajador=request.user).first()
    return render(request, "usuarios/panel_trabajador.html", {"ultimo": ultimo})
