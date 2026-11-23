from django.db import transaction

from .models import RegistroDeVenta


@transaction.atomic
def registrar_venta(local, recepcionista, metodoPago, descuento, descripcion, itemsLista, descuento_monto=0):
    """
    Registra una venta completa en una sola transacción: la crea, agrega sus ítems y la confirma
    (descuenta el stock y asigna el folio). Si algún paso falla, no se guarda nada.
    descuento_monto (pesos) deja el total exacto; si es 0 rige descuento (%).
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
            precio_manual=item.get("precio_manual"),
            nombre_manual=item.get("nombre_manual", ""),
        )

    if descuento_monto:
        # Descuento en pesos: se aplica con todos los ítems ya agregados, para validar contra el subtotal
        venta.aplicar_descuento_monto(descuento_monto)

    venta.confirmar_venta()

    return venta