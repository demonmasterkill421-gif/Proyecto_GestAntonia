"""Rutas de la API de Reservas (2.17 · Edson). Se montan en /api/reservas/ desde gestantonia/urls.py.

Van con prefijo propio para no chocar con el router de ventas, que en la rama feature/Venta
se monta en /api/ (sus rutas son ventas/..., así que no se pisan).
"""
from django.urls import path
from rest_framework.routers import DefaultRouter

from .api_views import (AgendaView, ClienteViewSet, EspecialistaViewSet, LocalViewSet, ReservaViewSet,
                        ServicioViewSet)

router = DefaultRouter()
router.register("reservas", ReservaViewSet, basename="api-reserva")
router.register("clientes", ClienteViewSet, basename="api-cliente")
router.register("servicios", ServicioViewSet, basename="api-servicio")
router.register("locales", LocalViewSet, basename="api-local")
router.register("especialistas", EspecialistaViewSet, basename="api-especialista")

urlpatterns = [
    path("agenda/", AgendaView.as_view(), name="api-agenda"),
] + router.urls
