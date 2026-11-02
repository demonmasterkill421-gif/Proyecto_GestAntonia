"""
Tarea 1.4: Buscar o registrar cliente
Responsable: Cristian Salgado
"""
from django.shortcuts import render, redirect
from django.urls import reverse

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido
from .models import Cliente


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

        # 1. Validar que no falten datos
        if not nombre or not telefono_post:
            mensaje_error = "El nombre y el teléfono son obligatorios."
        # 2. Validar las leyes 19.628 y 21.719 (Declarado en los informes)
        elif consentimiento != "on":
            mensaje_error = "Debe aceptar el consentimiento para cumplir la ley de datos."
        # 3. Validar que el teléfono no esté repetido
        elif Cliente.objects.filter(telefono=telefono_post).exists():
            mensaje_error = "Ese teléfono ya está registrado en el sistema."
        else:
            # 4. Si todo está correcto, guardamos y redirigimos
            nuevo_cliente = Cliente.objects.create(
                nombre=nombre,
                telefono=telefono_post,
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
        if telefono_buscado:
            busqueda_realizada = True
            # Buscamos el cliente en la base de datos (HU-03 CA-3)
            cliente_encontrado = Cliente.objects.filter(telefono=telefono_buscado).first()

    # Enviar los datos a la plantilla HTML
    contexto = {
        "telefono_buscado": telefono_buscado,
        "cliente": cliente_encontrado,
        "busqueda_realizada": busqueda_realizada,
        "error": mensaje_error
    }
    return render(request, "reservas/buscar_cliente.html", contexto)