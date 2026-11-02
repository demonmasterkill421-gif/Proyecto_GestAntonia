from django.db import transaction
from .models import RegistroDeVenta

@transaction.atomic
def registrar_venta(local, recepcionista, trabajador, metodoPago, descuento, descripcion, itemsLista):

    venta = RegistroDeVenta.objects.create(
        local=local,
        recepcionista=recepcionista,
        trabajador=trabajador,
        metodo_pago=metodoPago,
        descuento=descuento,
        descripcion=descripcion,
        estado=RegistroDeVenta.Estado.BORRADOR
    )
    
    for item in itemsLista:
        venta.agregar_item(item=item['item'], cantidad=item['cantidad'])
        
    venta.confirmar_venta()
    
    return venta