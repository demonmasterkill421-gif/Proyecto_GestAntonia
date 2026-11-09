"""Permisos de la API de Reservas (2.17 · Edson).

Siguen el patrón de ventas/permissions.py (EsRecepcionista y MismoLocal), pero viven en esta app
para no depender de una rama que todavía no entra a main. La administradora se reconoce con
Usuario.es_administrador, igual que en usuarios/permisos.py (incluye al superusuario).
"""
from rest_framework.permissions import SAFE_METHODS, BasePermission


class EsRecepcionista(BasePermission):
    """Recepcionista o administradora. La trabajadora no agenda."""
    message = "Solo recepción o administración pueden usar la agenda."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and (u.es_recepcionista or u.es_administrador))


class EsAdministrador(BasePermission):
    message = "Solo la administradora puede hacer esto."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.es_administrador)


class LecturaRecepcionEscrituraAdmin(BasePermission):
    """Especialistas: recepción las consulta (para agendar); solo la administradora las crea o edita."""
    message = "Solo la administradora puede crear o editar especialistas."

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return u.es_recepcionista or u.es_administrador
        return u.es_administrador


class MismoLocal(BasePermission):
    """La recepcionista solo toca registros de su local (RF-22); la administradora, todos."""
    message = "Registro de otro local."

    def has_object_permission(self, request, view, obj):
        return request.user.es_administrador or obj.local_id == request.user.local_id
