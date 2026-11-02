from django.contrib import admin

from .models import Cliente, Reserva


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ("nombre", "telefono", "consentimiento")
    search_fields = ("nombre", "telefono")


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ("inicio", "local", "especialista", "cliente", "servicio", "estado")
    list_filter = ("local", "estado")
    readonly_fields = ("fin",)
