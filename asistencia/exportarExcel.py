from io import BytesIO

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ENCABEZADO = Font(bold=True, color="FFFFFF")
RELLENO = PatternFill("solid", fgColor="B5368F")  # magenta de GestAntonia
FORMATO_FECHA = "dd-mm-yyyy"
FORMATO_HORA = "hh:mm"
FORMATO_HORAS = "0.00"

ESTADOS = {
    "EN_JORNADA": "En jornada",
    "COMPLETA": "Completa",
    "CORREGIDA": "Corregida",
}


def _nombre(usuario):
    """Nombre completo si existe; si no, lo que muestre el usuario."""
    if usuario is None:
        return ""
    completo = usuario.get_full_name() if hasattr(usuario, "get_full_name") else ""
    return (completo or "").strip() or str(usuario)


def _hora_local(fecha):
    # Excel no acepta fechas con zona horaria: se pasa a hora local y se quita la zona
    if fecha is None:
        return None
    return timezone.localtime(fecha).replace(tzinfo=None)


def _horas(entrada, salida):
    """Horas trabajadas con 2 decimales; None si falta la entrada o la salida."""
    if not entrada or not salida:
        return None
    return round((salida - entrada).total_seconds() / 3600, 2)


def _preparar_hoja(hoja, columnas):
    hoja.append(columnas)
    for celda in hoja[1]:
        celda.font = ENCABEZADO
        celda.fill = RELLENO
        celda.alignment = Alignment(vertical="center")
    hoja.freeze_panes = "A2"


def _ajustar_anchos(hoja):
    for columna in hoja.columns:
        ancho = max(len(str(c.value)) if c.value is not None else 0 for c in columna)
        hoja.column_dimensions[get_column_letter(columna[0].column)].width = min(max(ancho + 2, 10), 45)


def construir_excel(registros, resumen, desde, hasta, local_nombre):
    """
    Devuelve los bytes de un .xlsx con dos hojas:
    - Registros: una fila por registro de asistencia del período.
    - Resumen: días y horas por trabajadora, con el total abajo.

    registros: registros de asistencia del período.
    resumen: lista de dicts con "trabajador_nombre", "dias" y "horas".
    """
    libro = Workbook()

    # ---------- Hoja 1: Registros ----------
    hoja = libro.active
    hoja.title = "Registros"
    _preparar_hoja(
        hoja,
        ["Trabajadora", "Local", "Fecha", "Entrada", "Salida", "Horas", "Estado", "Corregida por", "Motivo"],
    )

    for r in registros:
        hoja.append([
            _nombre(r.trabajador),
            r.local.nombre if r.local else "",
            r.fecha,
            _hora_local(r.hora_entrada),
            _hora_local(r.hora_salida) or "Sin salida",
            _horas(r.hora_entrada, r.hora_salida),
            ESTADOS.get(r.estado, r.estado),
            _nombre(r.corregido_por),
            r.motivo_correccion or "",
        ])

    for fila in hoja.iter_rows(min_row=2):
        fila[2].number_format = FORMATO_FECHA
        fila[3].number_format = FORMATO_HORA
        fila[4].number_format = FORMATO_HORA
        fila[5].number_format = FORMATO_HORAS

    hoja.auto_filter.ref = f"A1:I{max(hoja.max_row, 1)}"

    # ---------- Hoja 2: Resumen ----------
    hoja2 = libro.create_sheet("Resumen")
    _preparar_hoja(hoja2, ["Trabajadora", "Días", "Horas"])

    total_dias = 0
    total_horas = 0
    for fila in resumen:
        hoja2.append([fila["trabajador_nombre"], fila["dias"], fila["horas"]])
        total_dias += fila["dias"]
        total_horas += fila["horas"]

    for fila in hoja2.iter_rows(min_row=2):
        fila[2].number_format = FORMATO_HORAS

    ultima = hoja2.max_row

    # Total debajo (mismo estilo que el total de ventas)
    etiqueta = hoja2.cell(row=ultima + 2, column=1, value="Total")
    dias = hoja2.cell(row=ultima + 2, column=2, value=total_dias)
    horas = hoja2.cell(row=ultima + 2, column=3, value=round(total_horas, 2))
    for celda in (etiqueta, dias, horas):
        celda.font = Font(bold=True)
    horas.number_format = FORMATO_HORAS

    # Datos del filtro, para saber de qué período y local es el archivo
    hoja2.cell(row=ultima + 4, column=1, value=f"Local: {local_nombre}")
    hoja2.cell(
        row=ultima + 5,
        column=1,
        value=f"Período: {desde.strftime('%d-%m-%Y')} al {hasta.strftime('%d-%m-%Y')}",
    )

    _ajustar_anchos(hoja)
    _ajustar_anchos(hoja2)

    salida = BytesIO()
    libro.save(salida)
    return salida.getvalue()