#EXPORTAR EXCEL


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


def _nombre_item(linea):
    # En el servicio «Otro» el nombre lo escribe quien vende; en los demás es el del catálogo
    return linea.nombre_manual or linea.item.nombre


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

    por_trabajadora = libro.create_sheet("Por trabajadora")
    _preparar_hoja(
        por_trabajadora,
        ["Trabajadora", "Folio", "Fecha", "Local", "Servicio", "Cantidad", "Subtotal"],
    )
    filas_trabajadora = []

    total_confirmadas = 0
    for v in ventas:
        lineas = list(v.detalles.all())
        # La trabajadora está en cada línea de la venta (puede haber varias o ninguna).
        trabajadoras = sorted({_nombre(d.trabajador) for d in lineas if d.trabajador})

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
            if d.trabajador and v.estado == "CONFIRMADA":
                filas_trabajadora.append([
                    _nombre(d.trabajador), v.folio, _fecha(v.fecha), v.local.nombre,
                    _nombre_item(d), d.cantidad, d.cantidad * d.precio_unitario,
                ])
            detalle.append([
                v.folio,
                _fecha(v.fecha),
                v.local.nombre,
                _nombre_item(d),
                d.cantidad,
                d.precio_unitario,
                d.cantidad * d.precio_unitario,
                _nombre(d.trabajador) if d.trabajador else "",
            ])

    # Lo que hizo cada trabajadora, agrupado por su nombre y de la fecha más antigua a la más nueva
    for fila in sorted(filas_trabajadora, key=lambda f: (f[0].lower(), f[2], f[1] or 0)):
        por_trabajadora.append(fila)
    for fila in por_trabajadora.iter_rows(min_row=2):
        fila[2].number_format = FORMATO_FECHA
        fila[6].number_format = FORMATO_CLP
    por_trabajadora.auto_filter.ref = f"A1:G{por_trabajadora.max_row}"

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
    _ajustar_anchos(por_trabajadora)

    salida = BytesIO()
    libro.save(salida)
    return salida.getvalue()