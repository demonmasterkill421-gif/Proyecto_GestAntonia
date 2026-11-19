from datetime import timedelta

from django.conf import settings
from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from .models import CodigoQR, RegistroDeAsistencia


@admin.register(CodigoQR)
class CodigoQRAdmin(admin.ModelAdmin):
    list_display = ('local', 'enlace_qr', 'creado_por', 'creado', 'vigente_hasta')
    list_filter = ('local',)
    readonly_fields = ('token', 'creado', 'creado_por', 'enlace_qr')

    def get_queryset(self, request):
        CodigoQR.limpiar_expirados()
        return super().get_queryset(request)

    def get_changeform_initial_data(self, request):
        return {"vigente_hasta": timezone.now() + timedelta(days=180)}

    def enlace_qr(self, obj):
        if obj.token:
            url = f"{settings.FRONTEND_URL}/trabajador/asistencia?qr={obj.token}"
            return format_html(
                '<a href="{}" target="_blank" style="color: #1d4ed8; font-weight: bold; text-decoration: underline; font-size: 14px;">Copiar / Abrir Enlace de Asistencia</a>',
                url,
            )
        return "-"
    enlace_qr.short_description = "Enlace directo"

    def save_model(self, request, obj, form, change):
        if getattr(obj, 'creado_por_id', None) is None:
            obj.creado_por = request.user
        super().save_model(request, obj, form, change)


@admin.register(RegistroDeAsistencia)
class RegistroDeAsistenciaAdmin(admin.ModelAdmin):
    list_display = ('trabajador', 'local', 'fecha', 'hora_entrada', 'hora_salida', 'horas', 'estado')
    list_filter = ('local', 'estado', 'fecha')
    search_fields = ('trabajador__first_name', 'trabajador__last_name')
    date_hierarchy = "fecha"

    @admin.display(description="Horas")
    def horas(self, obj):
        return obj.horas_trabajadas