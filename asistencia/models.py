"""
Bloque «RegistroDeAsistencia» del diagrama de clases (CU-02 Registrar asistencia · RF-A07, RF-A08, RF-A10, RF-T01).

RegistroDeAsistencia (idAsistencia, fecha, horaEntrada, horaSalida) pertenece a un Trabajador («Registra»)
y a un Local. CodigoQR es el código que genera la administradora para cada local (RF-A07).
"""
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone


class CodigoQR(models.Model):
    local = models.ForeignKey("locales.Local", on_delete=models.CASCADE, related_name="codigos_qr")
    token = models.CharField(max_length=64, unique=True, editable=False)
    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name="codigos_qr_generados")
    creado = models.DateTimeField(auto_now_add=True)
    vigente_hasta = models.DateTimeField()

    class Meta:
        verbose_name = "código QR"
        verbose_name_plural = "códigos QR"
        ordering = ["-creado"]

    def __str__(self):
        return f"QR {self.local} (vigente hasta {timezone.localtime(self.vigente_hasta):%d-%m-%Y %H:%M})"

    @classmethod
    def generar(cls, local, administrador, horas=24):
        """Genera un QR nuevo para el local con una vigencia limitada."""
        return cls.objects.create(local=local, creado_por=administrador, token=secrets.token_urlsafe(32),
                                  vigente_hasta=timezone.now() + timedelta(hours=horas))

    @property
    def vigente(self):
        return timezone.now() <= self.vigente_hasta


class RegistroDeAsistencia(models.Model):
    class Estado(models.TextChoices):
        EN_JORNADA = "EN_JORNADA", "En jornada"
        COMPLETA = "COMPLETA", "Jornada completa"
        CORREGIDA = "CORREGIDA", "Corregida por la administradora"

    trabajador = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name="asistencias", limit_choices_to={"rol": "TRAB"})
    local = models.ForeignKey("locales.Local", on_delete=models.PROTECT, related_name="asistencias")
    fecha = models.DateField(default=timezone.localdate)
    hora_entrada = models.DateTimeField(null=True, blank=True)
    hora_salida = models.DateTimeField(null=True, blank=True)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.EN_JORNADA)
    motivo_correccion = models.TextField("motivo de la corrección", blank=True)
    corregido_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
                                      related_name="asistencias_corregidas")

    class Meta:
        verbose_name = "registro de asistencia"
        verbose_name_plural = "registros de asistencia"
        ordering = ["-fecha", "trabajador"]
        constraints = [models.UniqueConstraint(fields=["trabajador", "fecha"], name="una_asistencia_por_dia")]

    def __str__(self):
        return f"{self.trabajador} · {self.fecha:%d-%m-%Y}"

    # ------------------------------------------------------------------ métodos del diagrama
    def registrar_asistencia_entrada(self, hora=None):
        """registrarAsistenciaEntrada(fecha, horaEntrada)."""
        if self.hora_entrada:
            raise ValidationError("La entrada de hoy ya fue registrada.")
        self.hora_entrada = hora or timezone.now()
        self.estado = self.Estado.EN_JORNADA
        self.save()

    def registrar_asistencia_salida(self, hora=None):
        """registrarAsistenciaSalida(fecha, horaSalida)."""
        if not self.hora_entrada:
            raise ValidationError("No se puede marcar la salida sin una entrada registrada.")
        if self.hora_salida:
            raise ValidationError("La salida de hoy ya fue registrada.")
        hora = hora or timezone.now()
        if hora <= self.hora_entrada:
            raise ValidationError("La hora de salida debe ser posterior a la de entrada.")
        self.hora_salida = hora
        self.estado = self.Estado.COMPLETA
        self.save()

    def corregir(self, administrador, motivo, hora_entrada=None, hora_salida=None):
        """Corrección de un marcaje con motivo obligatorio (RF-A10)."""
        if not motivo.strip():
            raise ValidationError("Toda corrección debe indicar el motivo.")
        if hora_entrada:
            self.hora_entrada = hora_entrada
        if hora_salida:
            self.hora_salida = hora_salida
        if self.hora_entrada and self.hora_salida and self.hora_salida <= self.hora_entrada:
            raise ValidationError("La hora de salida debe ser posterior a la de entrada.")
        self.motivo_correccion = motivo
        self.corregido_por = administrador
        self.estado = self.Estado.CORREGIDA
        self.save()

    @property
    def horas_trabajadas(self):
        if not (self.hora_entrada and self.hora_salida):
            return 0
        return round((self.hora_salida - self.hora_entrada).total_seconds() / 3600, 2)

    @classmethod
    @transaction.atomic
    def registrar_por_qr(cls, trabajador, token):
        """Flujo del escaneo: valida el QR y marca la entrada o la salida del día."""
        qr = CodigoQR.objects.filter(token=token).select_related("local").first()
        if qr is None or not qr.vigente:
            raise ValidationError("Código QR inválido o vencido.")
        if trabajador.local_id != qr.local_id:
            raise ValidationError("El código QR no corresponde al local de la trabajadora.")
        registro, _ = cls.objects.select_for_update().get_or_create(
            trabajador=trabajador, fecha=timezone.localdate(), defaults={"local": qr.local},
        )
        if registro.hora_entrada is None:
            registro.registrar_asistencia_entrada()
        else:
            registro.registrar_asistencia_salida()
        return registro
