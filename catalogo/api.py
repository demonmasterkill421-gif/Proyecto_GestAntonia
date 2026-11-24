from django.core.exceptions import ValidationError
from django.db.models import F, Sum, OuterRef, Subquery
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from locales.models import Local
from .models import Inventario, MovimientoInventario
from django.db import transaction
from rest_framework import status
from .models import Producto


class EsAdministrador(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.es_administrador)


class FiltrosInventario(serializers.Serializer):
    busqueda = serializers.CharField(required=False, allow_blank=True, max_length=100)
    local = serializers.IntegerField(required=False, min_value=1)
    bajo_minimo = serializers.BooleanField(required=False, default=False)


class InventarioSerializer(serializers.ModelSerializer):
    producto_id = serializers.IntegerField(source="producto.pk", read_only=True)
    producto = serializers.CharField(source="producto.nombre")
    marca = serializers.CharField(source="producto.marca")
    descripcion = serializers.CharField(source="producto.descripcion")
    tipo = serializers.CharField(source="producto.get_tipo_display")
    local = serializers.CharField(source="local.nombre")
    precio = serializers.IntegerField(source="producto.precio")
    activo = serializers.BooleanField(source="producto.activo", read_only=True)
    bajo_minimo = serializers.BooleanField(read_only=True)

    ultimo_movimiento = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )
    ultimo_movimiento_fecha = serializers.DateField(
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Inventario
        fields = ["id","producto_id","producto","marca","descripcion","tipo","local","cantidad","stock_minimo","precio","activo","bajo_minimo","ultimo_movimiento","ultimo_movimiento_fecha",]


class InventarioView(APIView):
    permission_classes = [IsAuthenticated, EsAdministrador]

    def get(self, request):
        filtros = FiltrosInventario(data=request.query_params)
        filtros.is_valid(raise_exception=True)
        datos = filtros.validated_data
        ultimo_movimiento = (MovimientoInventario.objects.filter(inventario_id=OuterRef("pk")).order_by("-fecha", "-pk").values("cantidad")[:1])
        ultima_fecha = (MovimientoInventario.objects.filter(inventario_id=OuterRef("pk")).order_by("-fecha", "-pk").values("fecha")[:1])
        registros = (Inventario.objects.select_related("producto", "local").annotate(ultimo_movimiento=Subquery(ultimo_movimiento), ultimo_movimiento_fecha=Subquery(ultima_fecha)).order_by("producto__nombre", "local__nombre", "pk"))
        resumen = {
            "total_productos": registros.values("producto_id").distinct().order_by().count(),
            "stock_total": registros.aggregate(total=Sum("cantidad"))["total"] or 0,
            "stock_bajo": registros.filter(cantidad__lte=F("stock_minimo")).count(),
        }
        if datos.get("busqueda"):
            registros = registros.filter(producto__nombre__icontains=datos["busqueda"])
        if datos.get("local"):
            registros = registros.filter(local_id=datos["local"])
        if datos["bajo_minimo"]:
            registros = registros.filter(cantidad__lte=F("stock_minimo"))
        return Response({"resumen": resumen, "registros": InventarioSerializer(registros, many=True).data})


class LocalesInventarioView(APIView):
    permission_classes = [IsAuthenticated, EsAdministrador]

    def get(self, request):
        return Response(list(Local.objects.order_by("nombre").values("id", "nombre")))

class RegistrarProductoSerializer(serializers.ModelSerializer):
    local = serializers.PrimaryKeyRelatedField(
        queryset=Local.objects.filter(estado=Local.Estado.ACTIVO)
    )
    cantidad = serializers.IntegerField(
        min_value=0,
        max_value=10000,
    )
    stock_minimo = serializers.IntegerField(
        min_value=0,
        max_value=10000,
    )

    class Meta:
        model = Producto
        fields = [
            "id",
            "nombre",
            "marca",
            "descripcion",
            "tipo",
            "precio",
            "costo",
            "local",
            "cantidad",
            "stock_minimo",
        ]
        read_only_fields = ["id"]

    @transaction.atomic
    def create(self, validated_data):
        local = validated_data.pop("local")
        cantidad = validated_data.pop("cantidad")
        stock_minimo = validated_data.pop("stock_minimo")

        producto = Producto.objects.create(**validated_data)

        Inventario.objects.create(
            producto=producto,
            local=local,
            cantidad=0,
            stock_minimo=stock_minimo,
        )

        if cantidad > 0:
            producto.actualizar_stock(
                local=local,
                cantidad=cantidad,
                motivo=MovimientoInventario.Motivo.REGISTRO,
            )

        return producto

class RegistrarProductoView(APIView):
    permission_classes = [IsAuthenticated, EsAdministrador]

    def get(self, request):
        locales = Local.objects.filter(
            estado=Local.Estado.ACTIVO
        ).order_by("nombre").values("id", "nombre")

        tipos = [
            {"valor": valor, "nombre": nombre}
            for valor, nombre in Producto.Tipo.choices
        ]

        return Response({
            "locales": list(locales),
            "tipos": tipos,
        })

    def post(self, request):
        serializer = RegistrarProductoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        producto = serializer.save()

        return Response(
            {
                "id": producto.pk,
                "mensaje": "Producto registrado correctamente.",
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# M11: editar un producto y reponer stock desde la pantalla de Inventario.
# Las dos rutas reciben el id del registro de inventario (producto + local),
# que ya viene en cada fila de la tabla de React.
# ---------------------------------------------------------------------------

def _inventario_con_ultimo_movimiento(pk):
    """Devuelve el registro con los mismos datos que muestra la tabla."""
    ultimo_movimiento = (MovimientoInventario.objects.filter(inventario_id=OuterRef("pk")).order_by("-fecha", "-pk").values("cantidad")[:1])
    ultima_fecha = (MovimientoInventario.objects.filter(inventario_id=OuterRef("pk")).order_by("-fecha", "-pk").values("fecha")[:1])
    return (Inventario.objects.select_related("producto", "local")
            .annotate(ultimo_movimiento=Subquery(ultimo_movimiento), ultimo_movimiento_fecha=Subquery(ultima_fecha))
            .get(pk=pk))


class EditarInventarioSerializer(serializers.Serializer):
    # Datos del producto (se comparten entre todos los locales).
    nombre = serializers.CharField(required=False, max_length=100)
    marca = serializers.CharField(required=False, allow_blank=True, max_length=100)
    descripcion = serializers.CharField(required=False, allow_blank=True)
    tipo = serializers.ChoiceField(required=False, choices=Producto.Tipo.choices)
    precio = serializers.IntegerField(required=False, min_value=0)
    activo = serializers.BooleanField(required=False)
    # Dato del inventario de este local.
    stock_minimo = serializers.IntegerField(required=False, min_value=0, max_value=10000)
    # La cantidad NO se edita aquí: se cambia con /ajustar/ para que quede
    # registrada en MovimientoInventario.

    CAMPOS_PRODUCTO = ["nombre", "marca", "descripcion", "tipo", "precio", "activo"]

    @transaction.atomic
    def update(self, inventario, validated_data):
        producto = inventario.producto
        campos_producto = [c for c in self.CAMPOS_PRODUCTO if c in validated_data]
        for campo in campos_producto:
            setattr(producto, campo, validated_data[campo])
        if campos_producto:
            producto.save(update_fields=campos_producto)
        if "stock_minimo" in validated_data:
            inventario.stock_minimo = validated_data["stock_minimo"]
            inventario.save(update_fields=["stock_minimo"])
        return inventario


class EditarInventarioView(APIView):
    """PATCH /api/catalogo/inventario/<pk>/"""
    permission_classes = [IsAuthenticated, EsAdministrador]

    def patch(self, request, pk):
        inventario = get_object_or_404(Inventario.objects.select_related("producto", "local"), pk=pk)
        serializer = EditarInventarioSerializer(inventario, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(InventarioSerializer(_inventario_con_ultimo_movimiento(pk)).data)

# Motivos que la dueña puede elegir al ajustar el stock a mano
MOTIVOS_ENTRADA = {
    MovimientoInventario.Motivo.COMPRA,
    MovimientoInventario.Motivo.CORRECCION,
}
MOTIVOS_SALIDA = {
    MovimientoInventario.Motivo.DANADO,
    MovimientoInventario.Motivo.CORRECCION,
}


class AjustarStockSerializer(serializers.Serializer):
    # Positivo = entrada; negativo = salida.
    cantidad = serializers.IntegerField(min_value=-10000, max_value=10000)
    motivo = serializers.ChoiceField(choices=sorted(MOTIVOS_ENTRADA | MOTIVOS_SALIDA))

    def validate_cantidad(self, valor):
        if valor == 0:
            raise serializers.ValidationError("La cantidad no puede ser 0.")
        return valor

    def validate(self, datos):
        # "Compra" solo sirve para sumar y "Dañado" solo para restar.
        permitidos = MOTIVOS_ENTRADA if datos["cantidad"] > 0 else MOTIVOS_SALIDA
        if datos["motivo"] not in permitidos:
            raise serializers.ValidationError("Ese motivo no corresponde a este tipo de ajuste.")
        return datos


class AjustarStockView(APIView):
    """POST /api/catalogo/inventario/<pk>/ajustar/  {"cantidad": 10, "motivo": "COMPRA"}"""
    permission_classes = [IsAuthenticated, EsAdministrador]

    def post(self, request, pk):
        inventario = get_object_or_404(Inventario.objects.select_related("producto", "local"), pk=pk)
        datos = AjustarStockSerializer(data=request.data)
        if not datos.is_valid():
            return Response({"detail": "Indica una cantidad distinta de 0 y un motivo válido."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            # actualizar_stock() ya valida que no quede bajo cero y deja el movimiento.
            inventario.producto.actualizar_stock(
                inventario.local,
                datos.validated_data["cantidad"],
                motivo=datos.validated_data["motivo"],
            )
        except ValidationError as error:
            return Response({"detail": error.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(InventarioSerializer(_inventario_con_ultimo_movimiento(pk)).data)


class HistorialMovimientosView(APIView):
    """GET /api/catalogo/inventario/<pk>/movimientos/: todos los movimientos de ese registro."""
    permission_classes = [IsAuthenticated, EsAdministrador]

    def get(self, request, pk):
        inventario = get_object_or_404(Inventario, pk=pk)
        movimientos = inventario.movimientos.order_by("-fecha", "-pk")

        # "Quedó en": se parte del stock actual y se va hacia atrás.
        stock = inventario.cantidad
        lista = []
        for movimiento in movimientos:
            lista.append({
                "id": movimiento.pk,
                "fecha": movimiento.fecha,
                "cantidad": movimiento.cantidad,
                "motivo": movimiento.motivo,
                "stock_resultante": stock,
            })
            stock -= movimiento.cantidad

        return Response({"movimientos": lista})
