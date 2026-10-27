"""Restricción de acceso por rol (RNF-SA02).

Uso:
    @rol_requerido(Usuario.Rol.RECEPCIONISTA)
    def mi_vista(request): ...

El usuario debe haber iniciado sesión y tener uno de los roles indicados; si no, recibe un error 403.
La administradora tiene acceso completo, así que siempre puede entrar salvo que la vista indique
solo_rol=True (por ejemplo, el panel de la trabajadora, que depende de su propia asistencia).
"""
from functools import wraps

from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied


def rol_requerido(*roles, solo_rol=False):
    def decorador(vista):
        @wraps(vista)
        @login_required
        def envoltura(request, *args, **kwargs):
            u = request.user
            permitido = u.rol in roles or (u.es_administrador and not solo_rol)
            if not permitido:
                raise PermissionDenied("Su rol no tiene acceso a esta sección.")
            return vista(request, *args, **kwargs)
        return envoltura
    return decorador
