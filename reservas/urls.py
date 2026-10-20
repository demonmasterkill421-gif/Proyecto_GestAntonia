"""Rutas del módulo de Reservas. Quedan todas declaradas desde el inicio para que cada integrante
solo tenga que reemplazar el contenido de su propia vista, sin tocar este archivo."""
from django.urls import path

from . import views, views_clientas, views_reserva

app_name = "reservas"

urlpatterns = [
    path("agenda/", views.agenda_del_dia, name="agenda"),                       # 1.2 · Edson
    path("nueva/", views_reserva.nueva_reserva, name="nueva"),                  # 1.3 · José
    path("clientas/buscar/", views_clientas.buscar_clienta, name="buscar_clienta"),  # 1.4 · Cristian
]
