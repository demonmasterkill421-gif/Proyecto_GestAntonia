from django.db import transaction
from .models import RegistroDeVenta


#Registrar Venta

@transaction.atomic
def registrarVenta(local, recepcionista, trabajador, metodoPago, descuento, descripcion, itemsIniciales=None):

    venta = RegistroDeVenta.objects.create(
        local=local,
        recepcionista=recepcionista,
        trabajador=trabajador,
        metodo_pago=metodoPago,
        descuento=descuento,
        descripcion=descripcion,
        estado=RegistroDeVenta.Estado.BORRADOR
    )

    if itemsIniciales:
        for item in itemsIniciales:
            venta.agregar_item(item=item['item'], cantidad=item['cantidad'  ])


    return venta