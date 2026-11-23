"""Boleta de una venta en PDF, en el ancho de las impresoras de boletas (80 mm) y lista para imprimir.

Es un comprobante interno del local: no reemplaza la boleta electrónica del SII.
"""
from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

ANCHO = 80 * mm
MARGEN = 5 * mm
UTIL = ANCHO - 2 * MARGEN
NEGRO = colors.HexColor("#1F1218")
GRIS = colors.HexColor("#555555")


def clp(valor):
    return "$" + f"{int(valor or 0):,}".replace(",", ".")


def _cortar(texto, fuente, tamano, ancho):
    """Divide un texto en líneas que caben en el ancho indicado."""
    palabras, lineas, actual = str(texto).split(), [], ""
    for p in palabras:
        prueba = f"{actual} {p}".strip()
        if stringWidth(prueba, fuente, tamano) <= ancho:
            actual = prueba
        else:
            if actual:
                lineas.append(actual)
            while stringWidth(p, fuente, tamano) > ancho:  # palabra más larga que el ancho
                corte = len(p)
                while corte > 1 and stringWidth(p[:corte], fuente, tamano) > ancho:
                    corte -= 1
                lineas.append(p[:corte])
                p = p[corte:]
            actual = p
    if actual:
        lineas.append(actual)
    return lineas or [""]


def nombre_archivo(venta):
    local = "".join(c if c.isalnum() else "_" for c in venta.local.nombre).strip("_")
    fecha = timezone.localtime(venta.fecha)
    return f"Boleta_{venta.folio or venta.pk}_{local}_{fecha:%Y-%m-%d}.pdf"


def construir_boleta(venta):
    """Bytes del PDF de la boleta."""
    detalles = list(venta.detalles.select_related("item__producto", "item__servicio", "trabajador"))
    fecha = timezone.localtime(venta.fecha)

    # Se arma primero la lista de renglones para saber el alto exacto de la hoja.
    renglones = []  # (texto, fuente, tamaño, alineación, color) o ("---",) o ("espacio", alto)

    def linea(texto, fuente="Helvetica", tamano=8, alinear="izq", color=NEGRO):
        for parte in _cortar(texto, fuente, tamano, UTIL):
            renglones.append((parte, fuente, tamano, alinear, color))

    def par(izq, der, fuente="Helvetica", tamano=8):
        renglones.append(("par", izq, der, fuente, tamano))

    linea("ESTÉTICA ANTONIA", "Helvetica-Bold", 13, "centro")
    linea(venta.local.nombre, "Helvetica-Bold", 8.5, "centro")
    if venta.local.ubicacion:
        linea(venta.local.ubicacion, "Helvetica", 7.5, "centro", GRIS)
    renglones.append(("espacio", 4))
    linea("BOLETA DE VENTA", "Helvetica-Bold", 10, "centro")
    linea(f"N° {venta.folio or '—'}", "Helvetica-Bold", 10, "centro")
    if venta.estado == "ANULADA":
        linea("*** VENTA ANULADA ***", "Helvetica-Bold", 9, "centro")
    renglones.append(("---",))
    par("Fecha", f"{fecha:%d-%m-%Y %H:%M}")
    par("Atendió", (venta.recepcionista.get_full_name() or venta.recepcionista.email)[:30])
    par("Pago", venta.get_metodo_pago_display())
    renglones.append(("---",))

    for d in detalles:
        es_insumo = d.item.es_producto and d.item.producto.tipo == "INSUMO"
        linea(d.nombre_visible, "Helvetica-Bold", 8)
        detalle = f"{d.cantidad} x {clp(d.precio_unitario)}" if not es_insumo else f"{d.cantidad} x insumo (sin costo)"
        par(f"  {detalle}", clp(d.subtotal), tamano=7.5)
        if d.trabajador_id:
            linea(f"  Especialista: {d.trabajador.get_full_name() or d.trabajador.email}", "Helvetica", 7, color=GRIS)

    renglones.append(("---",))
    par("Subtotal", clp(venta.monto_base))
    if venta.descuento_clp:
        texto = "Descuento" if venta.descuento_monto else f"Descuento ({venta.descuento.normalize():f}%)".replace(".", ",")
        par(texto, f"- {clp(venta.descuento_clp)}")
    renglones.append(("espacio", 2))
    par("TOTAL", clp(venta.monto_total), "Helvetica-Bold", 12)
    renglones.append(("---",))
    if venta.descripcion:
        linea(f"Nota: {venta.descripcion}", "Helvetica", 7, color=GRIS)
    linea("¡Gracias por su visita!", "Helvetica-Bold", 8.5, "centro")
    linea("Comprobante interno del local. No reemplaza la boleta electrónica del SII.",
          "Helvetica", 6, "centro", GRIS)

    def alto_de(r):
        if r[0] == "---":
            return 7
        if r[0] == "espacio":
            return r[1]
        tamano = r[4] if r[0] == "par" else r[2]
        return tamano * 1.35

    alto = sum(alto_de(r) for r in renglones) + 2 * MARGEN + 6

    salida = BytesIO()
    c = canvas.Canvas(salida, pagesize=(ANCHO, alto))
    c.setTitle(f"Boleta N° {venta.folio} · {venta.local.nombre}")
    c.setAuthor("GestAntonia")
    y = alto - MARGEN
    for r in renglones:
        if r[0] == "---":
            y -= 3.5
            c.setDash(1.5, 1.5)
            c.setStrokeColor(GRIS)
            c.setLineWidth(0.5)
            c.line(MARGEN, y, ANCHO - MARGEN, y)
            c.setDash()
            y -= 3.5
            continue
        if r[0] == "espacio":
            y -= r[1]
            continue
        if r[0] == "par":
            _, izq, der, fuente, tamano = r
            y -= tamano * 1.35
            c.setFont(fuente, tamano)
            c.setFillColor(NEGRO)
            c.drawString(MARGEN, y + tamano * 0.3, izq)
            c.drawRightString(ANCHO - MARGEN, y + tamano * 0.3, der)
            continue
        texto, fuente, tamano, alinear, color = r
        y -= tamano * 1.35
        c.setFont(fuente, tamano)
        c.setFillColor(color)
        if alinear == "centro":
            c.drawCentredString(ANCHO / 2, y + tamano * 0.3, texto)
        else:
            c.drawString(MARGEN, y + tamano * 0.3, texto)

    if venta.estado == "ANULADA":
        c.saveState()
        c.setFillColor(colors.Color(0.8, 0, 0, alpha=0.15))
        c.setFont("Helvetica-Bold", 30)
        c.translate(ANCHO / 2, alto / 2)
        c.rotate(35)
        c.drawCentredString(0, 0, "ANULADA")
        c.restoreState()

    c.showPage()
    c.save()
    return salida.getvalue()
