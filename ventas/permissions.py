from rest_framework.permissions import BasePermission #Plantilla de django para reglas de acceso


class EsRecepcionista(BasePermission):
    message = "Solo recepción"

    def has_permission(self, request, view): #Recibe la petición y la vista
        return request.user.is_authenticated and request.user.rol in ("RECEP", "ADMIN")
    #¿Está autentica    do? ¿Es recepcionista o Admin?
    #Si es true, retorna true


#________________________________________________________________________________

class EsAdministrador(BasePermission):
    message = "Solo la administradora puede hacer esto"

    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.rol == "ADMIN"
    
    #¿Está autenticado? ¿Admin?
    #Si es true, retorna true


#_______________________________________________________________________________

class MismoLocal(BasePermission):
    message = "Registro de otro local"

    def has_object_permission(self, request, view, obj):
        return request.user.rol == "ADMIN" or obj.local_id == request.user.local_id

    #Si es admin, true
    #Si el local es el mismo al de tu usuario, true