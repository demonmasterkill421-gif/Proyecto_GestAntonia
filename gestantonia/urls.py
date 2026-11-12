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

    path("api/login/", LoginView.as_view()), #Invoca la clase LoginView y la transforma en un método para retornar la información
    path("api/me/", MeView.as_view()), #Invoca a MeView y lo convierte en una vista para que react lo acepte
    path("api/token/refresh/", TokenRefreshView.as_view()),
    path("api/", include("ventas.urls")),
    path("api/", include("asistencia.urls")),
]