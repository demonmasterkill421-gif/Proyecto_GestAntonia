"""
Nueva reserva 

VISTA PROVISIONAL: deja la ruta funcionando para que la agenda pueda enlazarla.
José reemplaza el contenido de este archivo con el formulario y la validación de disponibilidad.
"""
from django.shortcuts import render

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def nueva_reserva(request):
    return render(request, "reservas/en_construccion.html", {
        "titulo": "Nueva reserva", "tarea": "1.3 · Registro de reserva con validación de disponibilidad",
        "responsable": "José Flores",
    })
