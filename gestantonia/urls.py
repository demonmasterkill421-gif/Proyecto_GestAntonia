from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from usuarios.api import LoginView, MeView

admin.site.site_header = "GestAntonia · Administración"
admin.site.site_title = "GestAntonia"
admin.site.index_title = "Gestión de Estética Antonia"

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("usuarios.urls")),

    path("api/login/", LoginView.as_view()),
    path("api/me/", MeView.as_view()),
    path("api/token/refresh/", TokenRefreshView.as_view()),
    path("api/ventas/", include("ventas.urls")),
]