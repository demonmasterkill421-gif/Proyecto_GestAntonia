from django.contrib import admin

from .models import Clienta, Reserva


@admin.register(Clienta)
class ClientaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "telefono", "consentimiento")
    search_fields = ("nombre", "telefono")


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ("inicio", "local", "especialista", "clienta", "servicio", "estado")
    list_filter = ("local", "estado")
    readonly_fields = ("fin",)
