from django.db import transaction

from .models import RegistroDeVenta


@transaction.atomic
def registrar_venta(local, recepcionista, metodoPago, descuento, descripcion, itemsLista):
    
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

    venta.confirmar_venta()

    return venta