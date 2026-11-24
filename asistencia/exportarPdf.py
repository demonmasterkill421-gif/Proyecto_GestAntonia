"""Asistencia del período en PDF (A4), con lo mismo que el Excel: resumen por especialista y cada registro."""
from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .exportarExcel import ESTADOS, _horas, _nombre

MAGENTA = colors.HexColor("#B5368F")
ROSADO = colors.HexColor("#F7E3F1")
GRIS = colors.HexColor("#6B7280")
BORDE = colors.HexColor("#E6B8D4")

_base = getSampleStyleSheet()
TITULO = ParagraphStyle("t", parent=_base["Title"], textColor=MAGENTA, fontSize=19, alignment=0, spaceAfter=2)
SUB = ParagraphStyle("s", parent=_base["Normal"], textColor=GRIS, fontSize=9.5, spaceAfter=8)
H2 = ParagraphStyle("h2", parent=_base["Heading2"], fontSize=13, spaceBefore=10, spaceAfter=6)
CELDA = ParagraphStyle("c", parent=_base["Normal"], fontSize=8.5, leading=10.5)


def _hora(fecha):
    return timezone.localtime(fecha).strftime("%H:%M") if fecha else ""


def _num(valor):
    """1234.5 -> "1.234,5" (como se escribe en Chile)."""
    texto = f"{valor:,.2f}".rstrip("0").rstrip(".")
    return texto.replace(",", "X").replace(".", ",").replace("X", ".")


def _tabla(encabezado, filas, anchos, derecha=(), total=None):
    datos = [encabezado] + (filas or [["Sin registros en el período."] + [""] * (len(encabezado) - 1)])
    if total:
        datos.append(total)
    t = Table(datos, colWidths=anchos, repeatRows=1)
    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), MAGENTA),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, BORDE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2 if total else -1), [colors.white, colors.HexColor("#FBEEF6")]),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    for c in derecha:
        estilo.append(("ALIGN", (c, 0), (c, -1), "RIGHT"))
    if not filas:
        estilo.append(("SPAN", (0, 1), (-1, 1)))
    if total:
        estilo += [("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"), ("BACKGROUND", (0, -1), (-1, -1), ROSADO)]
    t.setStyle(TableStyle(estilo))
    return t


def construir_pdf(registros, resumen, desde, hasta, local_nombre):
    """Bytes del PDF. Recibe lo mismo que construir_excel (exportarExcel.py)."""
    salida = BytesIO()
    pagina = landscape(A4)
    periodo = f"{desde:%d-%m-%Y} al {hasta:%d-%m-%Y}"
    doc = SimpleDocTemplate(
        salida, pagesize=pagina, leftMargin=14 * mm, rightMargin=14 * mm,
        topMargin=12 * mm, bottomMargin=14 * mm,
        title=f"Asistencia {local_nombre} {periodo}", author="GestAntonia",
    )
    ancho = pagina[0] - 28 * mm

    def pie(canvas, documento):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GRIS)
        canvas.drawString(14 * mm, 8 * mm, f"GestAntonia · Asistencia · {local_nombre} · {periodo}")
        canvas.drawRightString(pagina[0] - 14 * mm, 8 * mm, f"Página {documento.page}")
        canvas.restoreState()

    e = [
        Paragraph("Reporte de asistencia", TITULO),
        Paragraph(f"<b>{local_nombre}</b> · {periodo} · generado el {timezone.localtime():%d-%m-%Y %H:%M}", SUB),
        Paragraph("Resumen por especialista", H2),
    ]
    total_dias = sum(f["dias"] for f in resumen)
    total_horas = sum(f["horas"] for f in resumen)
    e.append(_tabla(
        ["Especialista", "Días trabajados", "Horas"],
        [[Paragraph(f["trabajador_nombre"], CELDA), f["dias"], _num(f["horas"])] for f in resumen],
        [ancho * 0.6, ancho * 0.2, ancho * 0.2], derecha=(1, 2),
        total=["Total", total_dias, _num(round(total_horas, 2))] if resumen else None,
    ))

    e += [Spacer(1, 4), Paragraph("Registros del período", H2)]
    filas = []
    for r in registros:
        horas = _horas(r.hora_entrada, r.hora_salida, r.inicio_colacion, r.fin_colacion)
        correccion = ""
        if r.corregido_por_id:
            correccion = _nombre(r.corregido_por) + (f": {r.motivo_correccion}" if r.motivo_correccion else "")
        filas.append([
            f"{r.fecha:%d-%m-%Y}",
            Paragraph(_nombre(r.trabajador), CELDA),
            _hora(r.hora_entrada),
            _hora(r.inicio_colacion) or "—",
            _hora(r.fin_colacion) or "—",
            _hora(r.hora_salida) or "Sin salida",
            _num(horas) if horas is not None else "",
            ESTADOS.get(r.estado, r.estado),
            Paragraph(correccion, CELDA),
        ])
    e.append(_tabla(
        ["Fecha", "Especialista", "Entrada", "Ini. col.", "Fin col.", "Salida", "Horas", "Estado", "Corrección"],
        filas,
        [
            ancho * 0.09, ancho * 0.19, ancho * 0.07,
            ancho * 0.08, ancho * 0.08, ancho * 0.08,
            ancho * 0.07, ancho * 0.10, ancho * 0.24,
        ],
        derecha=(6,),
    ))

    doc.build(e, onFirstPage=pie, onLaterPages=pie)
    return salida.getvalue()