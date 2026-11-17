from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ("email", "first_name", "last_name", "rol", "local", "cargo", "is_active")
    list_filter = ("rol", "local", "cargo", "is_active")
    search_fields = ("email", "first_name", "last_name", "username")
    ordering = ("first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "username", "password")}),
        ("Datos personales", {"fields": ("first_name", "last_name")}),
        ("GestAntonia", {"fields": ("rol", "local", "cargo", "porcentaje_comision")}),
        ("Permisos", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Fechas", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",),
                "fields": ("email", "username", "first_name", "last_name", "rol", "local",
                           "password1", "password2")}),
    )
