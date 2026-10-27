import csv
from django.contrib import admin
from django.http import HttpResponse
from .models import DetalleVenta, RegistroDeVenta


class DetalleVentaInline(admin.TabularInline):
    model = DetalleVenta
    extra = 0
    fields = ("item", "cantidad", "precio_unitario")


@admin.action(description="Exportar ventas a CSV - EXCEL")
def exportarVentaCSV(queryset):
    respuesta = HttpResponse(content_type='text/csv; charset=utf-8')
    respuesta['Content-Disposition'] = 'attachment; filename="reporte_ventas.csv"'

    writer = csv.writer(respuesta, delimiter=';')

    writer.writerow([
        'id', 'fecha', 'descripcion', 'metodo_pago', 'descuento', 
        'monto_base', 'monto_total', 'estado', 'folio', 'local', 
        'trabajador'
    ])

    for venta in queryset:
        writer.writerow([
            venta.id,
            venta.fecha,
            getattr(venta, 'descripcion', ''),
            venta.metodo_pago,
            venta.descuento,
            venta.monto_base,
            venta.monto_total,
            venta.estado,
            venta.folio,

            # Aquí traemos el nombre del local en vez del ID
            venta.local.nombre if venta.local else '',
            
            # Aquí traemos el nombre/representación del trabajador
            str(venta.trabajador) if venta.trabajador else '',
        ])
         
    return respuesta


@admin.register(RegistroDeVenta)
class RegistroDeVentaAdmin(admin.ModelAdmin):
    list_display = ("__str__", "fecha", "local", "trabajador", "metodo_pago", "descuento", "monto_total", "estado", "folio")
    list_filter = ("estado", "local", "metodo_pago", "fecha")
    search_fields = ("folio", "trabajador__first_name", "trabajador__last_name")
    date_hierarchy = "fecha"
    readonly_fields = ("folio", "monto_base", "monto_total")
    inlines = [DetalleVentaInline]
    actions = [exportarVentaCSV]

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        form.instance.recalcular()

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser or request.user.is_staff:
            return qs
        
        return qs