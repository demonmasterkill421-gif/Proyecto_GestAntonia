"""
Bloque «Local» del diagrama de clases.

crearLocal(), modificarLocal() y eliminarLocal() corresponden a las operaciones estándar del ORM de
Django (Local.objects.create, local.save, local.delete) y al CRUD del panel de administración (RF-A01).
"""
from django.db import models


class Local(models.Model):
    class Estado(models.TextChoices):
        ACTIVO = "ACTIVO", "Activo"
        INACTIVO = "INACTIVO", "Inactivo"

    nombre = models.CharField(max_length=80, unique=True)
    descripcion = models.TextField("descripción", blank=True)
    estado = models.CharField(
        max_length=8, choices=Estado.choices, default=Estado.ACTIVO,
        help_text="Disponibilidad del local (atributo «Disponibilidad» del MER).",
    )
    ubicacion = models.CharField("ubicación", max_length=150)

    class Meta:
        verbose_name = "local"
        verbose_name_plural = "locales"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

    @property
    def trabajadores(self):
        """trabajadores[]: usuarios con rol Trabajador asociados a este local."""
        from usuarios.models import Usuario
        return self.usuarios.filter(rol=Usuario.Rol.TRABAJADOR, is_active=True)

    def asociar_trabajador(self, usuario):
        """asociarTrabajador(idLocal, idUser): RF-A03."""
        usuario.local = self
        usuario.save(update_fields=["local"])
        return True

    def remover_trabajador(self, usuario):
        """removerTrabajador(idLocal, idUser)."""
        if usuario.local_id != self.pk:
            return False
        usuario.local = None
        usuario.save(update_fields=["local"])
        return True
