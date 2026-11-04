from django.urls import path
from .api import (InventarioView,LocalesInventarioView,RegistrarProductoView,)

app_name = "catalogo_api"

urlpatterns = [
    path("inventario/", InventarioView.as_view(), name="inventario"),
    path("locales/", LocalesInventarioView.as_view(), name="locales"),
    path("productos/",RegistrarProductoView.as_view(),name="registrar_producto",),
]