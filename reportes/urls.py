from django.urls import path

from .views import ResumenReportesView

urlpatterns = [
    path("resumen/", ResumenReportesView.as_view(), name="reportes-resumen"),
]
