"""API REST de Reservas (2.17 · Edson). Prefijo: /api/reservas/

Sigue el patrón de la app ventas (ViewSet + serializer + permisos por rol y por local).
Autenticación: JWT (Authorization: Bearer <token> de /api/login/), configurado en settings.REST_FRAMEWORK.

Regla RF-22: la recepcionista solo ve y agenda en su local (user.local); la administradora ve todos
y puede filtrar con ?local=<id>. La trabajadora no tiene acceso (403).
"""
from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from catalogo.models import Servicio
from locales.models import Local
from usuarios.models import Usuario

from .agenda import armar_agenda
from .forms_especialistas import reservas_futuras
from .models import Cliente, Reserva
from .permissions import EsAdministrador, EsRecepcionista, LecturaRecepcionEscrituraAdmin, MismoLocal
from .serializers import (CancelarSerializer, ClienteSerializer, EspecialistaSerializer,
                          ReprogramarSerializer, ReservaSerializer, ServicioSerializer,
                          errores_del_modelo)
from .views_clientes import normalizar_telefono

_FECHA_HORA = serializers.DateTimeField()


# ------------------------------------------------------------------ utilidades
def _leer_fecha(texto, por_defecto=None):
    """AAAA-MM-DD → date. Si viene mal escrita responde 400 (en la API no se adivina la fecha)."""
    if not texto:
        return por_defecto
    try:
        return date.fromisoformat(texto)
    except ValueError:
        raise serializers.ValidationError({"fecha": "Use el formato AAAA-MM-DD."})


def _local_de_la_consulta(request):
    """Local a mostrar: el de la recepcionista; la administradora lo elige con ?local= (o usa el suyo)."""
    user = request.user
    if not user.es_administrador:
        return user.local
    local_id = request.query_params.get("local", "")
    if local_id:
        if not local_id.isdigit():
            raise serializers.ValidationError({"local": "Debe ser el id numérico del local."})
        return get_object_or_404(Local, pk=int(local_id))
    return user.local


# ------------------------------------------------------------------ agenda
class AgendaView(APIView):
    """GET /api/reservas/agenda/?fecha=AAAA-MM-DD[&local=<id>] → bloques de 30 min por especialista."""
    permission_classes = [IsAuthenticated, EsRecepcionista]

    def get(self, request):
        fecha = _leer_fecha(request.query_params.get("fecha"), por_defecto=timezone.localdate())
        local = _local_de_la_consulta(request)
        if local is None:
            return Response({"local": "Indique el local con ?local=<id>."}, status=status.HTTP_400_BAD_REQUEST)

        especialistas, bloques = armar_agenda(local, fecha)
        return Response({
            "fecha": fecha.isoformat(),
            "local": {"id": local.pk, "nombre": local.nombre},
            "especialistas": [
                {"id": e.pk, "nombre": e.get_full_name() or e.email, "activa": e.is_active}
                for e in especialistas
            ],
            "bloques": [
                {
                    "hora": timezone.localtime(b["inicio"]).strftime("%H:%M"),
                    "inicio": _FECHA_HORA.to_representation(b["inicio"]),
                    "fin": _FECHA_HORA.to_representation(b["fin"]),
                    "celdas": [
                        {
                            "especialista": esp.pk,
                            "estado": "OCUPADO" if r else "LIBRE",
                            "reserva": None if r is None else {
                                "id": r.pk,
                                "cliente_nombre": r.cliente.nombre,
                                "servicio_nombre": r.servicio.nombre,
                                "inicio": _FECHA_HORA.to_representation(r.inicio),
                                "fin": _FECHA_HORA.to_representation(r.fin),
                                "estado": r.estado,
                            },
                        }
                        for esp, r in b["celdas"]
                    ],
                }
                for b in bloques
            ],
        })


