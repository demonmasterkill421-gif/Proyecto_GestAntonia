from django.urls import path
from .api import (
    AjustarStockView,
    EditarInventarioView,
    InventarioView,
    LocalesInventarioView,
    RegistrarProductoView,
    HistorialMovimientosView,
)

app_name = "catalogo_api"

urlpatterns = [
    path("inventario/", InventarioView.as_view(), name="inventario"),
    path("inventario/<int:pk>/", EditarInventarioView.as_view(), name="editar_inventario"),
    path("inventario/<int:pk>/ajustar/", AjustarStockView.as_view(), name="ajustar_stock"),
    path("locales/", LocalesInventarioView.as_view(), name="locales"),
    path("productos/", RegistrarProductoView.as_view(), name="registrar_producto"),
    path("inventario/<int:pk>/movimientos/", HistorialMovimientosView.as_view(), name="historial_movimientos"),
]
