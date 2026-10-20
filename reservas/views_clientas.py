"""
Buscar o registrar clienta (tarea 1.4 · Cristian).

VISTA PROVISIONAL: deja la ruta funcionando. Cristian reemplaza el contenido de este archivo
con la búsqueda por teléfono y el alta con consentimiento.
"""
from django.shortcuts import render

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def buscar_clienta(request):
    return render(request, "reservas/en_construccion.html", {
        "titulo": "Buscar clienta", "tarea": "1.4 · Identificación de la clienta por teléfono y alta",
        "responsable": "Cristian Salgado",
    })
