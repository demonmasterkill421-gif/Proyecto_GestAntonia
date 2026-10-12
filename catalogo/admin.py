from django.contrib import admin

from .models import Inventario, Producto, Servicio


@admin.register(Servicio)
class ServicioAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo", "precio", "duracion", "activo")
    list_filter = ("tipo", "activo")
    search_fields = ("nombre",)


class InventarioInline(admin.TabularInline):
    model = Inventario
    extra = 0


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tipo", "precio", "costo", "activo")
    list_filter = ("tipo", "activo")
    search_fields = ("nombre",)
    inlines = [InventarioInline]


@admin.register(Inventario)
class InventarioAdmin(admin.ModelAdmin):
    list_display = ("producto", "local", "cantidad", "stock_minimo", "alerta")
    list_filter = ("local", "producto__tipo")
    search_fields = ("producto__nombre",)

    @admin.display(boolean=True, description="Bajo el mínimo")
    def alerta(self, obj):
        return obj.bajo_minimo
