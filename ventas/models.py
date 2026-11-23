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

#Límites del servicio "Otro" (precio y nombre escritos a mano por la recepcionista)
PRECIO_MANUAL_MAXIMO = 100000
NOMBRE_MANUAL_MAXIMO = 100



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

    #Descuento en pesos___________________________________________
    # Si es mayor que 0, el descuento es un monto fijo (ej.: dejar la venta "en 80 mil cerrados") y
    # "descuento" (%) solo informa a cuánto equivale. Si es 0, rige el porcentaje.
    descuento_monto = models.PositiveIntegerField("descuento en pesos (CLP)", default=0)

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
    def agregar_item(self, item, cantidad=1, trabajador=None, precio_manual=None, nombre_manual=""): #Se obtiene del detalle de la venta
        self._validar_editable() 
        if cantidad < 1:
            raise ValidationError("La cantidad debe ser al menos 1.")

        # El % de comisión se guarda en la línea: si después cambia, las ventas ya hechas no cambian.
        porcentaje, por_servicio = None, False
        if trabajador is not None:
            from reservas.comisiones import porcentaje_comision  # import local: evita importaciones circulares
            porcentaje, por_servicio = porcentaje_comision(trabajador, item)

        # Servicio "Otro": el precio y el nombre los escribió la recepcionista.
        # Cada uno queda en su propia línea; si se juntaran con otro igual, se perdería su precio.
        if precio_manual is not None:
            nombre_manual = (nombre_manual or "").strip()
            if not nombre_manual:
                raise ValidationError("Escribe el nombre del servicio.")
            if len(nombre_manual) > NOMBRE_MANUAL_MAXIMO:
                raise ValidationError(f"El nombre del servicio no puede superar los {NOMBRE_MANUAL_MAXIMO} caracteres.")
            if not 1 <= precio_manual <= PRECIO_MANUAL_MAXIMO:
                raise ValidationError(f"El precio debe estar entre $1 y ${PRECIO_MANUAL_MAXIMO:,}.".replace(",", "."))
            detalle = self.detalles.create(
                item=item, cantidad=cantidad, trabajador=trabajador,
                precio_unitario=precio_manual, nombre_manual=nombre_manual, es_precio_manual=True,
                porcentaje_comision=porcentaje, comision_por_servicio=por_servicio,
            )
            self.recalcular()
            return detalle

        # Precio del local de la venta (el Mall puede tener otro precio). Los insumos se descuentan
        # del stock pero NO se cobran: su precio de venta es 0.
        precio = item.precio_en(self.local)
        if item.es_producto and item.producto.tipo == "INSUMO":
            precio = 0

        detalle, creado = self.detalles.get_or_create(
            item=item, trabajador=trabajador, es_precio_manual=False,
            defaults={"cantidad": cantidad, "precio_unitario": precio,
                      "porcentaje_comision": porcentaje, "comision_por_servicio": por_servicio},
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
        self.descuento_monto = 0
        self.recalcular()
        return self.monto_total

    def aplicar_descuento_monto(self, monto):
        """Descuento fijo en pesos: el total queda exacto (85.000 - 5.000 = 80.000)."""
        self._validar_editable()
        monto = int(monto)
        if monto < 0:
            raise ValidationError("El descuento no puede ser negativo.")
        self.descuento_monto = monto
        self.recalcular()
        return self.monto_total

    @property
    def factor_descuento(self):
        """Proporción que se cobra después del descuento (ej.: 15% de descuento => 0.85).
        Con descuento en pesos es total / base, para repartirlo entre las líneas (y las comisiones)."""
        if self.descuento_monto and self.monto_base:
            return Decimal(self.monto_base - min(self.descuento_monto, self.monto_base)) / Decimal(self.monto_base)
        return (Decimal(100) - Decimal(self.descuento)) / Decimal(100)

    @property
    def descuento_clp(self):
        """Cuántos pesos se descontaron, sea cual sea el tipo de descuento."""
        return self.monto_base - self.monto_total

    def recalcular(self):
        """montoBase = suma de los detalles; montoTotal = montoBase menos el descuento."""
        self.monto_base = sum(d.subtotal for d in self.detalles.all())
        if self.descuento_monto:
            if self.descuento_monto > self.monto_base:
                raise ValidationError("El descuento no puede ser mayor que el subtotal de la venta.")
            self.monto_total = self.monto_base - self.descuento_monto
            # El % queda como referencia (a cuánto equivale el monto descontado)
            self.descuento = (Decimal(self.descuento_monto) * 100 / Decimal(self.monto_base)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP)
        else:
            self.monto_total = _redondear(Decimal(self.monto_base) * self.factor_descuento)
        self.save(update_fields=["monto_base", "monto_total", "descuento", "descuento_monto"])

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

    #Servicio "Otro": nombre escrito por la recepcionista y marca de que el precio se puso a mano___________________________________________
    nombre_manual = models.CharField("nombre manual", max_length=100, blank=True, default="")
    es_precio_manual = models.BooleanField("precio manual", default=False)


    #Trabajadora Asociada___________________________________________
    # PROTECT: una trabajadora con ventas no se puede borrar (se desactiva), así sus ventas y
    # comisiones siguen en los reportes.
    trabajador = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
        related_name="servicios_realizados", limit_choices_to={"rol": "TRAB"},
        help_text="Trabajadora asignada a este servicio (base de su comisión).",
    )

    #% de comisión al momento de la venta___________________________________________
    porcentaje_comision = models.DecimalField(
        "% de comisión", max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="% de la trabajadora para este servicio, guardado al registrar la venta.",
    )
    # True: el % es el que la administradora definió para ese servicio y esa trabajadora.
    # False: no había % para ese servicio y se usó la comisión base de la trabajadora.
    comision_por_servicio = models.BooleanField(default=False)



    class Meta:
        verbose_name = "detalle de venta"
        verbose_name_plural = "detalles de venta"

    def __str__(self):
        return f"{self.nombre_manual or self.item.nombre} x{self.cantidad}"

    @property
    def nombre_visible(self):
        """Nombre para boletas y reportes: el que escribió la recepcionista en el servicio «Otro»."""
        return self.nombre_manual or self.item.nombre


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
        if not self.trabajador_id:
            return 0
        return _redondear(Decimal(self.subtotal_con_descuento) * self.porcentaje_aplicado / Decimal(100))

    @property
    def porcentaje_aplicado(self):
        """El % guardado en la venta; en ventas antiguas sin él, el % base actual de la trabajadora."""
        if self.porcentaje_comision is not None:
            return Decimal(self.porcentaje_comision)
        if not self.trabajador_id:
            return Decimal(0)
        return Decimal(self.trabajador.porcentaje_comision or 0)

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

    def establecer(self, passw, user=None):
        self.passw_hash = make_password(passw)
        self.actualizada_por = user
        self.save()

    def save(self, *args, **kwargs):
        # Solo puede haber una clave en todo el sistema: siempre se guarda en la misma fila
        self.pk = 1
        super().save(*args, **kwargs)

    def validar(self, passw):
        return check_password(passw, self.passw_hash)