"""
Módulo «Reservas» del Equipo 4 (épica EP-04 · HU-03 y HU-04 · tarea 1.1 del Sprint 1).

Clienta y Reserva se relacionan con modelos que ya existen en el repositorio común:
  - locales.Local       → local donde se atiende la reserva.
  - catalogo.Servicio   → servicio reservado; su «duracion» define cuánto bloque ocupa.
  - usuarios.Usuario    → especialista que atiende (rol Trabajador) y recepcionista que registra.

La regla más importante del módulo, «una especialista no puede tener dos reservas que se crucen»,
se revisa en dos niveles:
  1. En Python (clean): funciona con cualquier base de datos y avisa a la recepcionista a tiempo.
  2. En PostgreSQL, una restricción de exclusión (migración 0002) que rechaza el tope incluso si dos
     recepcionistas guardan al mismo tiempo (objetivo específico 3, OWASP A06). Si alguien usa SQLite
     para pruebas rápidas, esa migración no hace nada y el proyecto sigue funcionando igual.
"""
import re
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


# ---------------------------------------------------------------------------
# Clienta
# ---------------------------------------------------------------------------
def normalizar_telefono(valor):
    """Deja el teléfono en 9 dígitos: «+56 9 8765 4321», «9 8765 4321» y «987654321» quedan iguales."""
    digitos = re.sub(r"\D", "", valor or "")
    if digitos.startswith("56") and len(digitos) == 11:
        digitos = digitos[2:]
    return digitos


def validar_telefono(valor):
    if not re.fullmatch(r"9\d{8}", normalizar_telefono(valor)):
        raise ValidationError("El teléfono debe ser un celular chileno de 9 dígitos, por ejemplo 9 8765 4321.")


class Clienta(models.Model):
    """
    Persona para la que se registra una reserva. No es usuaria del sistema: la recepcionista
    la registra. Se guardan solo nombre y teléfono, más el consentimiento (Ley 19.628 y Ley 21.719).
    """
    nombre = models.CharField(max_length=100)
    telefono = models.CharField("teléfono", max_length=9, unique=True, validators=[validar_telefono],
                                help_text="Celular de 9 dígitos. Identifica a la clienta (HU-03, CA-3).")
    consentimiento = models.BooleanField(default=False,
                                         help_text="Autorizó el uso de sus datos para gestionar sus reservas.")
    fecha_consentimiento = models.DateTimeField(null=True, blank=True)
    creada = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "clienta"
        verbose_name_plural = "clientas"
        ordering = ["nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.telefono})"

    def save(self, *args, **kwargs):
        self.telefono = normalizar_telefono(self.telefono)
        super().save(*args, **kwargs)

    def historial_reservas(self):
        """historialReservas(): reservas de la clienta, de la más reciente a la más antigua."""
        return self.reservas.select_related("servicio", "especialista", "local").order_by("-inicio")


# ---------------------------------------------------------------------------
# Reserva
# ---------------------------------------------------------------------------
class ReservaQuerySet(models.QuerySet):
    def activas(self):
        """Las canceladas no ocupan bloque en la agenda."""
        return self.exclude(estado=Reserva.Estado.CANCELADA)

    def del_local(self, local):
        return self.filter(local=local)

    def del_dia(self, fecha):
        return self.filter(inicio__date=fecha)

    def que_se_cruzan(self, especialista, inicio, fin):
        """Reservas activas de la especialista que se superponen con [inicio, fin)."""
        return self.activas().filter(especialista=especialista, inicio__lt=fin, fin__gt=inicio)


class Reserva(models.Model):
    class Estado(models.TextChoices):
        AGENDADA = "AGENDADA", "Agendada"
        ATENDIDA = "ATENDIDA", "Atendida"
        CANCELADA = "CANCELADA", "Cancelada"

    local = models.ForeignKey("locales.Local", on_delete=models.PROTECT, related_name="reservas")
    clienta = models.ForeignKey(Clienta, on_delete=models.PROTECT, related_name="reservas")
    especialista = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reservas_asignadas",
        limit_choices_to={"rol": "TRAB"}, help_text="Trabajadora que realiza el servicio.",
    )
    servicio = models.ForeignKey("catalogo.Servicio", on_delete=models.PROTECT, related_name="reservas")
    inicio = models.DateTimeField()
    fin = models.DateTimeField(blank=True, help_text="Se calcula sola con la duración del servicio.")
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.AGENDADA)
    motivo_cancelacion = models.CharField("motivo de cancelación", max_length=200, blank=True)
    creada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reservas_registradas",
    )
    creada = models.DateTimeField(auto_now_add=True)
    actualizada = models.DateTimeField(auto_now=True)

    objects = ReservaQuerySet.as_manager()

    class Meta:
        verbose_name = "reserva"
        verbose_name_plural = "reservas"
        ordering = ["inicio"]
        indexes = [models.Index(fields=["local", "inicio"], name="reserva_local_inicio_idx")]
        constraints = [
            models.CheckConstraint(condition=models.Q(fin__gt=models.F("inicio")),
                                   name="reserva_fin_despues_de_inicio"),
            # BPMN-02: toda cancelación registra su motivo.
            models.CheckConstraint(condition=~models.Q(estado="CANCELADA") | ~models.Q(motivo_cancelacion=""),
                                   name="reserva_cancelada_con_motivo"),
            # CERO TOPES: la restricción de exclusión se crea en la migración 0002, solo en PostgreSQL.
        ]

    def __str__(self):
        from django.utils import timezone
        return f"{timezone.localtime(self.inicio):%d-%m-%Y %H:%M} · {self.clienta.nombre} · {self.servicio.nombre}"

    def calcular_fin(self):
        """La hora de término sale de la duración del servicio (en minutos)."""
        return self.inicio + timedelta(minutes=self.servicio.duracion)

    def clean(self):
        """Reglas que el admin y los formularios revisan antes de guardar."""
        if self.inicio and self.servicio_id:
            self.fin = self.calcular_fin()
        errores = {}
        if self.especialista_id and self.especialista.rol != "TRAB":
            errores["especialista"] = "Solo se puede asignar una trabajadora."
        if self.especialista_id and self.local_id and self.especialista.local_id != self.local_id:
            errores["especialista"] = "La especialista no pertenece a este local."
        if (self.especialista_id and self.inicio and self.fin and self.estado != self.Estado.CANCELADA
                and Reserva.objects.que_se_cruzan(self.especialista, self.inicio, self.fin)
                .exclude(pk=self.pk).exists()):
            errores["inicio"] = "La especialista ya tiene una reserva en ese horario."
        if errores:
            raise ValidationError(errores)

    def save(self, *args, **kwargs):
        if self.inicio and self.servicio_id and not self.fin:
            self.fin = self.calcular_fin()
        super().save(*args, **kwargs)

    def cancelar(self, motivo):
        """cancelar(): libera el bloque, porque las canceladas no cuentan como topes (BPMN-02)."""
        if self.estado == self.Estado.CANCELADA:
            raise ValidationError("La reserva ya está cancelada.")
        if not (motivo or "").strip():
            raise ValidationError("Indique el motivo de la cancelación.")
        self.estado = self.Estado.CANCELADA
        self.motivo_cancelacion = motivo.strip()
        self.save(update_fields=["estado", "motivo_cancelacion", "actualizada"])
