"""Locales (RF-A01): la administradora los ve, crea y edita desde la pantalla de Sucursales.

GET    /api/locales/            todos los locales (activos e inactivos)
POST   /api/locales/            crea un local
PATCH  /api/locales/<id>/       edita nombre, ubicación, descripción o estado

No se borran: un local con ventas, asistencias o reservas se marca como Inactivo.
"""
from rest_framework import serializers, viewsets
from rest_framework.permissions import BasePermission, IsAuthenticated

from .models import Local


class EsAdministradora(BasePermission):
    message = "Solo la administradora puede gestionar los locales."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.es_administrador)


class LocalGestionSerializer(serializers.ModelSerializer):
    estado_nombre = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = Local
        fields = ["id", "nombre", "ubicacion", "descripcion", "estado", "estado_nombre"]
        extra_kwargs = {"nombre": {"validators": []}, "descripcion": {"required": False}}

    def validate_nombre(self, valor):
        valor = " ".join(valor.split())
        if not valor:
            raise serializers.ValidationError("Escribe el nombre del local.")
        otros = Local.objects.filter(nombre__iexact=valor)
        if self.instance:
            otros = otros.exclude(pk=self.instance.pk)
        if otros.exists():
            raise serializers.ValidationError("Ya existe un local con ese nombre.")
        return valor

    def validate_ubicacion(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("Escribe la ubicación del local.")
        return valor


class LocalViewSet(viewsets.ModelViewSet):
    serializer_class = LocalGestionSerializer
    permission_classes = [IsAuthenticated, EsAdministradora]
    http_method_names = ["get", "post", "patch", "head", "options"]
    queryset = Local.objects.order_by("nombre")
