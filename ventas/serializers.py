from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import DetalleVenta, RegistroDeVenta, SolicitudAnulacion
from .services import registrar_venta

# Tope de unidades de un mismo ítem en una sola venta (evita vaciar el stock por error o mal uso).
MAX_CANTIDAD_POR_ITEM = 10


class DetalleVentaSerializer(serializers.ModelSerializer):
    subtotal = serializers.ReadOnlyField()
    # Nombre de la trabajadora, para mostrarlo sin depender de listas fijas en el frontend
    trabajador_nombre = serializers.SerializerMethodField()

    class Meta:
        model = DetalleVenta
        fields = ["item", "cantidad", "precio_unitario", "subtotal", "trabajador", "trabajador_nombre"]
        read_only_fields = ["precio_unitario"]

    def validate_cantidad(self, value):
        if value < 1:
            raise serializers.ValidationError("La cantidad debe ser mayor a 0")
        if value > MAX_CANTIDAD_POR_ITEM:
            raise serializers.ValidationError(
                f"No se pueden vender más de {MAX_CANTIDAD_POR_ITEM} unidades del mismo ítem en una venta."
            )
        return value

    def get_trabajador_nombre(self, obj):
        if obj.trabajador is None:
            return None
        return obj.trabajador.get_full_name() or obj.trabajador.email

    def validate_trabajador(self, value):
        if value is not None and value.rol != "TRAB":
            raise serializers.ValidationError("El usuario debe tener rol de Trabajador.")
        return value

class VentaSerializer(serializers.ModelSerializer):
    detalles = DetalleVentaSerializer(many=True)
    local_nombre = serializers.CharField(source="local.nombre", read_only=True)

    class Meta:
        model = RegistroDeVenta
        fields = ["id", "folio", "fecha", "local", "local_nombre", "recepcionista", "metodo_pago", "descuento", "descripcion", "monto_base",
                  "monto_total", "estado", "detalles"]
        read_only_fields = ["folio", "fecha", "recepcionista", "monto_base", "monto_total", "estado"]
        extra_kwargs = {"local": {"required": False}}
        validators = []



    def validate_descuento(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("El descuento debe estar entre 0 y 100")
        return value

    def validate_detalles(self, value):
        if not value:
            raise serializers.ValidationError("La venta debe tener al menos un item")

        # Si el mismo ítem viene en varias líneas, se suman: el tope vale por ítem en toda la venta.
        totales = {}
        for d in value:
            item = d["item"]
            totales[item.pk] = totales.get(item.pk, 0) + d["cantidad"]
            if totales[item.pk] > MAX_CANTIDAD_POR_ITEM:
                raise serializers.ValidationError(
                    f"No se pueden vender más de {MAX_CANTIDAD_POR_ITEM} unidades de "
                    f"«{item.nombre}» en una venta."
                )
        return value
    
    def validate(self, attrs):
        # Cada servicio debe indicar la trabajadora que lo realiza (base de su comisión).
        for d in attrs.get("detalles", []):
            if not d["item"].es_producto and d.get("trabajador") is None:
                raise serializers.ValidationError(
                    {"detalles": "Cada servicio debe tener la trabajadora que lo realiza."}
                )
        return attrs

    def create(self, validated_data):
        detalles = validated_data.pop("detalles")

        try:
            return registrar_venta(
                local=validated_data["local"],
                recepcionista=validated_data["recepcionista"],
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