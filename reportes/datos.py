"""Datos del reporte de un local en un período (CU-03).

Una sola fuente para la pantalla de Reportes, el Excel y el PDF: así los tres muestran
exactamente las mismas cifras. Solo cuentan las ventas CONFIRMADAS (las anuladas se informan aparte).
"""
from collections import Counter, defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from asistencia.models import RegistroDeAsistencia
from locales.models import Local
from usuarios.models import Usuario
from ventas.models import DetalleVenta, RegistroDeVenta

DIAS_MAXIMOS = 93
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
METODOS = dict(RegistroDeVenta.MetodoPago.choices)


class ErrorReporte(Exception):
    """Parámetros inválidos: el mensaje se muestra tal cual a la administradora."""

    def __init__(self, mensaje, codigo=400):
        super().__init__(mensaje)
        self.mensaje, self.codigo = mensaje, codigo


def _fecha(valor):
    try:
        return date.fromisoformat(valor)
    except (TypeError, ValueError):
        return None


def leer_parametros(query_params):
    """Valida local_id, desde y hasta. Devuelve (local, desde, hasta) o lanza ErrorReporte."""
    hoy = timezone.localdate()
    if "desde" in query_params and _fecha(query_params["desde"]) is None:
        raise ErrorReporte("Fecha 'desde' inválida.")
    if "hasta" in query_params and _fecha(query_params["hasta"]) is None:
        raise ErrorReporte("Fecha 'hasta' inválida.")
    desde = _fecha(query_params.get("desde")) or hoy.replace(day=1)
    hasta = _fecha(query_params.get("hasta")) or hoy
    if hasta < desde:
        raise ErrorReporte("La fecha final no puede ser anterior a la inicial.")
    if (hasta - desde).days > DIAS_MAXIMOS - 1:
        raise ErrorReporte(f"Selecciona un período de hasta {DIAS_MAXIMOS} días.")
    local_id = query_params.get("local_id")
    if not local_id or not str(local_id).isdecimal():
        raise ErrorReporte("Debes seleccionar un local válido.")
    local = Local.objects.filter(pk=int(local_id)).first()
    if local is None:
        raise ErrorReporte("El local seleccionado no existe.", 404)
    return local, desde, hasta


def porcentaje_variacion(actual, anterior):
    if not anterior:
        return None
    return round((actual - anterior) * 100 / anterior, 1)


def _pct(parte, total):
    return round(parte * 100 / total, 1) if total else 0.0


def _nombre(usuario):
    return (usuario.get_full_name() or usuario.email).strip()


def _texto_pct(valor):
    """12.50 -> "12,5 %" (como se escribe en Chile)."""
    valor = Decimal(valor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP).normalize()
    return f"{valor:f}".replace(".", ",") + " %"


def _ventas(local, desde, hasta, estado=RegistroDeVenta.Estado.CONFIRMADA):
    return RegistroDeVenta.objects.filter(local=local, estado=estado, fecha__date__range=(desde, hasta))


