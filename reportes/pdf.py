"""Reporte en PDF (A4), con las mismas cifras de la pantalla y el Excel."""
from datetime import date
from io import BytesIO

from django.utils import timezone
from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

MAGENTA = colors.HexColor("#B5368F")
ROSADO = colors.HexColor("#F7E3F1")
TINTA = colors.HexColor("#1F1218")
GRIS = colors.HexColor("#6B7280")
BORDE = colors.HexColor("#E6B8D4")

_base = getSampleStyleSheet()
TITULO = ParagraphStyle("t", parent=_base["Title"], textColor=MAGENTA, fontSize=20, spaceAfter=2, alignment=0)
SUB = ParagraphStyle("s", parent=_base["Normal"], textColor=GRIS, fontSize=9.5, spaceAfter=10)
H2 = ParagraphStyle("h2", parent=_base["Heading2"], textColor=TINTA, fontSize=13, spaceBefore=12, spaceAfter=6,
                    keepWithNext=1)
NORMAL = ParagraphStyle("n", parent=_base["Normal"], fontSize=9, leading=12)
NOTA = ParagraphStyle("nota", parent=NORMAL, textColor=GRIS, fontSize=8)
CELDA = ParagraphStyle("c", parent=NORMAL, fontSize=8.5, leading=10.5)
CELDA_DER = ParagraphStyle("cd", parent=CELDA, alignment=TA_RIGHT)


def clp(valor):
    return "$" + f"{int(valor or 0):,}".replace(",", ".")


def _fecha(iso):
    return date.fromisoformat(iso).strftime("%d-%m-%Y")


def _variacion(actual, anterior):
    if not anterior:
        return "—"
    v = (actual - anterior) * 100 / anterior
    return f"{'+' if v >= 0 else ''}{v:.1f}%".replace(".", ",")


