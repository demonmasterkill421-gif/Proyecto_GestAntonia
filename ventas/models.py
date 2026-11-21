#Clases de RegistroDeVenta y DetalleDeVenta

from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models import Max
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password



def _redondear(valor): #Función que convierte un valor FLOAT a DECIMAL y lo redondea.
    return int(Decimal(valor).quantize(Decimal("1"), rounding=ROUND_HALF_UP))



#Modelo de RegistroDeVenta
class RegistroDeVenta(models.Model):

    #Clase Método de pago___________________________________________
    class MetodoPago(models.TextChoices):
        EFECTIVO = "EFECTIVO", "Efectivo"
        DEBITO = "DEBITO", "Débito"
        CREDITO = "CREDITO", "Crédito"
        TRANSFERENCIA = "TRANSFER", "Transferencia"

    #Estado de la venta_______________________________________
    class Estado(models.TextChoices):
        BORRADOR = "BORRADOR", "En registro"
        CONFIRMADA = "CONFIRMADA", "Confirmada"
        ANULADA = "ANULADA", "Anulada"


    #Local asociado___________________________________________
    local = models.ForeignKey("locales.Local", on_delete=models.PROTECT, related_name="ventas")


    #Recepcionista asociado___________________________________
    recepcionista = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ventas_registradas",
        limit_choices_to={"rol__in": ["RECEP", "ADMIN"]},
    )



    #Fecha actual___________________________________________
    fecha = models.DateTimeField(default=timezone.now)

    #Descripción Opcional___________________________________________
    descripcion = models.TextField("descripción", blank=True)

    #Método de pago___________________________________________
    metodo_pago = models.CharField("método de pago", max_length=8, choices=MetodoPago.choices, default=MetodoPago.EFECTIVO)

    #Descuento aplicado___________________________________________
    descuento = models.DecimalField(
        "descuento (%)", max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )

    #Monto base___________________________________________
    monto_base = models.PositiveIntegerField("monto base (CLP)", default=0)

    #Monto total___________________________________________
    monto_total = models.PositiveIntegerField("monto total (CLP)", default=0)

    #Estado de la venta___________________________________________
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.BORRADOR)



    #N° de Folio___________________________________________
    folio = models.PositiveIntegerField(null=True, blank=True, editable=False)

    #Lista de Items___________________________________________
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




    #MÉTODOS_______________________________________________________________________________
    

    #Editar si la venta esté en estado BORRADOR___________________________________________
    def _validar_editable(self):
        if self.estado != self.Estado.BORRADOR:
            raise ValidationError("Solo se puede modificar una venta que aún no ha sido confirmada.")



    #Agregar un Item a la lista(Servicio, producto o insumo)___________________________________________
    def agregar_item(self, item, cantidad=1, trabajador=None): #Se obtiene del detalle de la venta
        self._validar_editable() 
        if cantidad < 1:
            raise ValidationError("La cantidad debe ser al menos 1.")

        # Los insumos se descuentan del stock pero NO se cobran: su precio de venta es 0.
        precio = item.precio
        if item.es_producto and item.producto.tipo == "INSUMO":
            precio = 0

        detalle, creado = self.detalles.get_or_create(
            item=item, trabajador=trabajador,
            defaults={"cantidad": cantidad, "precio_unitario": precio},
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

    def aplicar_descuento(self, descuento):
        """aplicarDescuento(descuento: float) => float · RF-R05. Devuelve el nuevo monto total."""
        self._validar_editable()
        descuento = Decimal(str(descuento))
        if not Decimal(0) <= descuento <= Decimal(100):
            raise ValidationError("El descuento debe estar entre 0% y 100%.")
        self.descuento = descuento
        self.recalcular()
        return self.monto_total

    @property
    def factor_descuento(self):
        """Proporción que se cobra después del descuento (ej.: 15% de descuento => 0.85)."""
        return (Decimal(100) - Decimal(self.descuento)) / Decimal(100)

    def recalcular(self):
        """montoBase = suma de los detalles; montoTotal = montoBase menos el descuento."""
        self.monto_base = sum(d.subtotal for d in self.detalles.all())
        self.monto_total = _redondear(Decimal(self.monto_base) * self.factor_descuento)
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

    # ------------------------------------------------------------------ comisiones
    @property
    def comisiones(self):
        """
        Comisión de cada trabajadora que participó en esta venta.
        Devuelve un diccionario {trabajadora: monto_CLP}. Solo cuenta ventas confirmadas.
        """
        if self.estado != self.Estado.CONFIRMADA:
            return {}
        resultado = {}
        for d in self.detalles.select_related("trabajador"):
            if d.trabajador:
                resultado[d.trabajador] = resultado.get(d.trabajador, 0) + d.comision
        return resultado










#Clase Detalle de Venta___________________________________________
class DetalleVenta(models.Model):
    #Por cada item, hay un detalle de venta

    #Venta (FK)_______________________________________________________________________________________
    venta = models.ForeignKey(RegistroDeVenta, on_delete=models.CASCADE, related_name="detalles")

    #Un solo item___________________________________________
    item = models.ForeignKey("catalogo.Item", on_delete=models.PROTECT, related_name="detalles_venta")

    #Cantidad del item___________________________________________
    cantidad = models.PositiveSmallIntegerField(default=1)

    #Precio del Item___________________________________________
    precio_unitario = models.PositiveIntegerField("precio unitario (CLP)")


    #Trabajadora Asociada___________________________________________
    trabajador = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="servicios_realizados", limit_choices_to={"rol": "TRAB"},
        help_text="Trabajadora asignada a este servicio (base de su comisión).",
    )



    class Meta:
        verbose_name = "detalle de venta"
        verbose_name_plural = "detalles de venta"

    def __str__(self):
        return f"{self.item.nombre} x{self.cantidad}"


    #@property sirve para convertir un método en un atributo llamado bajo su propia función
    # por ejemplo, sin: detalle.subtotal(), con: detalle.subtotal




    #Trabajadora Asociada___________________________________________
    @property
    def subtotal(self): #Calcula cuantas unidades se vendieron por el precio de cada uno.
        return self.cantidad * self.precio_unitario

    @property
    def subtotal_con_descuento(self):
        """Subtotal de la línea con el descuento de la venta aplicado proporcionalmente."""
        return _redondear(Decimal(self.subtotal) * self.venta.factor_descuento)

    @property
    def comision(self):
        """Comisión de la trabajadora asignada a esta línea: subtotal con descuento × su porcentaje."""
        if not self.trabajador:
            return 0
        pct = Decimal(self.trabajador.porcentaje_comision) / Decimal(100)
        return _redondear(Decimal(self.subtotal_con_descuento) * pct)

    @classmethod
    def comision_de(cls, trabajadora, desde=None, hasta=None):
        """
        Comisión total de una trabajadora en un período (base para el reporte CU-03).
        Suma las líneas que ella realizó en ventas confirmadas, entre 'desde' y 'hasta' (fechas opcionales).
        """
        lineas = cls.objects.filter(
            trabajador=trabajadora,
            venta__estado=RegistroDeVenta.Estado.CONFIRMADA,
        ).select_related("venta", "trabajador")
        if desde:
            lineas = lineas.filter(venta__fecha__date__gte=desde)
        if hasta:
            lineas = lineas.filter(venta__fecha__date__lte=hasta)
        return sum(d.comision for d in lineas)


