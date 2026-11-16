"""API de lectura del panel de control.

Consulta las tablas existentes de GestAntonia; no agrega modelos ni migra datos.
La asistencia porcentual queda sin calcular hasta disponer de turnos programados.
"""

from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from asistencia.models import RegistroDeAsistencia
from locales.models import Local
from usuarios.models import Usuario
from ventas.models import DetalleVenta, RegistroDeVenta


def parsear_fecha(valor):
    try:
        return date.fromisoformat(valor)
    except (TypeError, ValueError):
        return None


def porcentaje_variacion(actual, anterior):
    if anterior == 0:
        return None
    return round((actual - anterior) * 100 / anterior, 1)


def redondear_clp(valor):
    return int(Decimal(valor).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


class ResumenReportesView(APIView):
    """GET /api/reportes/resumen/?local_id=1&desde=YYYY-MM-DD&hasta=YYYY-MM-DD"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.es_administrador:
            return Response({"detail": "Solo la administradora puede consultar reportes."},
                            status=status.HTTP_403_FORBIDDEN)

        hoy = timezone.localdate()
        desde = parsear_fecha(request.query_params.get("desde")) or hoy.replace(day=1)
        hasta = parsear_fecha(request.query_params.get("hasta")) or hoy

        if "desde" in request.query_params and parsear_fecha(request.query_params["desde"]) is None:
            return Response({"detail": "Fecha 'desde' inválida."}, status=400)
        if "hasta" in request.query_params and parsear_fecha(request.query_params["hasta"]) is None:
            return Response({"detail": "Fecha 'hasta' inválida."}, status=400)
        if hasta < desde:
            return Response({"detail": "La fecha final no puede ser anterior a la inicial."}, status=400)
        if (hasta - desde).days > 92:
            return Response({"detail": "Selecciona un período de hasta 93 días."}, status=400)

        local_id = request.query_params.get("local_id")
        if not local_id or not local_id.isdecimal():
            return Response({"detail": "Debes seleccionar un local válido."}, status=400)
        local = Local.objects.filter(pk=int(local_id)).first()
        if local is None:
            return Response({"detail": "El local seleccionado no existe."}, status=404)

        # Solo ventas confirmadas: los borradores y las anuladas no generan ingresos.
        base_ventas = RegistroDeVenta.objects.filter(
            local=local, estado=RegistroDeVenta.Estado.CONFIRMADA
        )
        ventas = list(base_ventas.filter(fecha__date__range=(desde, hasta)).select_related("trabajador"))
        ingresos = sum(v.monto_total for v in ventas)

        # Período anterior con la misma cantidad de días: variación REAL, sin cifras fabricadas.
        cantidad_dias = (hasta - desde).days + 1
        antes_hasta = desde - timedelta(days=1)
        antes_desde = antes_hasta - timedelta(days=cantidad_dias - 1)
        ventas_antes = base_ventas.filter(fecha__date__range=(antes_desde, antes_hasta))
        ingresos_antes = ventas_antes.aggregate(total=Sum("monto_total"))["total"] or 0

        ventas_por_trabajador = defaultdict(int)
        comisiones_por_trabajador = defaultdict(int)
        ingresos_diarios = defaultdict(int)
        for venta in ventas:
            dia = timezone.localtime(venta.fecha).date().isoformat()
            ingresos_diarios[dia] += venta.monto_total
            if venta.trabajador_id:
                ventas_por_trabajador[venta.trabajador_id] += venta.monto_total
                pct = Decimal(venta.trabajador.porcentaje_comision) / Decimal("100")
                comisiones_por_trabajador[venta.trabajador_id] += redondear_clp(
                    Decimal(venta.monto_total) * pct
                )

        detalles = list(DetalleVenta.objects.filter(
            venta_id__in=[v.pk for v in ventas], item__servicio__isnull=False
        ).select_related("item"))
        servicios = sum(detalle.cantidad for detalle in detalles)
        conteo_servicios = Counter()
        servicios_trabajador = defaultdict(int)
        trabajador_por_venta = {v.pk: v.trabajador_id for v in ventas}
        for detalle in detalles:
            conteo_servicios[detalle.item.nombre] += detalle.cantidad
            trabajador_id = trabajador_por_venta.get(detalle.venta_id)
            if trabajador_id:
                servicios_trabajador[trabajador_id] += detalle.cantidad

        detalles_antes = DetalleVenta.objects.filter(
            venta__in=ventas_antes, item__servicio__isnull=False
        ).aggregate(total=Sum("cantidad"))["total"] or 0

        trabajadores = list(Usuario.objects.filter(
            rol=Usuario.Rol.TRABAJADOR, local=local, is_active=True
        ).order_by("first_name", "last_name"))
        asistencias = RegistroDeAsistencia.objects.filter(
            local=local, fecha__range=(desde, hasta), trabajador_id__in=[w.pk for w in trabajadores]
        )
        horas_por_trabajador = defaultdict(float)
        for registro in asistencias:
            horas_por_trabajador[registro.trabajador_id] += registro.horas_trabajadas

        filas_trabajadores = [
            {
                "id": t.pk,
                "nombre": t.get_full_name() or t.email,
                "servicios": servicios_trabajador[t.pk],
                "ventas": ventas_por_trabajador[t.pk],
                # No existen turnos programados en estos modelos: porcentaje no calculable.
                "asistencia": None,
                "horas": round(horas_por_trabajador[t.pk], 1),
                "comision": comisiones_por_trabajador[t.pk],
                "estado": "Activa",
            }
            for t in trabajadores
        ]
        ganancias_diarias = [
            {
                "fecha": (desde + timedelta(days=i)).isoformat(),
                "ganancias": ingresos_diarios[(desde + timedelta(days=i)).isoformat()],
            }
            for i in range(cantidad_dias)
        ]
        top_servicios = [
            {"nombre": nombre, "porcentaje": round(cantidad * 100 / servicios, 1)}
            for nombre, cantidad in conteo_servicios.most_common(5)
        ] if servicios else []

        return Response({
            "modo": "api",
            "sucursal": {"id": local.pk, "name": local.nombre},
            "periodo": {"desde": desde.isoformat(), "hasta": hasta.isoformat()},
            "hayDatos": bool(ventas),
            "indicadores": {
                "ganancias": ingresos,
                "variacionGanancias": porcentaje_variacion(ingresos, ingresos_antes),
                "servicios": servicios,
                "variacionServicios": servicios - detalles_antes if detalles_antes else None,
                "trabajadoresActivos": len(trabajadores),
                "sucursales": 1,
                "asistencia": None,
                "variacionAsistencia": None,
            },
            "gananciasDiarias": ganancias_diarias,
            "serviciosPorTipo": top_servicios,
            "trabajadores": filas_trabajadores,
        })
