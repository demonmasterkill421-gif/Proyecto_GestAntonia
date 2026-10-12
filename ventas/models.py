"""
Bloque «RegistroDeVenta» del diagrama de clases (CU-01 Registrar atención · RF-R01 a RF-R05).

RegistroDeVenta (idVenta, fecha, descripcion, descuento, items[], montoBase, montoTotal) se relaciona con:
  - Local (1..1): local donde se realiza la venta.
  - Recepcionista (1..1, «Registra»): quien la ingresa al sistema.
  - Trabajador (0..1, «pertenece»): quien realiza el servicio; se usa para calcular su comisión.
  - Item (1..*, «Contiene»): a través de DetalleVenta, que guarda cantidad y precio del momento.
"""
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models import Max
from django.utils import timezone


class RegistroDeVenta(models.Model):
    class MetodoPago(models.TextChoices):
        EFECTIVO = "EFECTIVO", "Efectivo"
        DEBITO = "DEBITO", "Débito"
        CREDITO = "CREDITO", "Crédito"
        TRANSFERENCIA = "TRANSFER", "Transferencia"

    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "En registro"
        CONFIRMADA = "CONFIRMADA", "Confirmada"
        ANULADA = "ANULADA", "Anulada"

    local = models.ForeignKey("locales.Local", on_delete=models.PROTECT, related_name="ventas")
    recepcionista = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ventas_registradas",
        limit_choices_to={"rol__in": ["RECEP", "ADMIN"]},
    )
    trabajador = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="atenciones", limit_choices_to={"rol": "TRAB"},
        help_text="Trabajadora encargada del servicio.",
    )
    fecha = models.DateTimeField(default=timezone.now)
    descripcion = models.TextField("descripción", blank=True)
    metodo_pago = models.CharField("método de pago", max_length=8, choices=MetodoPago.choices,
                                   default=MetodoPago.EFECTIVO)
    descuento = models.DecimalField(
        "descuento (%)", max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    monto_base = models.PositiveIntegerField("monto base (CLP)", default=0)
    monto_total = models.PositiveIntegerField("monto total (CLP)", default=0)
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.BORRADOR)
    folio = models.PositiveIntegerField(null=True, blank=True, editable=False,
                                        help_text="N° de boleta correlativo por local (RF-R04).")
    items = models.ManyToManyField("catalogo.Item", through="DetalleVenta", related_name="ventas")

    class Meta:
        verbose_name = "registro de venta"
        verbose_name_plural = "registros de venta"
        ordering = ["-fecha"]
        constraints = [
            models.UniqueConstraint(fields=["local", "folio"], name="folio_unico_por_local"),
        ]

    def __str__(self):
        folio = f"Boleta {self.folio}" if self.folio else f"Venta #{self.pk}"
        return f"{folio} · {self.local} · ${self.monto_total:,}".replace(",", ".")

    # ------------------------------------------------------------------ métodos del diagrama
    def _validar_editable(self):
        if self.estado != self.Estado.BORRADOR:
            raise ValidationError("Solo se puede modificar una venta que aún no ha sido confirmada.")

    def agregar_item(self, item, cantidad=1):
        """agregarItem(idItem): agrega un servicio, producto o insumo (o suma cantidad si ya estaba)."""
        self._validar_editable()
        if cantidad < 1:
            raise ValidationError("La cantidad debe ser al menos 1.")
        detalle, creado = self.detalles.get_or_create(
            item=item, defaults={"cantidad": cantidad, "precio_unitario": item.precio},
        )
        if not creado:
            detalle.cantidad += cantidad
            detalle.save(update_fields=["cantidad"])
        self.recalcular()
        return detalle

    def quitar_item(self, item):
        """quitarItem(idItem)."""
        self._validar_editable()
        eliminados, _ = self.detalles.filter(item=item).delete()
        self.recalcular()
        return eliminados > 0

    def asociar_trabajador(self, trabajador):
        """asociarTrabajador(idTrabajador)."""
        self._validar_editable()
        if trabajador.rol != "TRAB":
            raise ValidationError("Solo se puede asociar un usuario con rol Trabajador.")
        self.trabajador = trabajador
        self.save(update_fields=["trabajador"])

    def aplicar_descuento(self, descuento):
        """aplicarDescuento(descuento: float) => float · RF-R05. Devuelve el nuevo monto total."""
        self._validar_editable()
        descuento = Decimal(str(descuento))
        if not Decimal(0) <= descuento <= Decimal(100):
            raise ValidationError("El descuento debe estar entre 0% y 100%.")
        self.descuento = descuento
        self.recalcular()
        return self.monto_total

    def recalcular(self):
        """montoBase = suma de los detalles; montoTotal = montoBase menos el descuento."""
        self.monto_base = sum(d.subtotal for d in self.detalles.all())
        factor = (Decimal(100) - Decimal(self.descuento)) / Decimal(100)
        self.monto_total = int((Decimal(self.monto_base) * factor).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        self.save(update_fields=["monto_base", "monto_total", "descuento"])

    @transaction.atomic
    def confirmar_venta(self):
        """confirmarVenta(): Bool · valida, descuenta stock y asigna el folio de la boleta (RF-R02 a RF-R04)."""
        venta = RegistroDeVenta.objects.select_for_update().get(pk=self.pk)
        venta._validar_editable()
        detalles = list(venta.detalles.select_related("item__producto"))
        if not detalles:
            raise ValidationError("La venta no tiene servicios ni productos.")
        for d in detalles:
            if d.item.es_producto:
                d.item.producto.actualizar_stock(venta.local, -d.cantidad)
        ultimo = (RegistroDeVenta.objects.select_for_update()
                  .filter(local=venta.local).aggregate(m=Max("folio"))["m"]) or 0
        venta.folio = ultimo + 1
        venta.estado = self.Estado.CONFIRMADA
        venta.fecha = timezone.now()
        venta.save(update_fields=["folio", "estado", "fecha"])
        self.refresh_from_db()
        return True

    @transaction.atomic
    def anular(self):
        """Anula una venta confirmada y devuelve el stock al local."""
        if self.estado != self.Estado.CONFIRMADA:
            raise ValidationError("Solo se puede anular una venta confirmada.")
        for d in self.detalles.select_related("item__producto"):
            if d.item.es_producto:
                d.item.producto.actualizar_stock(self.local, d.cantidad)
        self.estado = self.Estado.ANULADA
        self.save(update_fields=["estado"])

    @property
    def comision_trabajador(self):
        """Comisión de la trabajadora según su porcentaje (base para el reporte CU-03)."""
        if not self.trabajador or self.estado != self.Estado.CONFIRMADA:
            return 0
        pct = Decimal(self.trabajador.porcentaje_comision) / Decimal(100)
        return int((Decimal(self.monto_total) * pct).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


class DetalleVenta(models.Model):
    """Cada ítem contenido en una venta, con la cantidad y el precio al momento de vender."""
    venta = models.ForeignKey(RegistroDeVenta, on_delete=models.CASCADE, related_name="detalles")
    item = models.ForeignKey("catalogo.Item", on_delete=models.PROTECT, related_name="detalles_venta")
    cantidad = models.PositiveSmallIntegerField(default=1)
    precio_unitario = models.PositiveIntegerField("precio unitario (CLP)")

    class Meta:
        verbose_name = "detalle de venta"
        verbose_name_plural = "detalles de venta"
        constraints = [models.UniqueConstraint(fields=["venta", "item"], name="item_unico_por_venta")]

    def __str__(self):
        return f"{self.item.nombre} x{self.cantidad}"

    @property
    def subtotal(self):
        return self.cantidad * self.precio_unitario
