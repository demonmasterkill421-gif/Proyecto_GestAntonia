from django.contrib import admin

from .models import DetalleVenta, RegistroDeVenta


class DetalleVentaInline(admin.TabularInline):
    model = DetalleVenta
    extra = 0
    fields = ("item", "cantidad", "precio_unitario")


@admin.register(RegistroDeVenta)
class RegistroDeVentaAdmin(admin.ModelAdmin):
    list_display = ("__str__", "fecha", "local", "trabajador", "metodo_pago", "descuento", "monto_total", "estado")
    list_filter = ("estado", "local", "metodo_pago", "fecha")
    search_fields = ("folio", "trabajador__first_name", "trabajador__last_name")
    date_hierarchy = "fecha"
    readonly_fields = ("folio", "monto_base", "monto_total")
    inlines = [DetalleVentaInline]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        form.instance.recalcular()
