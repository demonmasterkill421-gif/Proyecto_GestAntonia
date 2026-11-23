"""API de Reportes (CU-03): resumen para la pantalla y descargas en Excel y PDF.

Las cifras salen de reportes/datos.py, así la pantalla, el Excel y el PDF siempre coinciden.
"""
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .datos import ErrorReporte, construir_reporte, leer_parametros

# Se conservan para quien los importaba desde aquí
from .datos import porcentaje_variacion  # noqa: F401


class _BaseReporte(APIView):
    permission_classes = [IsAuthenticated]

    def _preparar(self, request):
        """Devuelve (local, desde, hasta) o una Response de error."""
        if not request.user.es_administrador:
            return Response({"detail": "Solo la administradora puede consultar reportes."},
                            status=status.HTTP_403_FORBIDDEN)
        try:
            return leer_parametros(request.query_params)
        except ErrorReporte as e:
            return Response({"detail": e.mensaje}, status=e.codigo)


def _nombre_archivo(reporte, extension):
    local = "".join(c if c.isalnum() else "_" for c in reporte["sucursal"]["name"]).strip("_")
    periodo = reporte["periodo"]
    return f"Reporte_{local}_{periodo['desde']}_al_{periodo['hasta']}.{extension}"


class ResumenReportesView(_BaseReporte):
    """GET /api/reportes/resumen/?local_id=1&desde=YYYY-MM-DD&hasta=YYYY-MM-DD"""

    def get(self, request):
        datos = self._preparar(request)
        if isinstance(datos, Response):
            return datos
        return Response(construir_reporte(*datos))


class ExcelReportesView(_BaseReporte):
    """GET /api/reportes/excel/?... · libro de Excel (.xlsx) con hojas de análisis y gráficos."""

    def get(self, request):
        datos = self._preparar(request)
        if isinstance(datos, Response):
            return datos
        from .excel import construir_excel_reporte

        reporte = construir_reporte(*datos, con_detalle=True)
        respuesta = HttpResponse(
            construir_excel_reporte(reporte),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        respuesta["Content-Disposition"] = f'attachment; filename="{_nombre_archivo(reporte, "xlsx")}"'
        return respuesta


class PdfReportesView(_BaseReporte):
    """GET /api/reportes/pdf/?... · el mismo reporte en PDF, listo para imprimir o enviar."""

    def get(self, request):
        datos = self._preparar(request)
        if isinstance(datos, Response):
            return datos
        from .pdf import construir_pdf_reporte

        reporte = construir_reporte(*datos)
        respuesta = HttpResponse(construir_pdf_reporte(reporte), content_type="application/pdf")
        respuesta["Content-Disposition"] = f'attachment; filename="{_nombre_archivo(reporte, "pdf")}"'
        return respuesta
