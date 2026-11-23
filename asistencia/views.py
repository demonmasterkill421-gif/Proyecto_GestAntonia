import logging

from django.conf import settings
from django.core.exceptions import ValidationError as ErrorDjango
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from usuarios.models import Usuario
from ventas.permissions import EsRecepcionista, MismoLocal

from .exportarExcel import construir_excel
from .models import RegistroDeAsistencia, CodigoQR
from .permissions import EsAdministrador
from .serializers import (
    AsistenciaSerializer,
    CorregirSerializer,
    MarcarSerializer,
    _nombre_de,
)

logger = logging.getLogger(__name__)

TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _local_pedido(request):
    """ADMIN: el local viene en ?local=. Los demás: su propio local."""
    if request.user.rol == "ADMIN":
        return request.query_params.get("local")
    return request.user.local_id


def _trabajadoras_de(local_id):
    """Trabajadoras activas del local (las desactivadas no aparecen), ordenadas por nombre."""
    trabajadoras = Usuario.objects.filter(rol="TRAB", local_id=local_id, is_active=True)
    return sorted(trabajadoras, key=_nombre_de)


def _periodo_pedido(request):
    """Lee ?desde= y ?hasta=. Devuelve (desde, hasta), o (None, None) si no son válidos."""
    desde = parse_date(request.query_params.get("desde") or "")
    hasta = parse_date(request.query_params.get("hasta") or "")
    if desde is None or hasta is None or hasta < desde:
        return None, None
    return desde, hasta


def _filas_resumen(trabajadoras, registros):
    """Días y horas trabajadas por cada trabajadora."""
    dias = {t.id: 0 for t in trabajadoras}
    segundos = {t.id: 0 for t in trabajadoras}
    for r in registros:
        dias[r.trabajador_id] += 1
        if r.hora_entrada and r.hora_salida:
            segundos[r.trabajador_id] += (r.hora_salida - r.hora_entrada).total_seconds()

    return [
        {
            "trabajador": t.id,
            "trabajador_nombre": _nombre_de(t),
            "dias": dias[t.id],
            "horas": round(segundos[t.id] / 3600, 2),
        }
        for t in trabajadoras
    ]


class AsistenciaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AsistenciaSerializer
    permission_classes = [IsAuthenticated, EsRecepcionista, MismoLocal]

    def get_permissions(self):
        if self.action in ("corregir", "exportar", "qr", "eliminar"):
            return [IsAuthenticated(), EsAdministrador()]
        if self.action in ("escanear", "mia"):
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = RegistroDeAsistencia.objects.select_related(
            "trabajador", "local", "corregido_por"
        )
        if user.rol == "ADMIN":
            local = self.request.query_params.get("local")
            if local:
                qs = qs.filter(local_id=local)
            return qs
        return qs.filter(local=user.local)

    @action(detail=False, methods=["get"])
    def dia(self, request):
        local_id = _local_pedido(request)
        if not local_id:
            return Response(
                {"detail": "Falta elegir un local"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        hoy = timezone.localdate()
        texto = request.query_params.get("fecha")
        fecha = parse_date(texto) if texto else hoy
        if fecha is None:
            return Response(
                {"detail": "Fecha no válida"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        trabajadoras = _trabajadoras_de(local_id)
        registros = RegistroDeAsistencia.objects.filter(
            trabajador__in=trabajadoras, fecha=fecha
        ).select_related("trabajador", "local", "corregido_por")
        por_trabajadora = {r.trabajador_id: r for r in registros}

        filas = []
        for t in trabajadoras:
            registro = por_trabajadora.get(t.id)
            filas.append(
                {
                    "trabajador": t.id,
                    "trabajador_nombre": _nombre_de(t),
                    "asistencia": (
                        AsistenciaSerializer(registro).data if registro else None
                    ),
                }
            )

        return Response({"fecha": fecha, "es_hoy": fecha == hoy, "filas": filas})

    @action(detail=False, methods=["get"])
    def resumen(self, request):
        local_id = _local_pedido(request)
        if not local_id:
            return Response(
                {"detail": "Falta elegir un local"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        desde, hasta = _periodo_pedido(request)
        if desde is None:
            return Response(
                {"detail": "Período no válido"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        trabajadoras = _trabajadoras_de(local_id)
        registros = RegistroDeAsistencia.objects.filter(
            trabajador__in=trabajadoras, fecha__range=(desde, hasta)
        )

        return Response(
            {"desde": desde, "hasta": hasta, "filas": _filas_resumen(trabajadoras, registros)}
        )

    @action(detail=False, methods=["get"])
    def exportar(self, request):
        local_id = _local_pedido(request)
        if not local_id:
            return Response(
                {"detail": "Falta elegir un local"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        desde, hasta = _periodo_pedido(request)
        if desde is None:
            return Response(
                {"detail": "Período no válido"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        trabajadoras = _trabajadoras_de(local_id)
        registros = list(
            RegistroDeAsistencia.objects.filter(
                trabajador__in=trabajadoras, fecha__range=(desde, hasta)
            ).select_related("trabajador", "local", "corregido_por")
        )
        registros.sort(key=lambda r: (r.fecha, _nombre_de(r.trabajador)))

        modelo_local = Usuario._meta.get_field("local").related_model
        local = modelo_local.objects.filter(pk=local_id).first()
        local_nombre = local.nombre if local else f"Local {local_id}"

        contenido = construir_excel(
            registros,
            _filas_resumen(trabajadoras, registros),
            desde,
            hasta,
            local_nombre,
        )

        respuesta = HttpResponse(contenido, content_type=TIPO_XLSX)
        respuesta["Content-Disposition"] = (
            f'attachment; filename="asistencia_{desde}_a_{hasta}.xlsx"'
        )
        return respuesta

    @action(detail=False, methods=["post"])
    def marcar(self, request):
        serializer = MarcarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trabajadora = serializer.validated_data["trabajador"]
        accion = serializer.validated_data["accion"]

        if request.user.rol != "ADMIN" and trabajadora.local_id != request.user.local_id:
            return Response(
                {"detail": "Esa trabajadora es de otro local"},
                status=status.HTTP_403_FORBIDDEN,
            )

        hoy = timezone.localdate()
        ahora = timezone.now()

        if accion == "entrada":
            registro, creado = RegistroDeAsistencia.objects.get_or_create(
                trabajador=trabajadora,
                fecha=hoy,
                defaults={
                    "local": trabajadora.local,
                    "hora_entrada": ahora,
                    "estado": "EN_JORNADA",
                },
            )
            if not creado:
                return Response(
                    {"detail": "Ya tiene la entrada marcada hoy"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            registro = RegistroDeAsistencia.objects.filter(
                trabajador=trabajadora, fecha=hoy
            ).first()
            if registro is None:
                return Response(
                    {"detail": "No tiene entrada marcada hoy"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if registro.hora_salida:
                return Response(
                    {"detail": "Ya tiene la salida marcada hoy"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            registro.hora_salida = ahora
            registro.estado = "COMPLETA"
            registro.save()

        return Response(
            AsistenciaSerializer(registro).data,
            status=status.HTTP_201_CREATED if accion == "entrada" else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def corregir(self, request):
        serializer = CorregirSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        trabajadora = datos["trabajador"]

        registro, creado = RegistroDeAsistencia.objects.get_or_create(
            trabajador=trabajadora,
            fecha=datos["fecha"],
            defaults={
                "local": trabajadora.local,
                "hora_entrada": datos["hora_entrada"],
                "hora_salida": datos["hora_salida"],
                "estado": "CORREGIDA",
            },
        )

        try:
            registro.corregir(
                request.user,
                datos["motivo"],
                datos["hora_entrada"],
                datos["hora_salida"],
            )
        except (ErrorDjango, ValueError) as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        registro.save()

        return Response(
            AsistenciaSerializer(registro).data,
            status=status.HTTP_201_CREATED if creado else status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def eliminar(self, request, pk=None):
        motivo = (request.data.get("motivo") or "").strip()
        if len(motivo) < 3:
            return Response(
                {"detail": "Debes ingresar un motivo válido para eliminar la asistencia."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        registro = self.get_object()
        usuario_responsable = (
            getattr(request.user, "correo", None)
            or getattr(request.user, "email", None)
            or str(request.user)
        )
        logger.info(
            "Asistencia eliminada | id=%s | trabajador=%s | fecha=%s | por=%s | motivo=%s",
            registro.id,
            _nombre_de(registro.trabajador),
            registro.fecha,
            usuario_responsable,
            motivo,
        )
        registro.delete()

        return Response(
            {"detail": "Registro de asistencia eliminado correctamente."},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="mia")
    def mia(self, request):
        registros = RegistroDeAsistencia.objects.filter(
            trabajador=request.user
        ).order_by("-fecha")[:60]
        return Response(AsistenciaSerializer(registros, many=True).data)

    @action(detail=False, methods=["get", "post"], url_path="qr")
    def qr(self, request):
        CodigoQR.limpiar_expirados()
        local_id = (
            request.data.get("local")
            if request.method == "POST"
            else request.query_params.get("local")
        )
        if not local_id:
            return Response(
                {"detail": "Falta elegir un local."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        modelo_local = Usuario._meta.get_field("local").related_model
        local = modelo_local.objects.filter(pk=local_id).first()
        if not local:
            return Response(
                {"detail": "Local no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.method == "GET":
            qr_obj = CodigoQR.objects.filter(local=local).first()
            if not qr_obj:
                return Response({"existe": False})
            return Response(
                {
                    "existe": True,
                    "token": qr_obj.token,
                    "url": f"{settings.FRONTEND_URL}/trabajador/asistencia?qr={qr_obj.token}",
                    "vigente_hasta": qr_obj.vigente_hasta,
                }
            )

        qr_obj = CodigoQR.generar(local, request.user)
        return Response(
            {
                "existe": True,
                "token": qr_obj.token,
                "url": f"{settings.FRONTEND_URL}/trabajador/asistencia?qr={qr_obj.token}",
                "vigente_hasta": qr_obj.vigente_hasta,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="escanear")
    def escanear(self, request):
        user = request.user

        if user.rol not in ["TRAB", "RECEP"]:
            return Response(
                {"detail": "Solo trabajadoras y recepcionistas pueden usar el registro automático."},
                status=status.HTTP_403_FORBIDDEN,
            )

        token_qr = request.data.get("token") or request.query_params.get("token")
        if not token_qr:
            return Response(
                {"detail": "No se proporcionó el código QR de la sucursal."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            registro = RegistroDeAsistencia.registrar_por_qr(user, token_qr)
            mensaje_exito = (
                "¡Salida registrada correctamente!"
                if registro.hora_salida
                else "¡Entrada registrada correctamente!"
            )
            return Response(
                {"mensaje": mensaje_exito},
                status=status.HTTP_200_OK,
            )
        except (ErrorDjango, ValueError) as error:
            mensaje_error = (
                error.messages[0]
                if hasattr(error, "messages")
                else str(error.message if hasattr(error, "message") else error)
            )
            return Response(
                {"detail": mensaje_error},
                status=status.HTTP_400_BAD_REQUEST,
            )