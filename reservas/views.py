"""la recepcionista ve las reservas de su local."""
from datetime import date, datetime, time, timedelta

from django.shortcuts import render
from django.utils import timezone
from django.utils.timezone import make_aware

from usuarios.models import Usuario
from usuarios.permisos import rol_requerido

from .models import Reserva


@rol_requerido(Usuario.Rol.RECEPCIONISTA)
def agenda_del_dia(request):
    # 1. Sacar la fecha del buscador (o poner la de hoy si falla)
    try:
        fecha = date.fromisoformat(request.GET.get("fecha", ""))
    except ValueError:
        fecha = timezone.localdate()

    # 2. Saber en qué local trabaja la recepcionista actual
    local = request.user.local 
    
    # 3. Buscar a las especialistas que trabajan en este local
    especialistas = Usuario.objects.filter(rol=Usuario.Rol.TRABAJADOR, local=local)

    # 4. Buscar todas las reservas de hoy en este local (que no estén canceladas)
    reservas_del_dia = list(
        Reserva.objects.filter(local=local, inicio__date=fecha)
        .exclude(estado=Reserva.Estado.CANCELADA)
        .select_related("cliente", "especialista", "servicio")
    )

    # 5. Armar los bloques de tiempo (desde las 09:00 hasta las 20:00 cada 30 min)
    bloques = []
    hora_actual = datetime.combine(fecha, time(9, 0))
    hora_final = datetime.combine(fecha, time(20, 0))

    while hora_actual <= hora_final:
        # Django necesita saber que la hora tiene "zona horaria" para comparar
        hora_aware = make_aware(hora_actual)
        
        # Armamos una fila para la tabla
        fila = {
            "hora_texto": hora_actual.time().strftime("%H:%M"),
            "celdas": []
        }
        
        # Revisamos si cada especialista está libre u ocupada a esta hora
        for esp in especialistas:
            esta_ocupada = False
            nombre_clienta = ""
            
            for res in reservas_del_dia:
                # Si la hora actual está entre el inicio y el fin de la reserva de esta especialista
                if res.especialista == esp and res.inicio <= hora_aware < res.fin:
                    esta_ocupada = True
                    nombre_clienta = res.cliente.nombre
                    break
            
            # Guardamos el resultado de la especialista en la celda
            if esta_ocupada:
                fila["celdas"].append({"estado": "Ocupado", "clienta": nombre_clienta})
            else:
                fila["celdas"].append({"estado": "Libre", "clienta": ""})
        
        # Agregamos la fila a los bloques y sumamos 30 minutos
        bloques.append(fila)
        hora_actual += timedelta(minutes=30)

    # Mandamos todo al HTML
    contexto = {
        "fecha": fecha, 
        "local": local, 
        "especialistas": especialistas,
        "bloques": bloques
    }
    return render(request, "reservas/agenda.html", contexto)