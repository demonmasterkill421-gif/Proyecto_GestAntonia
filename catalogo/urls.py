from django.urls import path
from . import views

app_name = "catalogo"

urlpatterns = [
    path("inventario/", views.inventario, name="inventario"),
]