def _tabla(encabezado, filas, anchos, derecha=(), total=None):
    datos = [encabezado] + filas + ([total] if total else [])
    t = Table(datos, colWidths=anchos, repeatRows=1)
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), MAGENTA),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1 if not total else -2), [colors.white, colors.HexColor("#FBEEF6")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, BORDE),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    for c in derecha:
        estilo.append(("ALIGN", (c, 0), (c, -1), "RIGHT"))
    if total:
        estilo += [("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("BACKGROUND", (0, -1), (-1, -1), ROSADO)]
    if not filas:
        datos.insert(1, ["Sin datos en el período."] + [""] * (len(encabezado) - 1))
        t = Table(datos, colWidths=anchos)
        estilo.append(("SPAN", (0, 1), (-1, 1)))
    t.setStyle(TableStyle(estilo))
    return t


def _grafico_lineas(diarias, ancho):
    d = Drawing(ancho, 150)
    valores = [x["ganancias"] for x in diarias]
    if not any(valores):
        d.add(String(ancho / 2, 70, "Sin ventas en el período", textAnchor="middle", fillColor=GRIS, fontSize=9))
        return d
    g = HorizontalLineChart()
    g.x, g.y, g.width, g.height = 48, 22, ancho - 60, 112
    g.data = [valores]
    g.lines[0].strokeColor = MAGENTA
    g.lines[0].strokeWidth = 1.8
    paso = max(1, len(diarias) // 10)
    g.categoryAxis.categoryNames = [
        date.fromisoformat(x["fecha"]).strftime("%d/%m") if i % paso == 0 else "" for i, x in enumerate(diarias)]
    g.categoryAxis.labels.fontSize = 7
    g.categoryAxis.labels.fontName = "Helvetica"
    g.valueAxis.labels.fontSize = 7
    g.valueAxis.labels.fontName = "Helvetica"
    g.valueAxis.valueMin = 0
    g.valueAxis.labelTextFormat = lambda v: clp(v)
    g.valueAxis.gridStrokeColor = colors.HexColor("#EEEEEE")
    g.valueAxis.visibleGrid = True
    d.add(g)
    return d


def _entero(valor):
    return f"{int(round(valor)):,}".replace(",", ".")


def _grafico_barras(etiquetas, valores, ancho, formato=_entero):
    alto = max(60, 18 * len(etiquetas) + 20)
    d = Drawing(ancho, alto)
    if not etiquetas or not any(valores):
        d.add(String(ancho / 2, alto / 2, "Sin datos", textAnchor="middle", fillColor=GRIS, fontSize=9))
        return d
    g = HorizontalBarChart()
    g.x, g.y, g.width, g.height = 130, 10, ancho - 190, alto - 20
    g.data = [list(reversed(valores))]
    g.categoryAxis.categoryNames = [e[:28] for e in reversed(etiquetas)]
    g.categoryAxis.labels.fontSize = 7.5
    g.categoryAxis.labels.fontName = "Helvetica"
    g.valueAxis.labels.fontSize = 7
    g.valueAxis.labels.fontName = "Helvetica"
    g.valueAxis.valueMin = 0
    g.valueAxis.labelTextFormat = formato
    g.bars[0].fillColor = MAGENTA
    g.bars[0].strokeColor = None
    g.barLabelFormat = formato
    g.barLabels.fontSize = 7
    g.barLabels.fontName = "Helvetica"
    g.barLabels.nudge = 14
    d.add(g)
    return d


def _pie_de_pagina(local, periodo):
    def dibujar(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GRIS)
        canvas.drawString(15 * mm, 10 * mm, f"GestAntonia · {local} · {periodo}")
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, f"Página {doc.page}")
        canvas.restoreState()
    return dibujar


def construir_pdf_reporte(r):
    salida = BytesIO()
    periodo = r["periodo"]
    texto_periodo = f"{_fecha(periodo['desde'])} al {_fecha(periodo['hasta'])}"
    doc = SimpleDocTemplate(salida, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=14 * mm, bottomMargin=16 * mm,
                            title=f"Reporte {r['sucursal']['name']} {texto_periodo}", author="GestAntonia")
    ancho = A4[0] - 30 * mm
    ind = r["indicadores"]
    e = []

    e.append(Paragraph("Reporte de gestión", TITULO))
    e.append(Paragraph(
        f"<b>{r['sucursal']['name']}</b> · {texto_periodo} ({periodo['dias']} días) · generado el "
        f"{timezone.localtime():%d-%m-%Y %H:%M}. Solo ventas confirmadas.", SUB))

    # Indicadores con comparación
    e.append(_tabla(
        ["Indicador", "Este período", "Período anterior", "Variación"],
        [
            ["Ganancias", clp(ind["ganancias"]), clp(ind["gananciasAnterior"]),
             _variacion(ind["ganancias"], ind["gananciasAnterior"])],
            ["N° de ventas", ind["ventas"], ind["ventasAnterior"], _variacion(ind["ventas"], ind["ventasAnterior"])],
            ["Ticket promedio", clp(ind["ticketPromedio"]), clp(ind["ticketPromedioAnterior"]),
             _variacion(ind["ticketPromedio"], ind["ticketPromedioAnterior"])],
            ["Servicios realizados", ind["servicios"], ind["serviciosAnterior"],
             _variacion(ind["servicios"], ind["serviciosAnterior"])],
            ["Descuentos otorgados", clp(ind["descuentos"]), "", ""],
            ["Comisiones de las trabajadoras", clp(ind["comisiones"]), "", ""],
            ["Ventas anuladas", f"{ind['anuladas']} ({clp(ind['montoAnuladas'])})", "", ""],
        ],
        [ancho * 0.36, ancho * 0.22, ancho * 0.22, ancho * 0.2], derecha=(1, 2, 3)))
    e.append(Paragraph(
        f"Período anterior: {_fecha(periodo['anteriorDesde'])} al {_fecha(periodo['anteriorHasta'])}.", NOTA))

    e.append(Paragraph("Ganancias por día", H2))
    e.append(_grafico_lineas(r["gananciasDiarias"], ancho))

    semana = [d for d in r["diasSemana"] if d["ventas"]]
    e.append(KeepTogether([
        Paragraph("Promedio de ganancias por día de la semana", H2),
        _grafico_barras([d["dia"] for d in semana], [d["promedio"] for d in semana], ancho, clp),
    ]))

    servicios = r["servicios"]
    e.append(KeepTogether([
        Paragraph("Servicios más pedidos", H2),
        _grafico_barras([s["nombre"] for s in servicios[:10]], [s["cantidad"] for s in servicios[:10]], ancho),
    ]))
    e.append(_tabla(
        ["Servicio", "Tipo", "Cantidad", "% del total", "Ingresos"],
        [[Paragraph(s["nombre"], CELDA), s["tipo"], s["cantidad"], f"{s['porcentaje']}%".replace(".", ","),
          clp(s["ingresos"])] for s in servicios],
        [ancho * 0.34, ancho * 0.22, ancho * 0.12, ancho * 0.14, ancho * 0.18], derecha=(2, 3, 4),
        total=["Total", "", ind["servicios"], "", clp(sum(s["ingresos"] for s in servicios))] if servicios else None))

    # Trabajadoras y comisiones (con el desglose por servicio que pidió la clienta)
    e.append(Paragraph("Trabajadoras", H2))
    trab = r["trabajadores"]
    e.append(_tabla(
        ["Trabajadora", "Estado", "Días", "Horas", "Servicios", "Ventas", "Comisión"],
        [[Paragraph(t["nombre"], CELDA), t["estado"], t["dias"], f"{t['horas']:.1f}".replace(".", ","),
          t["servicios"], clp(t["ventas"]), clp(t["comision"])] for t in trab],
        [ancho * 0.27, ancho * 0.13, ancho * 0.08, ancho * 0.1, ancho * 0.11, ancho * 0.15, ancho * 0.16],
        derecha=(2, 3, 4, 5, 6),
        total=["Total", "", "", "", sum(t["servicios"] for t in trab), clp(sum(t["ventas"] for t in trab)),
               clp(ind["comisiones"])] if trab else None))

    e.append(Paragraph("Comisiones por servicio", H2))
    filas = []
    for t in trab:
        for d in t["detalleComision"]:
            filas.append([Paragraph(t["nombre"], CELDA), Paragraph(d["servicio"], CELDA), d["cantidad"],
                          clp(d["ventas"]), d["porcentajeTexto"] + ("" if d["porServicio"] else " *"),
                          clp(d["comision"])])
    e.append(_tabla(["Trabajadora", "Servicio / producto", "Cant.", "Ventas", "%", "Comisión"], filas,
                    [ancho * 0.25, ancho * 0.3, ancho * 0.08, ancho * 0.13, ancho * 0.1, ancho * 0.14],
                    derecha=(2, 3, 4, 5)))
    e.append(Paragraph(
        "El % es el que tenía la trabajadora para ese servicio al registrar la venta. "
        "* Ese servicio no tenía un % propio y se usó su comisión base.", NOTA))

    e.append(KeepTogether([
        Paragraph("Métodos de pago", H2),
        _tabla(["Método", "N° ventas", "Monto", "%"],
               [[m["metodo"], m["ventas"], clp(m["monto"]), f"{m['porcentaje']}%".replace(".", ",")]
                for m in r["metodosPago"]],
               [ancho * 0.4, ancho * 0.2, ancho * 0.22, ancho * 0.18], derecha=(1, 2, 3)),
    ]))

    if r["productos"]:
        e.append(KeepTogether([
            Paragraph("Productos vendidos", H2),
            _tabla(["Producto", "Unidades", "Ingresos"],
                   [[Paragraph(p["nombre"], CELDA), p["cantidad"], clp(p["ingresos"])] for p in r["productos"]],
                   [ancho * 0.6, ancho * 0.18, ancho * 0.22], derecha=(1, 2)),
        ]))

    e.append(KeepTogether([
        Paragraph("Comparación entre locales (mismo período)", H2),
        _tabla(["Local", "N° ventas", "Ganancias", "Servicios", "Ticket promedio", "Participación"],
               [[Paragraph(c["local"], CELDA), c["ventas"], clp(c["ganancias"]), c["servicios"],
                 clp(c["ticketPromedio"]), f"{c['participacion']}%".replace(".", ",")]
                for c in r["comparativaLocales"]],
               [ancho * 0.3, ancho * 0.12, ancho * 0.16, ancho * 0.12, ancho * 0.16, ancho * 0.14],
               derecha=(1, 2, 3, 4, 5)),
    ]))

    doc.build(e, onFirstPage=_pie_de_pagina(r["sucursal"]["name"], texto_periodo),
              onLaterPages=_pie_de_pagina(r["sucursal"]["name"], texto_periodo))
    return salida.getvalue()
