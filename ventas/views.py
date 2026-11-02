from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers, viewsets

from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


from .models import RegistroDeVenta
from .permissions import EsRecepcionista, MismoLocal
from .serializers import VentaSerializer


class VentaViewSet(viewsets.ModelViewSet):
    serializer_class = VentaSerializer
    permission_classes = [IsAuthenticated, EsRecepcionista, MismoLocal]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = RegistroDeVenta.objects.select_related("local", "trabajador").prefetch_related("detalles")
        user = self.request.user

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

    