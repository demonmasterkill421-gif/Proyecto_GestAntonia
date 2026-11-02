from rest_framework import serializers

from models import DetalleVenta, RegistroDeVenta



from django.core.exceptions import ValidationError as DjangoValidationError

from .services import registrar_venta


class DetalleVentaSerializer(serializers.ModelSerializer):
    subtotal = serializers.ReadOnlyField()

    class Meta:
        model = DetalleVenta
        fields = ["item", "cantidad", "precio_unitario", "subtotal"]
        read_only_fields = ["precio_unitario"]


    def validate_cantidad(self, value):
        if value < 1:
            raise serializers.ValidationError("La cantidad debe ser mayor a 0")
        return value


class VentaSerializer(serializers.ModelSerializer):
    detalle = DetalleVentaSerializer(many=True)

    class Meta:
        model = RegistroDeVenta
        fields = ["id", "folio", "fecha", "local", "recepcionista", "trabajador", "metodo_pago", "descuento", "descripcion", "monto_base",
                  "monto_total", "estado", "detalles"]
        read_only_fields = ["folio", "fecha", "recepcionista", "monto_base", "monto_total", "estado"]
        extra_kwargs = {"local": {"required": False}}



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

    def create_venta(self, validated_data):
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