# ------------------------------------------------------------------ reservas
class ReservaViewSet(viewsets.ModelViewSet):
    """
    GET  /api/reservas/reservas/?fecha=&especialista=&estado=&cliente=[&local=]  lista
    POST /api/reservas/reservas/                         nueva (si hay tope: 400 + "sugerencias")
    GET  /api/reservas/reservas/<id>/                    detalle
    POST /api/reservas/reservas/<id>/reprogramar/        {"inicio": "AAAA-MM-DDTHH:MM"}
    POST /api/reservas/reservas/<id>/cancelar/           {"motivo": "..."}
    Las reservas no se editan ni se borran: se reprograman o se cancelan (queda el registro).
    """
    serializer_class = ReservaSerializer
    permission_classes = [IsAuthenticated, EsRecepcionista, MismoLocal]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = Reserva.objects.select_related("local", "cliente", "especialista", "servicio")
        user = self.request.user
        params = self.request.query_params

        if user.es_administrador:
            local = params.get("local", "")
            if local.isdigit():
                qs = qs.filter(local_id=int(local))
        else:
            qs = qs.filter(local=user.local) if user.local_id else qs.none()

        if self.action == "list":
            fecha = _leer_fecha(params.get("fecha"))
            if fecha:
                qs = qs.filter(inicio__date=fecha)
            for campo in ("especialista", "cliente"):
                valor = params.get(campo, "")
                if valor.isdigit():
                    qs = qs.filter(**{f"{campo}_id": int(valor)})
            if params.get("estado") in Reserva.Estado.values:
                qs = qs.filter(estado=params["estado"])
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.es_administrador:
            # La administradora puede indicar el local; si no, se usa el de la especialista.
            local = serializer.validated_data.get("local") or serializer.validated_data["especialista"].local
        else:
            local = user.local      # el local sale de la cuenta, no del JSON (RF-22)
        if local is None:
            raise serializers.ValidationError({"local": "Su cuenta no tiene un local asignado para agendar."})
        serializer.save(local=local)

    @action(detail=True, methods=["post"])
    def reprogramar(self, request, pk=None):
        reserva = self.get_object()
        entrada = ReprogramarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        nuevo_inicio = entrada.validated_data["inicio"]
        try:
            reserva.reprogramar(nuevo_inicio)        # valida topes y estado en el modelo
        except DjangoValidationError as e:
            return Response(errores_del_modelo(e, reserva.especialista, reserva.servicio, nuevo_inicio),
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(reserva).data)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        reserva = self.get_object()
        entrada = CancelarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            reserva.cancelar(entrada.validated_data["motivo"])   # exige motivo y estado válido
        except DjangoValidationError as e:
            return Response(errores_del_modelo(e), status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(reserva).data)


# ------------------------------------------------------------------ clientes
class ClienteViewSet(viewsets.ModelViewSet):
    """
    GET  /api/reservas/clientes/?telefono=+56 9 ...   busca por teléfono (se normaliza igual que en Django)
    POST /api/reservas/clientes/                      {"nombre", "telefono", "consentimiento": true}
    GET  /api/reservas/clientes/<id>/
    Por protección de datos (ley 19.628) no se lista la base completa de clientes: se busca por teléfono.
    """
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated, EsRecepcionista]
    http_method_names = ["get", "post", "head", "options"]
    queryset = Cliente.objects.all()

    def list(self, request, *args, **kwargs):
        telefono = normalizar_telefono(request.query_params.get("telefono", ""))
        if not telefono:
            return Response({"telefono": "Indique el teléfono a buscar (?telefono=...)."},
                            status=status.HTTP_400_BAD_REQUEST)
        clientes = Cliente.objects.filter(telefono=telefono)
        return Response(self.get_serializer(clientes, many=True).data)


# ------------------------------------------------------------------ catálogo
class ServicioViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/reservas/servicios/ → servicios vigentes (con duración, para calcular el fin)."""
    serializer_class = ServicioSerializer
    permission_classes = [IsAuthenticated, EsRecepcionista]
    queryset = Servicio.objects.filter(activo=True).order_by("nombre")


# ------------------------------------------------------------------ especialistas
class EspecialistaViewSet(viewsets.ModelViewSet):
    """
    Administradora: CRUD de especialistas de todos los locales (?local=<id> para filtrar).
    Recepcionista: solo lectura de las especialistas ACTIVAS de su local (las que puede agendar).
    POST /api/reservas/especialistas/<id>/desactivar/ y /activar/ (no se borran: conservan su historial).
    """
    serializer_class = EspecialistaSerializer
    permission_classes = [IsAuthenticated, LecturaRecepcionEscrituraAdmin, MismoLocal]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = (Usuario.objects.filter(rol=Usuario.Rol.TRABAJADOR)
              .select_related("local")
              .annotate(futuras=Count("reservas_asignadas", filter=Q(
                  reservas_asignadas__inicio__gte=timezone.now()) & ~Q(
                  reservas_asignadas__estado=Reserva.Estado.CANCELADA)))
              .order_by("local__nombre", "-is_active", "first_name"))
        if user.es_administrador:
            local = self.request.query_params.get("local", "")
            return qs.filter(local_id=int(local)) if local.isdigit() else qs
        return qs.filter(local=user.local, is_active=True) if user.local_id else qs.none()

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, EsAdministrador])
    def desactivar(self, request, pk=None):
        especialista = self.get_object()
        futuras = reservas_futuras(especialista).count()
        if futuras:
            return Response(
                {"detail": f"{especialista.get_full_name()} tiene {futuras} reserva(s) futura(s). "
                           "Reprográmelas o cancélelas antes de desactivarla."},
                status=status.HTTP_400_BAD_REQUEST)
        especialista.is_active = False
        especialista.save(update_fields=["is_active"])
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, EsAdministrador])
    def activar(self, request, pk=None):
        especialista = self.get_object()
        especialista.is_active = True
        especialista.save(update_fields=["is_active"])
        return Response(self.get_serializer(self.get_object()).data)
