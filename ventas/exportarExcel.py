from io import BytesIO

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ENCABEZADO = Font(bold=True, color="FFFFFF")
RELLENO = PatternFill("solid", fgColor="B5368F")  # magenta de GestAntonia
FORMATO_FECHA = "dd-mm-yyyy hh:mm"
FORMATO_CLP = '"$"#,##0'


def _nombre(usuario):
    """Nombre completo si existe; si no, lo que muestre el usuario."""
    if usuario is None:
        return ""
    completo = usuario.get_full_name() if hasattr(usuario, "get_full_name") else ""
    return (completo or "").strip() or str(usuario)


def _fecha(fecha):
    # Excel no acepta fechas con zona horaria: se pasa a hora local y se quita la zona
    return timezone.localtime(fecha).replace(tzinfo=None)


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


def construir_excel(ventas):
    """Devuelve los bytes de un .xlsx con dos hojas: Ventas (una fila por venta) y Detalle (una por línea)."""
    libro = Workbook()

    hoja = libro.active
    hoja.title = "Ventas"
    _preparar_hoja(
        hoja,
        ["Folio", "Fecha", "Local", "Trabajadora", "Método de pago", "Descuento (%)", "Monto total (CLP)", "Estado"],
    )

    detalle = libro.create_sheet("Detalle")
    _preparar_hoja(
        detalle,
        ["Folio", "Fecha", "Local", "Ítem", "Cantidad", "Precio unitario", "Subtotal", "Trabajadora"],
    )

    total_confirmadas = 0
    for v in ventas:
        lineas = list(v.detalles.all())
        trabajadoras = sorted({_nombre(d.trabajador) for d in lineas if d.trabajador})
        if not trabajadoras and v.trabajador:
            trabajadoras = [_nombre(v.trabajador)]

        hoja.append([
            v.folio,
            _fecha(v.fecha),
            v.local.nombre,
            ", ".join(trabajadoras),
            v.get_metodo_pago_display(),
            float(v.descuento),
            v.monto_total,
            v.get_estado_display(),
        ])
        if v.estado == "CONFIRMADA":
            total_confirmadas += v.monto_total

        for d in lineas:
            detalle.append([
                v.folio,
                _fecha(v.fecha),
                v.local.nombre,
                d.item.nombre,
                d.cantidad,
                d.precio_unitario,
                d.cantidad * d.precio_unitario,
                _nombre(d.trabajador) if d.trabajador else "",
            ])

    # Formatos de fecha y dinero
    for fila in hoja.iter_rows(min_row=2):
        fila[1].number_format = FORMATO_FECHA
        fila[6].number_format = FORMATO_CLP
    for fila in detalle.iter_rows(min_row=2):
        fila[1].number_format = FORMATO_FECHA
        fila[5].number_format = FORMATO_CLP
        fila[6].number_format = FORMATO_CLP

    # Filtros de Excel sobre los datos, y el total debajo (las anuladas no suman)
    ultima = hoja.max_row
    hoja.auto_filter.ref = f"A1:H{ultima}"
    detalle.auto_filter.ref = f"A1:H{detalle.max_row}"

    etiqueta = hoja.cell(row=ultima + 2, column=6, value="Total confirmadas")
    valor = hoja.cell(row=ultima + 2, column=7, value=total_confirmadas)
    etiqueta.font = Font(bold=True)
    valor.font = Font(bold=True)
    valor.number_format = FORMATO_CLP

    _ajustar_anchos(hoja)
    _ajustar_anchos(detalle)

    salida = BytesIO()
    libro.save(salida)
    return salida.getvalue()    