from django.http import HttpResponse

from .exportarExcel import construir_excel

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.dateparse import parse_date
from rest_framework import serializers, viewsets

from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


from .models import RegistroDeVenta
from .permissions import EsRecepcionista, MismoLocal
from .serializers import VentaSerializer


from catalogo.models import Producto, Servicio

LIMITE_EXPORTAR = 20000  # tope de ventas por archivo


def _fecha_o_none(texto):
    """Convierte 'aaaa-mm-dd' en fecha. Si viene vacío o mal escrito, devuelve None."""
    try:
        return parse_date(texto or "")
    except ValueError:
        return None


class VentaViewSet(viewsets.ModelViewSet):
    serializer_class = VentaSerializer
    permission_classes = [IsAuthenticated, EsRecepcionista, MismoLocal]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = RegistroDeVenta.objects.select_related("local", "trabajador").prefetch_related("detalles")
        user = self.request.user

        # Período opcional: ?desde=aaaa-mm-dd&hasta=aaaa-mm-dd (incluye ambos días).
        # Así la pantalla pide solo lo que necesita y no todo el historial.
        desde = _fecha_o_none(self.request.query_params.get("desde"))
        hasta = _fecha_o_none(self.request.query_params.get("hasta"))
        if desde:
            qs = qs.filter(fecha__date__gte=desde)
        if hasta:
            qs = qs.filter(fecha__date__lte=hasta)

        if user.rol == "ADMIN":
            local = self.request.query_params.get("local")
            return qs.filter(local_id=local) if local else qs

        return qs.filter(local=user.local)

    def perform_create(self, serializer):
        user = self.request.user

        if user.rol == "ADMIN":
            local = serializer.validated_data.get("local") or user.local

        else:
            local = user.local

        if local is None:
            raise serializers.ValidationError({"local":"Indique el local de la venta"})

        serializer.save(recepcionista=user, local=local)


    @action(detail=True, methods=["post"])
    def anular(self,request, pk=None):
        venta = self.get_object()

        try:
            venta.anular()
        except DjangoValidationError as e:
            return Response({"detail": e.messages}, status=400)
        return Response(self.get_serializer(venta).data)

    @action(detail=False, methods=["post"])
    def exportar(self, request):
        """Excel con las ventas indicadas (las que la administradora ve filtradas). Solo ADMIN."""
        if request.user.rol != "ADMIN":
            return Response({"detail": "Solo la administradora puede exportar ventas."}, status=403)

        ids = request.data.get("ids")
        if (
            not isinstance(ids, list)
            or not ids
            or len(ids) > LIMITE_EXPORTAR
            or not all(isinstance(i, int) for i in ids)
        ):
            return Response({"detail": "No hay ventas para exportar."}, status=400)

        ventas = (
            self.get_queryset()
            .filter(id__in=ids)
            .exclude(estado="BORRADOR")
            .prefetch_related("detalles__item", "detalles__trabajador")
            .order_by("-fecha")
        )

        respuesta = HttpResponse(
            construir_excel(ventas),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        respuesta["Content-Disposition"] = 'attachment; filename="ventas.xlsx"'
        return respuesta

    @action(detail=False, methods=["get"])
    def servicios(self, request):
        datos = Servicio.objects.filter(activo=True).order_by("nombre").values(
            "id", "nombre", "precio", "duracion", "tipo"
        )
        return Response(list(datos))

    @action(detail=False, methods=["get"])
    def productos(self, request):
        """Productos de venta e insumos activos, con el stock del local del usuario."""
        local = request.user.local if request.user.local_id else None
        datos = []
        for p in Producto.objects.filter(activo=True).order_by("nombre"):
            datos.append({
                "id": p.id,
                "nombre": p.nombre,
                "tipo": p.tipo,  # "VENTA" o "INSUMO"
                "precio": 0 if p.tipo == Producto.Tipo.INSUMO else p.precio,
                "stock": p.stock_en(local) if local else None,
            })
        return Response(datos)