from django.db import transaction

from .models import RegistroDeVenta


@transaction.atomic
def registrar_venta(local, recepcionista, metodoPago, descuento, descripcion, itemsLista):
    """
    Registra una venta completa en una sola transacción: la crea, agrega sus ítems y la confirma
    (descuenta el stock y asigna el folio). Si algún paso falla, no se guarda nada.

    La trabajadora de cada servicio viaja en cada ítem (itemsLista), no en la cabecera de la venta.
    """
    venta = RegistroDeVenta.objects.create(
        local=local,
        recepcionista=recepcionista,
        metodo_pago=metodoPago,
        descuento=descuento,
        descripcion=descripcion,
        estado=RegistroDeVenta.Estado.BORRADOR,
    )

    for item in itemsLista:
        venta.agregar_item(
            item=item["item"],
            cantidad=item["cantidad"],
            trabajador=item.get("trabajador"),
        )

    venta.confirmar_venta()

    return venta