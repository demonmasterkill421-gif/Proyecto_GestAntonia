from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import DetalleVenta, RegistroDeVenta, SolicitudAnulacion
from .services import registrar_venta


class DetalleVentaSerializer(serializers.ModelSerializer):
    subtotal = serializers.ReadOnlyField()

    class Meta:
        model = DetalleVenta
        fields = ["item", "cantidad", "precio_unitario", "subtotal", "trabajador"]
        read_only_fields = ["precio_unitario"]

    def validate_cantidad(self, value):
        if value < 1:
            raise serializers.ValidationError("La cantidad debe ser mayor a 0")
        return value

    def validate_trabajador(self, value):
        if value is not None and value.rol != "TRAB":
            raise serializers.ValidationError("El usuario debe tener rol de Trabajador.")
        return value

class VentaSerializer(serializers.ModelSerializer):
    detalles = DetalleVentaSerializer(many=True)
    local_nombre = serializers.CharField(source="local.nombre", read_only=True)

    class Meta:
        model = RegistroDeVenta
        fields = ["id", "folio", "fecha", "local", "local_nombre", "recepcionista", "trabajador", "metodo_pago", "descuento", "descripcion", "monto_base",
                  "monto_total", "estado", "detalles"]
        read_only_fields = ["folio", "fecha", "recepcionista", "monto_base", "monto_total", "estado"]
        extra_kwargs = {"local": {"required": False}}
        validators = []



    def validate_descuento(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("El descuento debe estar entre 0 y 100")
        return value

    def validate_trabajador(self, value):
        if value is not None and value.rol != "TRAB":
            raise serializers.ValidationError("El usuario debe tener rol de Trabajador.")
        return value

    def validate_detalles(self, value):
        if not value:
            raise serializers.ValidationError("La venta debe tener al menos un item")
        return value
    
    def validate(self, attrs):
        detalles = attrs.get("detalles", [])
        trabajador_venta = attrs.get("trabajador")

        for d in detalles:
            if d.get("trabajador") is None and trabajador_venta is not None:
                d["trabajador"] = trabajador_venta
            if not d["item"].es_producto and d.get("trabajador") is None:
                raise serializers.ValidationError(
                    {"detalles": "Cada servicio debe tener la trabajadora que lo realiza."}
                )
            
        if trabajador_venta is None:
            primera = next((d["trabajador"] for d in detalles if d.get("trabajador")), None)
            attrs["trabajador"] = primera

        return attrs

    def create(self, validated_data):
        detalles = validated_data.pop("detalles")

        try:
            return registrar_venta(
                local=validated_data["local"],
                recepcionista=validated_data["recepcionista"],
                trabajador=validated_data.get("trabajador"),
                metodoPago=validated_data.get("metodo_pago", RegistroDeVenta.MetodoPago.EFECTIVO),
                descuento=validated_data.get("descuento", 0),
                descripcion=validated_data.get("descripcion", ""),
                itemsLista=detalles
            )
        except DjangoValidationError as e:
            raise serializers.ValidationError(e.messages)


# ---------------------------------------------------------------------------
# Anulación de ventas
# ---------------------------------------------------------------------------
class SolicitarAnulacionSerializer(serializers.Serializer):
    """Lo que se envía para anular una venta (propietaria) o pedir su anulación (recepcionista): el motivo."""

    motivo = serializers.CharField(
        min_length=5,
        max_length=500,
        error_messages={
            "required": "Escribe el motivo de la anulación.",
            "blank": "Escribe el motivo de la anulación.",
            "min_length": "El motivo debe tener al menos 5 letras.",
            "max_length": "El motivo no puede superar los 500 caracteres.",
        },
    )


class ResponderSolicitudSerializer(serializers.Serializer):
    """Lo que envía la propietaria al aprobar o rechazar una solicitud: una respuesta opcional."""

    respuesta = serializers.CharField(required=False, allow_blank=True, max_length=500)


def _nombre_de(usuario):
    """Nombre y apellido de un usuario, o su correo si no tiene nombre."""
    if usuario is None:
        return None
    return usuario.get_full_name() or usuario.email


class SolicitudAnulacionSerializer(serializers.ModelSerializer):
    """Una solicitud de anulación con los datos de la venta, para mostrarla en listas."""

    venta_folio = serializers.IntegerField(source="venta.folio", read_only=True)
    venta_fecha = serializers.DateTimeField(source="venta.fecha", read_only=True)
    venta_monto_total = serializers.IntegerField(source="venta.monto_total", read_only=True)
    venta_estado = serializers.CharField(source="venta.estado", read_only=True)
    local = serializers.IntegerField(source="venta.local_id", read_only=True)
    local_nombre = serializers.CharField(source="venta.local.nombre", read_only=True)
    solicitante_nombre = serializers.SerializerMethodField()
    resuelta_por_nombre = serializers.SerializerMethodField()
    estado_texto = serializers.CharField(source="get_estado_display", read_only=True)

    class Meta:
        model = SolicitudAnulacion
        fields = [
            "id", "venta", "venta_folio", "venta_fecha", "venta_monto_total", "venta_estado",
            "local", "local_nombre",
            "solicitante", "solicitante_nombre", "motivo",
            "estado", "estado_texto", "fecha_solicitud",
            "resuelta_por", "resuelta_por_nombre", "fecha_resolucion", "respuesta",
        ]
        read_only_fields = fields

    def get_solicitante_nombre(self, obj):
        return _nombre_de(obj.solicitante)

    def get_resuelta_por_nombre(self, obj):
        return _nombre_de(obj.resuelta_por)