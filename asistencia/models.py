import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError as ErrorDjango
from django.db import models, transaction
from django.utils import timezone


class CodigoQR(models.Model):
    local = models.ForeignKey("locales.Local", on_delete=models.CASCADE, related_name="codigos_qr")
    token = models.CharField(max_length=64, unique=True, editable=False)
    creado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="codigos_qr_generados")
    creado = models.DateTimeField(auto_now_add=True)
    vigente_hasta = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        with transaction.atomic():
            # Garantiza que solo exista 1 token activo por local
            CodigoQR.objects.filter(local=self.local).exclude(pk=self.pk).delete()
            super().save(*args, **kwargs)

    class Meta:
        verbose_name = "código QR"
        verbose_name_plural = "códigos QR"
        ordering = ["-creado"]

    def __str__(self):
        return f"QR {self.local} (vigente hasta {timezone.localtime(self.vigente_hasta):%d-%m-%Y %H:%M})"

    @classmethod
    def limpiar_expirados(cls):
        """Elimina automáticamente todos los códigos QR cuya vigencia ya expiró."""
        return cls.objects.filter(vigente_hasta__lt=timezone.now()).delete()

    @classmethod
    def generar(cls, local, administrador, horas=24 * 180):
        """Genera un QR nuevo para el local (por defecto 6 meses) reemplazando el anterior."""
        cls.limpiar_expirados()
        return cls.objects.create(
            local=local,
            creado_por=administrador,
            token=secrets.token_urlsafe(32),
            vigente_hasta=timezone.now() + timedelta(hours=horas),
        )

    @property
    def vigente(self):
        return timezone.now() <= self.vigente_hasta


class RegistroDeAsistencia(models.Model):
    class Estado(models.TextChoices):
        EN_JORNADA = "EN_JORNADA", "En jornada"
        COMPLETA = "COMPLETA", "Completa"
        CORREGIDA = "CORREGIDA", "Corregida"

    trabajador = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="registros_asistencia"
    )
    local = models.ForeignKey(
        "locales.Local",
        on_delete=models.PROTECT,
        related_name="asistencias"
    )
    fecha = models.DateField(default=timezone.localdate)
    hora_entrada = models.DateTimeField(null=True, blank=True)
    hora_salida = models.DateTimeField(null=True, blank=True)

    ESTADOS = [
        ("EN_JORNADA", "En jornada"),
        ("COMPLETA", "Completa"),
        ("CORREGIDA", "Corregida"),
    ]
    estado = models.CharField(max_length=20, choices=ESTADOS, default=Estado.EN_JORNADA)

    corregido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asistencias_corregidas"
    )
    motivo_correccion = models.TextField(blank=True)

    class Meta:
        verbose_name = "registro de asistencia"
        verbose_name_plural = "registros de asistencia"
        unique_together = ("trabajador", "fecha")
        ordering = ["-fecha", "trabajador"]

    def __str__(self):
        return f"{self.trabajador} - {self.fecha} ({self.estado})"

    @property
    def horas_trabajadas(self):
        """Calcula las horas trabajadas si tiene entrada y salida."""
        if self.hora_entrada and self.hora_salida:
            delta = self.hora_salida - self.hora_entrada
            return round(delta.total_seconds() / 3600, 2)
        return 0.0

    def corregir(self, usuario_admin, motivo, hora_entrada=None, hora_salida=None):
        if not motivo or not motivo.strip():
            raise ErrorDjango("El motivo de la corrección es obligatorio.")

        if hora_salida and hora_entrada and hora_salida < hora_entrada:
            raise ErrorDjango("La hora de salida no puede ser anterior a la de entrada.")

        self.corregido_por = usuario_admin
        self.motivo_correccion = motivo
        if hora_entrada is not None:
            self.hora_entrada = hora_entrada
        if hora_salida is not None:
            self.hora_salida = hora_salida
        self.estado = self.Estado.CORREGIDA
        self.save()

    @classmethod
    def registrar_por_qr(cls, trabajador, token):
        """
        Método blindado con transacciones atómicas y select_for_update para evitar condiciones de carrera.
        """
        try:
            codigo_obj = CodigoQR.objects.get(token=token)
        except CodigoQR.DoesNotExist:
            raise ErrorDjango("El código QR escaneado no es válido.")

        if not codigo_obj.vigente:
            codigo_obj.delete()
            raise ErrorDjango("Este código QR ha expirado.")

        # Validación corregida: Aplica tanto para TRAB como para RECEP
        if getattr(trabajador, 'rol', None) in ["TRAB", "RECEP"] and trabajador.local_id != codigo_obj.local_id:
            raise ErrorDjango("Estás intentando escanear el QR de una sucursal que no te corresponde.")

        hoy = timezone.localdate()
        ahora = timezone.now()

        with transaction.atomic():
            registro = cls.objects.select_for_update().filter(trabajador=trabajador, fecha=hoy).first()

            if not registro:
                return cls.objects.create(
                    trabajador=trabajador,
                    local=codigo_obj.local,
                    hora_entrada=ahora,
                    estado=cls.Estado.EN_JORNADA
                )
            elif not registro.hora_salida:
                if registro.hora_entrada:
                    tiempo_transcurrido = ahora - registro.hora_entrada
                    if tiempo_transcurrido < timedelta(minutes=30):
                        minutos_restantes = max(1, 30 - int(tiempo_transcurrido.total_seconds() // 60))
                        raise ErrorDjango(
                            f"Debes esperar al menos 30 minutos desde tu entrada para marcar la salida (te faltan {minutos_restantes} min)."
                        )
                registro.hora_salida = ahora
                registro.estado = cls.Estado.COMPLETA
                registro.save()
                return registro
            else:
                raise ErrorDjango("Ya tienes la asistencia completa registrada para el día de hoy.")