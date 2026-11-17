from django.contrib import admin

from .models import CodigoQR, RegistroDeAsistencia


@admin.register(CodigoQR)
class CodigoQRAdmin(admin.ModelAdmin):
    list_display = ("local", "creado", "vigente_hasta", "creado_por")
    list_filter = ("local",)
    readonly_fields = ("token", "creado")


@admin.register(RegistroDeAsistencia)
class RegistroDeAsistenciaAdmin(admin.ModelAdmin):
    list_display = ("trabajador", "local", "fecha", "hora_entrada", "hora_salida", "horas", "estado")
    list_filter = ("local", "estado", "fecha")
    search_fields = ("trabajador__first_name", "trabajador__last_name")
    date_hierarchy = "fecha"

    @admin.display(description="Horas")
    def horas(self, obj):
        return obj.horas_trabajadas