def construir_reporte(local, desde, hasta, con_detalle=False):
    """Diccionario con todo el reporte. con_detalle agrega las líneas de venta y la asistencia día a día
    (para el Excel, donde la administradora hace sus propias tablas dinámicas)."""
    ventas = list(_ventas(local, desde, hasta).order_by("fecha"))
    ids_ventas = [v.pk for v in ventas]
    ingresos = sum(v.monto_total for v in ventas)
    descuentos = sum(v.descuento_clp for v in ventas)

    # Período anterior con la misma cantidad de días: variación real
    dias = (hasta - desde).days + 1
    antes_hasta = desde - timedelta(days=1)
    antes_desde = antes_hasta - timedelta(days=dias - 1)
    ventas_antes = _ventas(local, antes_desde, antes_hasta)
    resumen_antes = ventas_antes.aggregate(total=Sum("monto_total"), n=Count("id"))
    ingresos_antes = resumen_antes["total"] or 0
    n_ventas_antes = resumen_antes["n"] or 0
    servicios_antes = DetalleVenta.objects.filter(
        venta__in=ventas_antes, item__servicio__isnull=False
    ).aggregate(total=Sum("cantidad"))["total"] or 0

    anuladas = _ventas(local, desde, hasta, RegistroDeVenta.Estado.ANULADA).aggregate(
        n=Count("id"), total=Sum("monto_total"))

    lineas = list(
        DetalleVenta.objects.filter(venta_id__in=ids_ventas)
        .select_related("venta", "trabajador", "item__servicio", "item__producto")
        .order_by("venta__fecha", "pk")
    )

    # ---------------------------------------------------------------- por día, semana y hora
    por_dia = defaultdict(lambda: {"ganancias": 0, "ventas": 0, "servicios": 0})
    por_semana = defaultdict(lambda: {"ganancias": 0, "ventas": 0})
    por_hora = defaultdict(lambda: {"ganancias": 0, "ventas": 0})
    por_metodo = defaultdict(lambda: {"ventas": 0, "monto": 0})
    for v in ventas:
        momento = timezone.localtime(v.fecha)
        clave = momento.date().isoformat()
        por_dia[clave]["ganancias"] += v.monto_total
        por_dia[clave]["ventas"] += 1
        por_semana[momento.weekday()]["ganancias"] += v.monto_total
        por_semana[momento.weekday()]["ventas"] += 1
        por_hora[momento.hour]["ganancias"] += v.monto_total
        por_hora[momento.hour]["ventas"] += 1
        por_metodo[v.metodo_pago]["ventas"] += 1
        por_metodo[v.metodo_pago]["monto"] += v.monto_total

    # ---------------------------------------------------------------- servicios, productos, insumos
    servicios = defaultdict(lambda: {"cantidad": 0, "ingresos": 0, "tipo": ""})
    productos = defaultdict(lambda: {"cantidad": 0, "ingresos": 0})
    insumos = Counter()
    for d in lineas:
        momento = timezone.localtime(d.venta.fecha).date().isoformat()
        if d.item.es_servicio:
            fila = servicios[d.nombre_visible]
            fila["cantidad"] += d.cantidad
            fila["ingresos"] += d.subtotal_con_descuento
            fila["tipo"] = d.item.servicio.get_tipo_display()
            por_dia[momento]["servicios"] += d.cantidad
        elif d.item.producto.tipo == "INSUMO":
            insumos[d.nombre_visible] += d.cantidad
        else:
            productos[d.nombre_visible]["cantidad"] += d.cantidad
            productos[d.nombre_visible]["ingresos"] += d.subtotal_con_descuento
    total_servicios = sum(s["cantidad"] for s in servicios.values())

    # ---------------------------------------------------------------- trabajadoras y comisiones
    # Aparecen las activas del local Y cualquiera que haya atendido en el período, aunque hoy esté
    # desactivada o en otro local: sus ventas y comisiones del período no se pierden.
    con_lineas = {d.trabajador_id for d in lineas if d.trabajador_id}
    trabajadoras = list(
        Usuario.objects.filter(rol=Usuario.Rol.TRABAJADOR, local=local, is_active=True)
        | Usuario.objects.filter(pk__in=con_lineas)
    )
    trabajadoras = sorted(set(trabajadoras), key=lambda t: (not t.is_active, _nombre(t).lower()))

    horas = defaultdict(float)
    dias_trabajados = defaultdict(set)
    asistencias = list(
        RegistroDeAsistencia.objects.filter(
            local=local, fecha__range=(desde, hasta), trabajador_id__in=[t.pk for t in trabajadoras]
        ).select_related("trabajador").order_by("fecha", "trabajador__first_name")
    )
    for a in asistencias:
        horas[a.trabajador_id] += a.horas_trabajadas
        dias_trabajados[a.trabajador_id].add(a.fecha)

    # Desglose: una fila por trabajadora, servicio y % (si el % cambió a mitad de período, salen dos filas)
    desglose = defaultdict(lambda: {"cantidad": 0, "ventas": 0, "comision": 0})
    totales_t = defaultdict(lambda: {"servicios": 0, "ventas": 0, "comision": 0})
    for d in lineas:
        if not d.trabajador_id:
            continue
        pct = d.porcentaje_aplicado
        clave = (d.trabajador_id, d.nombre_visible, pct, d.comision_por_servicio)
        fila = desglose[clave]
        fila["cantidad"] += d.cantidad
        fila["ventas"] += d.subtotal_con_descuento
        fila["comision"] += d.comision
        tot = totales_t[d.trabajador_id]
        tot["servicios"] += d.cantidad if d.item.es_servicio else 0
        tot["ventas"] += d.subtotal_con_descuento
        tot["comision"] += d.comision

    filas_trabajadoras = []
    for t in trabajadoras:
        detalle = [
            {
                "servicio": servicio,
                "cantidad": datos["cantidad"],
                "ventas": datos["ventas"],
                "porcentaje": float(pct),
                "porcentajeTexto": _texto_pct(pct),
                # False: no había % para ese servicio y se usó la comisión base de la trabajadora
                "porServicio": bool(por_servicio),
                "comision": datos["comision"],
            }
            for (tid, servicio, pct, por_servicio), datos in sorted(
                desglose.items(), key=lambda par: (par[0][1].lower(), par[0][2]))
            if tid == t.pk
        ]
        if not t.is_active:
            estado = "Inactiva"
        elif t.local_id != local.pk:
            estado = "En otro local"
        else:
            estado = "Activa"
        filas_trabajadoras.append({
            "id": t.pk,
            "nombre": _nombre(t),
            "cargo": t.get_cargo_display() if t.cargo else "",
            "comisionBase": float(t.porcentaje_comision or 0),
            "servicios": totales_t[t.pk]["servicios"],
            "ventas": totales_t[t.pk]["ventas"],
            "asistencia": None,  # No hay turnos programados: el % de asistencia no se puede calcular
            "horas": round(horas[t.pk], 1),
            "dias": len(dias_trabajados[t.pk]),
            "comision": totales_t[t.pk]["comision"],
            "estado": estado,
            "detalleComision": detalle,
        })

    activas = sum(1 for t in trabajadoras if t.is_active and t.local_id == local.pk)
    comisiones_total = sum(f["comision"] for f in filas_trabajadoras)

    ganancias_diarias = []
    for i in range(dias):
        dia = desde + timedelta(days=i)
        datos = por_dia[dia.isoformat()]
        ganancias_diarias.append({
            "fecha": dia.isoformat(), "dia": DIAS_SEMANA[dia.weekday()],
            "ganancias": datos["ganancias"], "ventas": datos["ventas"], "servicios": datos["servicios"],
        })

    lista_servicios = sorted(
        ({"nombre": n, "tipo": s["tipo"], "cantidad": s["cantidad"], "ingresos": s["ingresos"],
          "porcentaje": _pct(s["cantidad"], total_servicios)} for n, s in servicios.items()),
        key=lambda s: (-s["cantidad"], s["nombre"]),
    )

    reporte = {
        "modo": "api",
        "sucursal": {"id": local.pk, "name": local.nombre},
        "periodo": {"desde": desde.isoformat(), "hasta": hasta.isoformat(), "dias": dias,
                    "anteriorDesde": antes_desde.isoformat(), "anteriorHasta": antes_hasta.isoformat()},
        "hayDatos": bool(ventas),
        "indicadores": {
            "ganancias": ingresos,
            "variacionGanancias": porcentaje_variacion(ingresos, ingresos_antes),
            "gananciasAnterior": ingresos_antes,
            "servicios": total_servicios,
            "variacionServicios": total_servicios - servicios_antes if servicios_antes else None,
            "serviciosAnterior": servicios_antes,
            "ventas": len(ventas),
            "ventasAnterior": n_ventas_antes,
            "ticketPromedio": round(ingresos / len(ventas)) if ventas else 0,
            "ticketPromedioAnterior": round(ingresos_antes / n_ventas_antes) if n_ventas_antes else 0,
            "descuentos": descuentos,
            "comisiones": comisiones_total,
            "anuladas": anuladas["n"] or 0,
            "montoAnuladas": anuladas["total"] or 0,
            "trabajadoresActivos": activas,
            "sucursales": 1,
            "asistencia": None,
            "variacionAsistencia": None,
        },
        "gananciasDiarias": ganancias_diarias,
        # Los 5 servicios más pedidos, para el gráfico de la pantalla
        "serviciosPorTipo": [{"nombre": s["nombre"], "porcentaje": s["porcentaje"]} for s in lista_servicios[:5]],
        "servicios": lista_servicios,
        "productos": sorted(
            ({"nombre": n, **p} for n, p in productos.items()), key=lambda p: (-p["ingresos"], p["nombre"])),
        "insumos": [{"nombre": n, "cantidad": c} for n, c in insumos.most_common()],
        "metodosPago": [
            {"metodo": METODOS.get(m, m), "ventas": d["ventas"], "monto": d["monto"],
             "porcentaje": _pct(d["monto"], ingresos)}
            for m, d in sorted(por_metodo.items(), key=lambda par: -par[1]["monto"])
        ],
        "diasSemana": [
            {"dia": DIAS_SEMANA[i], "ventas": por_semana[i]["ventas"], "ganancias": por_semana[i]["ganancias"],
             "promedio": round(por_semana[i]["ganancias"] / max(1, sum(
                 1 for k in range(dias) if (desde + timedelta(days=k)).weekday() == i)))}
            for i in range(7)
        ],
        "horas": [
            {"hora": f"{h:02d}:00", "ventas": por_hora[h]["ventas"], "ganancias": por_hora[h]["ganancias"]}
            for h in sorted(por_hora)
        ],
        "trabajadores": filas_trabajadoras,
        "comparativaLocales": comparar_locales(desde, hasta),
    }

    if con_detalle:
        reporte["lineas"] = [
            {
                "folio": d.venta.folio,
                "fecha": timezone.localtime(d.venta.fecha),
                "metodo": METODOS.get(d.venta.metodo_pago, d.venta.metodo_pago),
                "item": d.nombre_visible,
                "clase": "Servicio" if d.item.es_servicio else (
                    "Insumo" if d.item.producto.tipo == "INSUMO" else "Producto"),
                "tipo": d.item.servicio.get_tipo_display() if d.item.es_servicio else "",
                "cantidad": d.cantidad,
                "precio": d.precio_unitario,
                "subtotal": d.subtotal,
                "neto": d.subtotal_con_descuento,
                "trabajadora": _nombre(d.trabajador) if d.trabajador_id else "",
                "porcentaje": float(d.porcentaje_aplicado) if d.trabajador_id else None,
                "comision": d.comision,
            }
            for d in lineas
        ]
        reporte["asistencias"] = [
            {
                "fecha": a.fecha,
                "trabajadora": _nombre(a.trabajador),
                "entrada": timezone.localtime(a.hora_entrada) if a.hora_entrada else None,
                "salida": timezone.localtime(a.hora_salida) if a.hora_salida else None,
                "horas": a.horas_trabajadas,
                "estado": a.get_estado_display(),
            }
            for a in asistencias
        ]
    return reporte


def comparar_locales(desde, hasta):
    """Los locales lado a lado en el mismo período, para comparar."""
    filas = []
    for local in Local.objects.order_by("nombre"):
        resumen = _ventas(local, desde, hasta).aggregate(total=Sum("monto_total"), n=Count("id"))
        total, n = resumen["total"] or 0, resumen["n"] or 0
        servicios = DetalleVenta.objects.filter(
            venta__local=local, venta__estado=RegistroDeVenta.Estado.CONFIRMADA,
            venta__fecha__date__range=(desde, hasta), item__servicio__isnull=False,
        ).aggregate(total=Sum("cantidad"))["total"] or 0
        filas.append({"local": local.nombre, "ventas": n, "ganancias": total, "servicios": servicios,
                      "ticketPromedio": round(total / n) if n else 0})
    total = sum(f["ganancias"] for f in filas)
    for f in filas:
        f["participacion"] = _pct(f["ganancias"], total)
    return filas
