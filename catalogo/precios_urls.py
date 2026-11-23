from django.urls import path

from .precios import PrecioItemView, PreciosView

urlpatterns = [
    path("", PreciosView.as_view(), name="precios"),
    path("<int:item_id>/", PrecioItemView.as_view(), name="precio_item"),
]
