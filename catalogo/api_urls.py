from django.urls import path
from .api import InventarioView, LocalesInventarioView

app_name = "catalogo_api"
urlpatterns = [
    path("inventario/", InventarioView.as_view(), name="inventario"),
    path("locales/", LocalesInventarioView.as_view(), name="locales"),
]
