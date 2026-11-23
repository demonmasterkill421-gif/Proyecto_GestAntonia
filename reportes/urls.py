from django.urls import path

from .views import ExcelReportesView, PdfReportesView, ResumenReportesView

urlpatterns = [
    path("resumen/", ResumenReportesView.as_view(), name="reportes-resumen"),
    path("excel/", ExcelReportesView.as_view(), name="reportes-excel"),
    path("pdf/", PdfReportesView.as_view(), name="reportes-pdf"),
]
