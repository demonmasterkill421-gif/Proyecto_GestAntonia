from rest_framework.permissions import BasePermission


class EsRecepcionista(BasePermission):
    message = "Solo recepción"


    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol in ("RECEP", "ADMIN")


class EsAdministrador(BasePermission):
    message = "Solo la administradora puede hacer esto"

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == "ADMIN"


class MismoLocal(BasePermission):
    message = "Registro de otro local"

    def has_object_permission(self, request, view, obj):
        return request.user.rol == "ADMIN" or obj.local_id == request.user.local_id