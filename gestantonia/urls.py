from django.contrib import admin
from django.urls import include, path

admin.site.site_header = "GestAntonia · Administración"
admin.site.site_title = "GestAntonia"
admin.site.index_title = "Gestión de Estética Antonia"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("reservas/", include("reservas.urls")), #Equipo 4
    path("", include("usuarios.urls")),
]
