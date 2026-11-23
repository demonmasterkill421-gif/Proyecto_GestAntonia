"""Gestión de usuarios por la administradora (RF-A02): crear recepcionistas, otras administradoras y,
a futuro, cualquier otro rol. Las especialistas (rol TRAB) se gestionan en Especialistas, porque además
llevan sus servicios y comisiones.

GET    /api/usuarios/                    lista (con ?rol=RECEP para filtrar)
POST   /api/usuarios/                    crea
PATCH  /api/usuarios/<id>/               edita (nombre, apellido, correo, rol, local y, si viene, la clave)
POST   /api/usuarios/<id>/desactivar/    no se borra: conserva sus ventas y asistencias
POST   /api/usuarios/<id>/activar/
GET    /api/usuarios/roles/              roles que se pueden crear aquí (para el formulario)
"""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from locales.models import Local

from .models import Usuario

# Roles que se crean desde esta pantalla. Las especialistas tienen su propia pantalla.
# Para un rol nuevo a futuro: agregarlo a Usuario.Rol y aquí (y decir si necesita local).
ROLES_GESTIONABLES = [Usuario.Rol.ADMINISTRADOR, Usuario.Rol.RECEPCIONISTA]
ROLES_CON_LOCAL = {Usuario.Rol.RECEPCIONISTA}


class EsAdministradora(BasePermission):
    message = "Solo la administradora puede gestionar usuarios."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.es_administrador)


def validar_clave(clave, usuario=None, campo="clave"):
    """Reglas de contraseña de Django (largo mínimo, no común, no solo números). El error va al campo."""
    try:
        validate_password(clave, user=usuario)
    except DjangoValidationError as e:
        raise serializers.ValidationError({campo: list(e.messages)})
    return clave


class UsuarioGestionSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(source="first_name", max_length=150)
    apellido = serializers.CharField(source="last_name", max_length=150, allow_blank=True, required=False)
    rol_nombre = serializers.CharField(source="get_rol_display", read_only=True)
    local_nombre = serializers.CharField(source="local.nombre", read_only=True, default=None)
    activo = serializers.BooleanField(source="is_active", read_only=True)
    clave = serializers.CharField(write_only=True, required=False, trim_whitespace=False,
                                  style={"input_type": "password"})
    local = serializers.PrimaryKeyRelatedField(queryset=Local.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Usuario
        fields = ["id", "nombre", "apellido", "email", "rol", "rol_nombre", "local", "local_nombre",
                  "activo", "clave", "last_login", "date_joined"]
        read_only_fields = ["last_login", "date_joined"]
        extra_kwargs = {"email": {"validators": []}}  # se valida abajo, sin importar mayúsculas

    def validate_email(self, valor):
        valor = valor.strip().lower()
        otros = Usuario.objects.filter(email__iexact=valor)
        if self.instance:
            otros = otros.exclude(pk=self.instance.pk)
        if otros.exists():
            raise serializers.ValidationError("Ya existe un usuario con ese correo.")
        return valor

    def validate_rol(self, valor):
        if valor not in ROLES_GESTIONABLES:
            raise serializers.ValidationError(
                "Las especialistas se crean en Especialistas (llevan servicios y comisiones).")
        return valor

    def validate(self, attrs):
        rol = attrs.get("rol", getattr(self.instance, "rol", None))
        local = attrs.get("local", getattr(self.instance, "local", None))
        if self.instance is None:
            if not rol:
                raise serializers.ValidationError({"rol": "Elige el rol."})
            if not attrs.get("clave"):
                raise serializers.ValidationError({"clave": "Escribe una contraseña para la cuenta nueva."})
        if rol in ROLES_CON_LOCAL and local is None:
            raise serializers.ValidationError({"local": "La recepcionista debe tener un local."})
        if self.instance is not None and self.instance.rol == Usuario.Rol.TRABAJADOR:
            raise serializers.ValidationError("Las especialistas se editan en Especialistas.")
        # La propia administradora no puede quitarse su rol (se quedaría sin acceso)
        request = self.context.get("request")
        if (self.instance is not None and request and self.instance.pk == request.user.pk
                and rol != Usuario.Rol.ADMINISTRADOR):
            raise serializers.ValidationError({"rol": "No puedes quitarte tu propio rol de administradora."})
        if attrs.get("clave"):
            prueba = self.instance or Usuario(email=attrs.get("email", ""), first_name=attrs.get("first_name", ""),
                                              last_name=attrs.get("last_name", ""))
            validar_clave(attrs["clave"], prueba)
        return attrs

    def create(self, datos):
        clave = datos.pop("clave")
        return Usuario.objects.create_user(username=datos["email"], password=clave, **datos)

    def update(self, usuario, datos):
        clave = datos.pop("clave", None)
        for campo, valor in datos.items():
            setattr(usuario, campo, valor)
        if "email" in datos:
            usuario.username = datos["email"]
        if clave:
            usuario.set_password(clave)
        usuario.save()
        return usuario


class UsuarioViewSet(viewsets.ModelViewSet):
    serializer_class = UsuarioGestionSerializer
    permission_classes = [IsAuthenticated, EsAdministradora]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = (Usuario.objects.exclude(rol=Usuario.Rol.TRABAJADOR).select_related("local")
              .order_by("-is_active", "rol", "first_name", "last_name"))
        rol = self.request.query_params.get("rol")
        return qs.filter(rol=rol) if rol else qs

    @action(detail=False, methods=["get"])
    def roles(self, request):
        return Response([
            {"valor": r.value, "nombre": r.label, "necesita_local": r in ROLES_CON_LOCAL}
            for r in ROLES_GESTIONABLES
        ])

    @action(detail=True, methods=["post"])
    def desactivar(self, request, pk=None):
        usuario = self.get_object()
        if usuario.pk == request.user.pk:
            return Response({"detail": "No puedes desactivar tu propia cuenta."}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            if usuario.es_administrador:
                otras = (Usuario.objects.select_for_update()
                         .filter(rol=Usuario.Rol.ADMINISTRADOR, is_active=True).exclude(pk=usuario.pk))
                if not otras.exists():
                    return Response({"detail": "Debe quedar al menos una administradora activa."},
                                    status=status.HTTP_400_BAD_REQUEST)
            usuario.is_active = False
            usuario.save(update_fields=["is_active"])
        return Response(self.get_serializer(usuario).data)

    @action(detail=True, methods=["post"])
    def activar(self, request, pk=None):
        usuario = self.get_object()
        usuario.is_active = True
        usuario.save(update_fields=["is_active"])
        return Response(self.get_serializer(usuario).data)
