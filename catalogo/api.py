from django.db.models import F, Sum, OuterRef, Subquery
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
    producto = serializers.CharField(source="producto.nombre")
    marca = serializers.CharField(source="producto.marca")
    descripcion = serializers.CharField(source="producto.descripcion")
    tipo = serializers.CharField(source="producto.get_tipo_display")
    local = serializers.CharField(source="local.nombre")
    precio = serializers.IntegerField(source="producto.precio")
    bajo_minimo = serializers.BooleanField(read_only=True)

    ultimo_movimiento = serializers.IntegerField(
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = Inventario
        fields = ["id","producto","marca","descripcion","tipo","local","cantidad","stock_minimo","precio","bajo_minimo","ultimo_movimiento",]


class InventarioView(APIView):
    permission_classes = [IsAuthenticated, EsAdministrador]

    def get(self, request):
        filtros = FiltrosInventario(data=request.query_params)
        filtros.is_valid(raise_exception=True)
        datos = filtros.validated_data
        ultimo_movimiento = (MovimientoInventario.objects.filter(inventario_id=OuterRef("pk")).order_by("-fecha", "-pk").values("cantidad")[:1])
        registros = (Inventario.objects.select_related("producto", "local").annotate(ultimo_movimiento=Subquery(ultimo_movimiento)).order_by("producto__nombre", "local__nombre", "pk"))
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
