"""
Módulo «Reservas» del Equipo 4 

Versión inicial: dos tablas, Clienta y Reserva, conectadas con modelos que ya existen
en el repositorio común (Local, Servicio y Usuario con rol Trabajador).
"""
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Cliente(models.Model):
    """Persona que pide la hora. No usa el sistema: la recepcionista la registra."""
    nombre = models.CharField(max_length=100)
    telefono = models.CharField("teléfono", max_length=15, unique=True)
    consentimiento = models.BooleanField(default=False, help_text="Autorizó el uso de sus datos.")

    class Meta:
        verbose_name = "cliente"
        verbose_name_plural = "clientes"
        ordering = ["nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.telefono})"


class Reserva(models.Model):
    class Estado(models.TextChoices):
        AGENDADA = "AGENDADA", "Agendada"
        ATENDIDA = "ATENDIDA", "Atendida"
        CANCELADA = "CANCELADA", "Cancelada"

    local = models.ForeignKey("locales.Local", on_delete=models.PROTECT, related_name="reservas")
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT, related_name="reservas")
    especialista = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     related_name="reservas_asignadas", limit_choices_to={"rol": "TRAB"})
    servicio = models.ForeignKey("catalogo.Servicio", on_delete=models.PROTECT, related_name="reservas")
    inicio = models.DateTimeField()
    fin = models.DateTimeField(blank=True, help_text="Se calcula con la duración del servicio.")
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.AGENDADA)
    motivo_cancelacion = models.CharField("motivo de cancelación", max_length=200, blank=True)

    class Meta:
        verbose_name = "reserva"
        verbose_name_plural = "reservas"
        ordering = ["inicio"]

    def __str__(self):
        return f"{timezone.localtime(self.inicio):%d-%m-%Y %H:%M} · {self.cliente.nombre}"

    def calcular_fin(self):
        """La hora de término sale de la duración del servicio (en minutos)."""
        return self.inicio + timedelta(minutes=self.servicio.duracion)

    def clean(self):
        """Reglas que revisan el admin y los formularios antes de guardar."""
        if self.inicio and self.servicio_id:
            self.fin = self.calcular_fin()
        if self.especialista_id and self.local_id and self.especialista.local_id != self.local_id:
            raise ValidationError({"especialista": "La especialista no pertenece a este local."})
        # Cero topes: no puede haber otra reserva activa de la misma especialista que se cruce.
        if self.especialista_id and self.inicio and self.fin:
            choques = (Reserva.objects
                       .filter(especialista_id=self.especialista_id, inicio__lt=self.fin, fin__gt=self.inicio)
                       .exclude(estado=self.Estado.CANCELADA)
                       .exclude(pk=self.pk))
            if choques.exists():
                raise ValidationError({"inicio": "La especialista ya tiene una reserva en ese horario."})

    def save(self, *args, **kwargs):
        if not self.fin:
            self.fin = self.calcular_fin()
        super().save(*args, **kwargs)

    def reprogramar(self, nuevo_inicio):
        """Mueve la reserva a otra hora (tarea 2.1).

        El bloque anterior queda libre solo: el bloque ES el par inicio–fin de esta fila,
        así que al cambiar esas dos horas el hueco viejo deja de estar ocupado.
        Si el nuevo horario no es válido, la reserva vuelve a sus horas originales.
        """
        if self.estado == self.Estado.CANCELADA:
            raise ValidationError("No se puede reprogramar una reserva cancelada.")
        if self.estado == self.Estado.ATENDIDA:
            raise ValidationError("No se puede reprogramar una reserva ya atendida.")

        inicio_anterior, fin_anterior = self.inicio, self.fin
        self.inicio = nuevo_inicio
        self.fin = self.calcular_fin()
        try:
            self.full_clean()  # vuelve a validar topes (clean() ignora a la propia reserva)
        except ValidationError:
            self.inicio, self.fin = inicio_anterior, fin_anterior
            raise
        self.save()

    def cancelar(self, motivo):
        """Cancela con motivo. La reserva no se borra: queda el registro y el bloque se libera."""
        if self.estado == self.Estado.CANCELADA:
            raise ValidationError("La reserva ya está cancelada.")
        if self.estado == self.Estado.ATENDIDA:
            raise ValidationError("No se puede cancelar una reserva ya atendida.")
        if not (motivo or "").strip():
            raise ValidationError("Indique el motivo de la cancelación.")
        self.estado = self.Estado.CANCELADA
        self.motivo_cancelacion = motivo.strip()
        self.save()