class SolicitudAnulacion(models.Model):

    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", "Pendiente"
        APROBADA = "APROBADA", "Aprobada"
        RECHAZADA = "RECHAZADA", "Rechazada"

    venta = models.ForeignKey(
        RegistroDeVenta, on_delete=models.PROTECT, related_name="solicitudes_anulacion",
    )
    solicitante = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="anulaciones_solicitadas",
    )
    motivo = models.TextField()
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.PENDIENTE)
    fecha_solicitud = models.DateTimeField(default=timezone.now)

    resuelta_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="anulaciones_resueltas",
    )
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    respuesta = models.TextField(blank=True)

    class Meta:
        verbose_name = "solicitud de anulación"
        verbose_name_plural = "solicitudes de anulación"
        ordering = ["-fecha_solicitud"]
        constraints = [
            models.UniqueConstraint(
                fields=["venta"],
                condition=models.Q(estado="PENDIENTE"),
                name="una_solicitud_pendiente_por_venta",
            ),
        ]

    def __str__(self):
        return f"Solicitud de anulación · venta #{self.venta_id} · {self.get_estado_display()}"




class ClaveAnulacion(models.Model):

    passw_hash = models.CharField(max_length=128)
    actualizada_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="clave_anulacion_actualizadas", null=True, blank=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def establecer(self, passw):
        self.passw_hash = make_password(passw)
        self.save()

    def validar(self, passw):
        return check_password(passw, self.passw_hash)
