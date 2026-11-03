"""Rutas del módulo de Reservas. Quedan todas declaradas desde el inicio para que cada integrante
solo tenga que reemplazar el contenido de su propia vista, sin tocar este archivo."""
from django.urls import path

from . import views, views_clientes, views_especialistas, views_reserva

app_name = "reservas"

urlpatterns = [
    path("agenda/", views.agenda_del_dia, name="agenda"),                       # 1.2 · Edson
    path("nueva/", views_reserva.nueva_reserva, name="nueva"),                  # 1.3 · José
    path("clientes/buscar/", views_clientes.buscar_cliente, name="buscar_cliente"),  # 1.4 · Cristian
        # 2.4 · Edson: especialistas por local (solo la administradora)
    path("especialistas/", views_especialistas.lista_especialistas, name="especialistas"),
    path("especialistas/nueva/", views_especialistas.nueva_especialista, name="nueva_especialista"),
    path("especialistas/<int:pk>/editar/", views_especialistas.editar_especialista, name="editar_especialista"),
    path("especialistas/<int:pk>/estado/", views_especialistas.cambiar_estado_especialista, name="estado_especialista"),
]
