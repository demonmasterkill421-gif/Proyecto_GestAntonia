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
    MINUTOS_ENTRE_MARCAJES = 5

    class Estado(models.TextChoices):
        EN_JORNADA = "EN_JORNADA", "En jornada"
        EN_COLACION = "EN_COLACION", "En colación"
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
    inicio_colacion = models.DateTimeField(null=True, blank=True)
    fin_colacion = models.DateTimeField(null=True, blank=True)
    hora_salida = models.DateTimeField(null=True, blank=True)

    ESTADOS = [
        ("EN_JORNADA", "En jornada"),
        ("EN_COLACION", "En colación"),
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
    def segundos_trabajados(self):
        """Calcula los segundos trabajados descontando el tiempo de colación."""
        if self.hora_entrada and self.hora_salida:
            total = (self.hora_salida - self.hora_entrada).total_seconds()
            if self.inicio_colacion and self.fin_colacion and self.fin_colacion > self.inicio_colacion:
                total -= (self.fin_colacion - self.inicio_colacion).total_seconds()
            return max(0.0, total)
        return 0.0

    @property
    def horas_trabajadas(self):
        """Calcula las horas trabajadas si tiene entrada y salida (descontando colación)."""
        return round(self.segundos_trabajados / 3600, 2)

    def corregir(
        self,
        usuario_admin,
        motivo,
        hora_entrada=None,
        hora_salida=None,
        inicio_colacion=None,
        fin_colacion=None,
    ):
        if not motivo or not motivo.strip():
            raise ErrorDjango("El motivo de la corrección es obligatorio.")

        if hora_salida and hora_entrada and hora_salida < hora_entrada:
            raise ErrorDjango("La hora de salida no puede ser anterior a la de entrada.")

        if (inicio_colacion is None) != (fin_colacion is None):
            raise ErrorDjango("Debes indicar tanto el inicio como el fin de colación, o dejar ambos vacíos.")

        if inicio_colacion and fin_colacion:
            if fin_colacion <= inicio_colacion:
                raise ErrorDjango("El fin de colación debe ser posterior al inicio de colación.")
            if hora_entrada and inicio_colacion <= hora_entrada:
                raise ErrorDjango("El inicio de colación debe ser posterior a la hora de entrada.")
            if hora_salida and fin_colacion >= hora_salida:
                raise ErrorDjango("El fin de colación debe ser anterior a la hora de salida.")

        self.corregido_por = usuario_admin
        self.motivo_correccion = motivo
        if hora_entrada is not None:
            self.hora_entrada = hora_entrada
        if hora_salida is not None:
            self.hora_salida = hora_salida
        self.inicio_colacion = inicio_colacion
        self.fin_colacion = fin_colacion
        self.estado = self.Estado.CORREGIDA
        self.save()

    @classmethod
    def _validar_espera(cls, ultimo_marcaje, ahora, etiqueta_siguiente):
        if not ultimo_marcaje:
            return
        tiempo_transcurrido = ahora - ultimo_marcaje
        if tiempo_transcurrido < timedelta(minutes=cls.MINUTOS_ENTRE_MARCAJES):
            minutos_restantes = max(
                1, cls.MINUTOS_ENTRE_MARCAJES - int(tiempo_transcurrido.total_seconds() // 60)
            )
            raise ErrorDjango(
                f"Debes esperar al menos {cls.MINUTOS_ENTRE_MARCAJES} minutos antes de marcar {etiqueta_siguiente} (te faltan {minutos_restantes} min)."
            )

    @classmethod
    def registrar_por_qr(cls, trabajador, token):
        """
        Flujo de 4 marcajes con transacciones atómicas y select_for_update:
        1. Entrada -> EN_JORNADA
        2. Salida a colación -> EN_COLACION
        3. Regreso de colación (2° turno) -> EN_JORNADA
        4. Salida definitiva -> COMPLETA
        """
        try:
            codigo_obj = CodigoQR.objects.get(token=token)
        except CodigoQR.DoesNotExist:
            raise ErrorDjango("El código QR escaneado no es válido.")

        if not codigo_obj.vigente:
            codigo_obj.delete()
            raise ErrorDjango("Este código QR ha expirado.")

        if getattr(trabajador, "rol", None) in ["TRAB", "RECEP"] and trabajador.local_id != codigo_obj.local_id:
            raise ErrorDjango("Estás intentando escanear el QR de una sucursal que no te corresponde.")

        hoy = timezone.localdate()
        ahora = timezone.now()

        with transaction.atomic():
            registro = cls.objects.select_for_update().filter(trabajador=trabajador, fecha=hoy).first()

            # 1. Entrada
            if not registro:
                return cls.objects.create(
                    trabajador=trabajador,
                    local=codigo_obj.local,
                    hora_entrada=ahora,
                    estado=cls.Estado.EN_JORNADA,
                )

            if registro.hora_salida:
                raise ErrorDjango("Ya tienes la asistencia completa registrada para el día de hoy.")

            # 2. Salida a colación
            if not registro.inicio_colacion:
                cls._validar_espera(registro.hora_entrada, ahora, "la salida a colación")
                registro.inicio_colacion = ahora
                registro.estado = cls.Estado.EN_COLACION
                registro.save()
                return registro

            # 3. Regreso de colación (entrada al 2° turno)
            if not registro.fin_colacion:
                cls._validar_espera(registro.inicio_colacion, ahora, "el regreso de colación")
                registro.fin_colacion = ahora
                registro.estado = cls.Estado.EN_JORNADA
                registro.save()
                return registro

            # 4. Salida definitiva
            cls._validar_espera(registro.fin_colacion, ahora, "la salida")
            registro.hora_salida = ahora
            registro.estado = cls.Estado.COMPLETA
            registro.save()
            return registro