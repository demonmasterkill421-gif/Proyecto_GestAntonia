
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import F


class Item(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField("descripción", blank=True)
    precio = models.PositiveIntegerField("precio (CLP)", help_text="Precio base en pesos chilenos.")
    activo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "ítem"
        verbose_name_plural = "ítems"
        ordering = ["nombre"]

    def __str__(self):
        return f"{self.nombre} (${self.precio:,})".replace(",", ".")

    def precio_en(self, local):
        """Precio del ítem en un local: el precio especial de ese local si la administradora lo
        definió (ej.: el Mall es más caro) o, si no, el precio base."""
        if local is None:
            return self.precio
        especial = self.precios_local.filter(local=local).values_list("precio", flat=True).first()
        return self.precio if especial is None else especial

    @property
    def es_producto(self):
        return hasattr(self, "producto")

    @property
    def es_servicio(self):
        return hasattr(self, "servicio")


class Servicio(Item):
    class Tipo(models.TextChoices):
        MANICURE = "MANICURE", "Manicure"
        PEDICURE = "PEDICURE", "Pedicure"
        DISENO_UNAS = "DISENO_UNAS", "Diseño de uñas"
        DEPILACION = "DEPILACION", "Depilación"
        LIFTING = "LIFTING", "Lifting de pestañas"
        MASAJE = "MASAJE", "Masaje"
        OTRO = "OTRO", "Otro"

    tipo = models.CharField(max_length=12, choices=Tipo.choices)
    duracion = models.PositiveSmallIntegerField("duración (minutos)", default=60)

    class Meta:
        verbose_name = "servicio"
        verbose_name_plural = "servicios"

class Producto(Item):
    class Tipo(models.TextChoices):
        VENTA = "VENTA", "VENTA"
        INSUMO = "INSUMO", "INSUMO"

    tipo = models.CharField(max_length=6, choices=Tipo.choices, default=Tipo.INSUMO)
    costo = models.PositiveIntegerField("costo (CLP)", default=0)
    marca = models.CharField(max_length= 100, blank=True, default="")

    class Meta:
        verbose_name = "producto"
        verbose_name_plural = "productos"

    @transaction.atomic
    def actualizar_stock(self, local, cantidad):
        inventario, _ = (
            Inventario.objects
            .select_for_update()
            .get_or_create(producto=self, local=local))
        if inventario.cantidad + cantidad < 0:
            raise ValidationError(
                f"Stock insuficiente de «{self.nombre}» en {local}: "
                f"hay {inventario.cantidad}, se piden {-cantidad}.")
        if cantidad != 0:
            Inventario.objects.filter(pk=inventario.pk).update(cantidad=F("cantidad") + cantidad)
            MovimientoInventario.objects.create(inventario=inventario,cantidad=cantidad,)
            inventario.refresh_from_db()

        return inventario
    def stock_en(self, local):
        inv = self.inventarios.filter(local=local).first()
        return inv.cantidad if inv else 0


class Inventario(models.Model):
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name="inventarios")
    local = models.ForeignKey("locales.Local", on_delete=models.CASCADE, related_name="inventarios")
    cantidad = models.PositiveIntegerField(default=0)
    stock_minimo = models.PositiveIntegerField("stock mínimo", default=0)

    class Meta:
        verbose_name = "inventario"
        verbose_name_plural = "inventario"
        constraints = [models.UniqueConstraint(fields=["producto", "local"], name="inventario_unico_por_local")]

    def __str__(self):
        return f"{self.producto.nombre} en {self.local}: {self.cantidad}"

    @property
    def bajo_minimo(self):
        return self.cantidad <= self.stock_minimo


class MovimientoInventario(models.Model):
    inventario = models.ForeignKey(Inventario, on_delete=models.CASCADE, related_name="movimientos")
    cantidad = models.IntegerField()
    fecha = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ["-fecha", "-id"]


    def __str__(self):
        tipo = "Entrada" if self.cantidad > 0 else "Salida"
        return f"{tipo} {self.cantidad:+d}"

def es_servicio_otro(item):
    """True solo para el servicio «Otro» de las ventas (tipo OTRO y llamado "Otro"): su nombre y precio
    se escriben a mano al cobrar. Otros servicios de tipo OTRO (ej.: Limpieza facial) cobran su precio."""
    return bool(item.es_servicio and item.servicio.tipo == Servicio.Tipo.OTRO
                and item.nombre.strip().lower() == "otro")


class PrecioLocal(models.Model):
    """Precio especial de un servicio o producto en un local. Sin registro, rige el precio base del ítem."""

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="precios_local")
    local = models.ForeignKey("locales.Local", on_delete=models.CASCADE, related_name="precios_items")
    precio = models.PositiveIntegerField("precio en el local (CLP)")

    class Meta:
        verbose_name = "precio por local"
        verbose_name_plural = "precios por local"
        constraints = [models.UniqueConstraint(fields=["item", "local"], name="precio_unico_por_local")]

    def __str__(self):
        return f"{self.item.nombre} en {self.local}: ${self.precio:,}".replace(",", ".")


def precios_del_local(local):
    """{id_item: precio} con los precios especiales de un local (para listar muchos ítems sin una consulta por cada uno)."""
    if local is None:
        return {}
    return dict(PrecioLocal.objects.filter(local=local).values_list("item_id", "precio"))
