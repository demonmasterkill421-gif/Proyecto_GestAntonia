"""Precios de servicios y productos: la administradora edita el precio base y el de cada local.

Va en su propio archivo (y no en api.py) para no mezclarse con los cambios de Inventario.
"""
from django.db import transaction
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from locales.models import Local

from .api import EsAdministrador
from .models import Item, PrecioLocal, Producto, Servicio

PRECIO_MAXIMO = 10_000_000


def _fila_precio(item, locales, especiales):
    """Una fila de la pantalla de precios: el precio base y el de cada local (None = usa el base)."""
    if item.es_servicio:
        clase, tipo = "SERVICIO", item.servicio.get_tipo_display()
    else:
        clase, tipo = "PRODUCTO", "Producto de venta"
    return {
        "id": item.pk,
        "nombre": item.nombre,
        "clase": clase,
        "tipo": tipo,
        "activo": item.activo,
        "precio_base": item.precio,
        "precios": {str(l["id"]): especiales.get((item.pk, l["id"])) for l in locales},
    }


def _items_con_precio():
    """Servicios y productos de venta. Quedan fuera los insumos (no se cobran en la venta) y el
    servicio «Otro», cuyo precio lo escribe la recepcionista en cada venta."""
    return (Item.objects.select_related("servicio", "producto")
            .exclude(producto__tipo=Producto.Tipo.INSUMO)
            .exclude(servicio__tipo=Servicio.Tipo.OTRO, nombre__iexact="Otro")
            .order_by("nombre"))


def _locales():
    return list(Local.objects.order_by("nombre").values("id", "nombre"))


class PrecioItemSerializer(serializers.Serializer):
    precio_base = serializers.IntegerField(min_value=0, max_value=PRECIO_MAXIMO, required=False)
    # {"<id del local>": precio o null}. null quita el precio especial y el local vuelve al precio base.
    precios = serializers.DictField(
        child=serializers.IntegerField(min_value=0, max_value=PRECIO_MAXIMO, allow_null=True),
        required=False,
    )

    def validate_precios(self, valor):
        ids = set(Local.objects.values_list("pk", flat=True))
        for clave in valor:
            if not str(clave).isdecimal() or int(clave) not in ids:
                raise serializers.ValidationError("Uno de los locales indicados no existe.")
        return valor


class PreciosView(APIView):
    """GET /api/catalogo/precios/ · servicios y productos con su precio en cada local."""

    permission_classes = [IsAuthenticated, EsAdministrador]

    def get(self, request):
        locales = _locales()
        especiales = {(i, l): p for i, l, p in PrecioLocal.objects.values_list("item_id", "local_id", "precio")}
        return Response({
            "locales": locales,
            "items": [_fila_precio(i, locales, especiales) for i in _items_con_precio()],
        })


class PrecioItemView(APIView):
    """PATCH /api/catalogo/precios/<id>/ · cambia el precio base y/o el de cada local."""

    permission_classes = [IsAuthenticated, EsAdministrador]

    @transaction.atomic
    def patch(self, request, item_id):
        item = _items_con_precio().filter(pk=item_id).first()
        if item is None:
            return Response({"detail": "El servicio o producto no existe."}, status=status.HTTP_404_NOT_FOUND)
        datos = PrecioItemSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        datos = datos.validated_data

        if "precio_base" in datos:
            item.precio = datos["precio_base"]
            item.save(update_fields=["precio"])
        for local_id, precio in datos.get("precios", {}).items():
            if precio is None or precio == item.precio:
                # Igual al base o vacío: no hace falta un precio especial
                PrecioLocal.objects.filter(item=item, local_id=int(local_id)).delete()
            else:
                PrecioLocal.objects.update_or_create(item=item, local_id=int(local_id), defaults={"precio": precio})

        especiales = {(i, l): p for i, l, p in PrecioLocal.objects.filter(item=item)
                      .values_list("item_id", "local_id", "precio")}
        return Response(_fila_precio(item, _locales(), especiales))
