"""
Tarea 1.4: Buscar o registrar cliente
Responsable: Cristian Salgado
"""
import re  # <--- AGREGADO 1: Librería de Python para limpiar texto

from django.shortcuts import render, redirect
from django.urls import reverse

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido
from .models import Cliente


# <--- AGREGADO 2: Función básica que deja solo los números
def normalizar_telefono(telefono_bruto):
    if not telefono_bruto:
        return ""
    # '\D' significa "todo lo que NO sea un número". Lo reemplaza por nada ('').
    return re.sub(r'\D', '', str(telefono_bruto))


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def buscar_cliente(request):
    # Variables básicas para enviar a la pantalla
    telefono_buscado = ""
    cliente_encontrado = None
    busqueda_realizada = False
    mensaje_error = ""

    # CASO A: Se envió el formulario para GUARDAR un nuevo cliente (POST)
    if request.method == "POST":
        nombre = request.POST.get("nombre")
        telefono_post = request.POST.get("telefono")
        consentimiento = request.POST.get("consentimiento")

        # <--- AGREGADO 3: Limpiamos el teléfono ingresado
        telefono_limpio = normalizar_telefono(telefono_post)

        # 1. Validar que no falten datos
        if not nombre or not telefono_post:
            mensaje_error = "El nombre y el teléfono son obligatorios."
        # 2. Validar las leyes 19.628 y 21.719 (Declarado en los informes)
        elif consentimiento != "on":
            mensaje_error = "Debe aceptar el consentimiento para cumplir la ley de datos."
        # 3. Validar que el teléfono no esté repetido (usamos el LIMPIO)
        elif Cliente.objects.filter(telefono=telefono_limpio).exists():
            mensaje_error = "Ese teléfono ya está registrado en el sistema."
        else:
            # 4. Si todo está correcto, guardamos y redirigimos (guardamos el LIMPIO)
            nuevo_cliente = Cliente.objects.create(
                nombre=nombre,
                telefono=telefono_limpio, 
                consentimiento=True
            )
            # Redirige a agendar la hora llevando el ID del cliente nuevo
            url = reverse("reservas:nueva") + f"?cliente={nuevo_cliente.id}"
            return redirect(url)

        # Si hubo error, dejamos los datos para que el usuario los vea
        telefono_buscado = telefono_post
        busqueda_realizada = True

    # CASO B: El usuario solo está BUSCANDO un teléfono (GET)
    else:
        telefono_buscado = request.GET.get("telefono", "")
        
        # <--- AGREGADO 4: Limpiamos el teléfono que se está buscando
        telefono_limpio = normalizar_telefono(telefono_buscado)
        
        if telefono_limpio:
            busqueda_realizada = True
            # Buscamos el cliente en la base de datos con el teléfono LIMPIO
            cliente_encontrado = Cliente.objects.filter(telefono=telefono_limpio).first()

    # Enviar los datos a la plantilla HTML
    contexto = {
        "telefono_buscado": telefono_buscado,
        "cliente": cliente_encontrado,
        "busqueda_realizada": busqueda_realizada,
        "error": mensaje_error
    }
    return render(request, "reservas/buscar_cliente.html", contexto)