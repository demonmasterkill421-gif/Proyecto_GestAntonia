from django.utils import timezone
from rest_framework import serializers

from usuarios.models import Usuario

from .models import RegistroDeAsistencia


def _nombre_de(usuario):
    """Nombre completo del usuario, o su correo si no tiene nombre."""
    if usuario is None:
        return None
    return usuario.get_full_name() or usuario.email


class AsistenciaSerializer(serializers.ModelSerializer):
    """Un registro de asistencia, solo para lectura."""

    trabajador_nombre = serializers.SerializerMethodField()
    local_nombre = serializers.CharField(source="local.nombre", read_only=True)
    corregido_por_nombre = serializers.SerializerMethodField()
    horas_trabajadas = serializers.ReadOnlyField()

    class Meta:
        model = RegistroDeAsistencia
        fields = [
            "id", "trabajador", "trabajador_nombre", "local", "local_nombre", "fecha",
            "hora_entrada", "hora_salida", "horas_trabajadas", "estado",
            "motivo_correccion", "corregido_por", "corregido_por_nombre",
        ]
        read_only_fields = fields

    def get_trabajador_nombre(self, obj):
        return _nombre_de(obj.trabajador)

    def get_corregido_por_nombre(self, obj):
        return _nombre_de(obj.corregido_por)


class MarcarSerializer(serializers.Serializer):
    """Datos para marcar entrada o salida a mano (ADMIN y RECEP)."""

    trabajador = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.filter(rol="TRAB")
    )
    accion = serializers.ChoiceField(choices=["entrada", "salida"])


class CorregirSerializer(serializers.Serializer):
    """Datos para corregir o crear un registro (solo ADMIN)."""

    trabajador = serializers.PrimaryKeyRelatedField(
        queryset=Usuario.objects.filter(rol="TRAB")
    )
    fecha = serializers.DateField()
    hora_entrada = serializers.DateTimeField()
    hora_salida = serializers.DateTimeField()
    motivo = serializers.CharField(allow_blank=False, trim_whitespace=True)

    def validate(self, datos):
        entrada = datos["hora_entrada"]
        salida = datos["hora_salida"]

        if salida <= entrada:
            raise serializers.ValidationError(
                "La salida debe ser posterior a la entrada"
            )

        if timezone.is_aware(entrada):
            dia_entrada = timezone.localtime(entrada).date()
        else:
            dia_entrada = entrada.date()

        if dia_entrada != datos["fecha"]:
            raise serializers.ValidationError(
                "La entrada debe ser del mismo día que la fecha"
            )

        return datos