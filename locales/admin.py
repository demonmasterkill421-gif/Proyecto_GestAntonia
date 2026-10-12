from django.contrib import admin

from usuarios.models import Usuario

from .models import Local


class UsuarioInline(admin.TabularInline):
    model = Usuario
    fields = ("first_name", "last_name", "email", "rol", "cargo", "is_active")
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True
    verbose_name_plural = "Personal asociado al local"


@admin.register(Local)
class LocalAdmin(admin.ModelAdmin):
    list_display = ("nombre", "ubicacion", "estado", "total_trabajadores")
    list_filter = ("estado",)
    search_fields = ("nombre", "ubicacion")
    inlines = [UsuarioInline]

    @admin.display(description="Trabajadoras")
    def total_trabajadores(self, obj):
        return obj.trabajadores.count()
