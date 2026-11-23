from django.contrib import admin

from .models import Cliente, EspecialistaServicio, Reserva


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ("nombre", "telefono", "consentimiento", "observacion", "datos_eliminados")
    search_fields = ("nombre", "telefono")


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = ("inicio", "local", "especialista", "cliente", "servicio", "estado")
    list_filter = ("local", "estado")
    readonly_fields = ("fin",)


@admin.register(EspecialistaServicio)
class EspecialistaServicioAdmin(admin.ModelAdmin):
    list_display = ("especialista", "servicio", "porcentaje_comision")
    list_filter = ("servicio",)
    search_fields = ("especialista__first_name", "especialista__last_name", "especialista__email")
