from django.contrib.auth import views as auth_views
from django.urls import path

from . import views

app_name = "usuarios"

urlpatterns = [
    path("", views.inicio, name="inicio"),
    path("login/", auth_views.LoginView.as_view(redirect_authenticated_user=True), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("panel/administrador/", views.panel_administrador, name="panel_administrador"),
    path("panel/recepcionista/", views.panel_recepcionista, name="panel_recepcionista"),
    path("panel/trabajador/", views.panel_trabajador, name="panel_trabajador"),
]
