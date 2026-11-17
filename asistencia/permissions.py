from rest_framework.permissions import BasePermission


class EsAdministrador(BasePermission):
    message = "Solo la administradora"

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == "ADMIN"