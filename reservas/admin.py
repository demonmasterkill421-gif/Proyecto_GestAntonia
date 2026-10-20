from django.contrib import admin

from .models import Clienta, Reserva


@admin.register(Clienta)
class ClientaAdmin(admin.ModelAdmin):
    list_display = ("nombre", "telefono", "consentimiento", "creada")
    search_fields = ("nombre", "telefono")
    readonly_fields = ("creada",)


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ("inicio", "local", "especialista", "clienta", "servicio", "estado")
    list_filter = ("local", "estado", "especialista")
    date_hierarchy = "inicio"
    search_fields = ("clienta__nombre", "clienta__telefono")
    autocomplete_fields = ("clienta",)
    readonly_fields = ("fin", "creada_por", "creada", "actualizada")

    def save_model(self, request, obj, form, change):
        if not change:
            obj.creada_por = request.user
        super().save_model(request, obj, form, change)
