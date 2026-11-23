"""Reporte en Excel (.xlsx) para que la administradora compare y analice.

Cada hoja trae sus datos como Tabla de Excel (con filtros y lista para tablas dinámicas),
totales con fórmulas y, donde ayuda, un gráfico.
"""
from io import BytesIO

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

MAGENTA = "B5368F"
ROSADO = "F7E3F1"
CLP = '"$"#,##0'
PCT = '0.0%'
FECHA = "dd-mm-yyyy"
FECHA_HORA = "dd-mm-yyyy hh:mm"
HORA = "hh:mm"

TITULO = Font(bold=True, size=16, color=MAGENTA)
SUBTITULO = Font(bold=True, size=12, color="1F1218")
NEGRITA = Font(bold=True)
GRIS = Font(italic=True, color="6B7280", size=9)
ENCABEZADO = Font(bold=True, color="FFFFFF")
RELLENO = PatternFill("solid", fgColor=MAGENTA)
RELLENO_SUAVE = PatternFill("solid", fgColor=ROSADO)
LINEA = Side(style="thin", color="E6B8D4")


def _fecha(iso):
    from datetime import date
    return date.fromisoformat(iso)


def _sin_zona(valor):
    """Excel no acepta fechas con zona horaria."""
    return valor.replace(tzinfo=None) if valor is not None and getattr(valor, "tzinfo", None) else valor


class _Hoja:
    """Ayuda a escribir una hoja: título, tabla con formato y anchos de columna."""

    def __init__(self, libro, nombre, reporte, titulo):
        self.ws = libro.create_sheet(nombre)
        self.ws.sheet_view.showGridLines = False
        self.fila = 1
        self.ws.cell(row=1, column=1, value=titulo).font = TITULO
        periodo = reporte["periodo"]
        self.ws.cell(row=2, column=1, value=(
            f"{reporte['sucursal']['name']} · {_fecha(periodo['desde']):%d-%m-%Y} al "
            f"{_fecha(periodo['hasta']):%d-%m-%Y}")).font = GRIS
        self.fila = 4
        self.anchos = {}

    def subtitulo(self, texto):
        self.ws.cell(row=self.fila, column=1, value=texto).font = SUBTITULO
        self.fila += 1

    def tabla(self, nombre, columnas, filas, formatos=None, total=None, estilo="TableStyleMedium3"):
        """Escribe una Tabla de Excel. formatos: {índice_columna: formato}. total: {índice: 'SUM'|texto}.
        Devuelve (fila_encabezado, primera_fila, última_fila)."""
        formatos = formatos or {}
        inicio = self.fila
        for c, titulo in enumerate(columnas, start=1):
            celda = self.ws.cell(row=inicio, column=c, value=titulo)
            celda.font = ENCABEZADO
            celda.fill = RELLENO
            celda.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            self._ancho(c, titulo)
        for f, fila in enumerate(filas, start=inicio + 1):
            for c, valor in enumerate(fila, start=1):
                celda = self.ws.cell(row=f, column=c, value=_sin_zona(valor))
                if c - 1 in formatos:
                    celda.number_format = formatos[c - 1]
                self._ancho(c, valor)
        ultima = inicio + len(filas)
        if filas:
            ref = f"A{inicio}:{get_column_letter(len(columnas))}{ultima}"
            t = Table(displayName=nombre, ref=ref)
            t.tableStyleInfo = TableStyleInfo(name=estilo, showRowStripes=True)
            self.ws.add_table(t)
        else:
            self.ws.cell(row=inicio + 1, column=1, value="Sin datos en el período.").font = GRIS
            ultima = inicio + 1
        self.fila = ultima + 1
        if total and filas:
            for c in range(1, len(columnas) + 1):
                celda = self.ws.cell(row=self.fila, column=c)
                celda.font = NEGRITA
                celda.fill = RELLENO_SUAVE
                celda.border = Border(top=LINEA)
                accion = total.get(c - 1)
                if accion == "SUM":
                    letra = get_column_letter(c)
                    celda.value = f"=SUM({letra}{inicio + 1}:{letra}{ultima})"
                    celda.number_format = formatos.get(c - 1, "General")
                elif accion:
                    celda.value = accion
            self.fila += 1
        self.fila += 1
        return inicio, inicio + 1, ultima

    def _ancho(self, columna, valor):
        if valor is None:
            return
        largo = len(f"{valor:%d-%m-%Y %H:%M}") if hasattr(valor, "strftime") else len(str(valor))
        self.anchos[columna] = max(self.anchos.get(columna, 8), min(largo + 3, 48))

    def cerrar(self):
        for c, ancho in self.anchos.items():
            self.ws.column_dimensions[get_column_letter(c)].width = ancho


def _grafico(tipo, titulo, ws, col_datos, col_categorias, primera, ultima, destino, eje_y=None, alto=8, ancho=18):
    if ultima < primera:
        return
    grafico = tipo()
    grafico.title = titulo
    grafico.height, grafico.width = alto, ancho
    grafico.legend = None
    datos = Reference(ws, min_col=col_datos, min_row=primera - 1, max_row=ultima)
    categorias = Reference(ws, min_col=col_categorias, min_row=primera, max_row=ultima)
    grafico.add_data(datos, titles_from_data=True)
    grafico.set_categories(categorias)
    for serie in grafico.series:
        if tipo is LineChart:
            serie.smooth = False
            serie.graphicalProperties.line.solidFill = MAGENTA
            serie.graphicalProperties.line.width = 22000
        elif tipo is BarChart:
            serie.graphicalProperties.solidFill = MAGENTA
            serie.graphicalProperties.line.solidFill = MAGENTA
    if eje_y and hasattr(grafico, "y_axis"):
        grafico.y_axis.title = eje_y
        grafico.y_axis.numFmt = CLP
    if tipo is BarChart:
        grafico.type = "bar" if ultima - primera > 6 else "col"
    if tipo is PieChart:
        from openpyxl.chart.legend import Legend
        grafico.legend = Legend()
        grafico.dataLabels = DataLabelList()
        grafico.dataLabels.showPercent = True
    ws.add_chart(grafico, destino)


def construir_excel_reporte(r):
    libro = Workbook()
    libro.remove(libro.active)
    ind = r["indicadores"]
    periodo = r["periodo"]

    # ------------------------------------------------------------------ Resumen
    h = _Hoja(libro, "Resumen", r, "Reporte de gestión · GestAntonia")
    ws = h.ws
    ws.cell(row=3, column=1, value=f"Generado el {timezone.localtime():%d-%m-%Y %H:%M} · "
                                   "solo ventas confirmadas (las anuladas se informan aparte)").font = GRIS
    h.subtitulo("Comparación con el período anterior "
                f"({_fecha(periodo['anteriorDesde']):%d-%m-%Y} al {_fecha(periodo['anteriorHasta']):%d-%m-%Y})")
    filas = [
        ["Ganancias", ind["ganancias"], ind["gananciasAnterior"]],
        ["N° de ventas", ind["ventas"], ind["ventasAnterior"]],
        ["Ticket promedio", ind["ticketPromedio"], ind["ticketPromedioAnterior"]],
        ["Servicios realizados", ind["servicios"], ind["serviciosAnterior"]],
    ]
    _, primera, ultima = h.tabla("Indicadores", ["Indicador", "Este período", "Período anterior", "Variación"],
                                 [f + [None] for f in filas])
    for fila in range(primera, ultima + 1):
        ws.cell(row=fila, column=4, value=f'=IF(C{fila}=0,"—",(B{fila}-C{fila})/C{fila})').number_format = PCT
        if fila != primera + 1 and fila != primera + 3:
            ws.cell(row=fila, column=2).number_format = CLP
            ws.cell(row=fila, column=3).number_format = CLP
    h.subtitulo("Otros datos del período")
    h.tabla("OtrosDatos", ["Dato", "Valor"], [
        ["Descuentos otorgados", ind["descuentos"]],
        ["Comisiones de las trabajadoras", ind["comisiones"]],
        ["Ventas anuladas (cantidad)", ind["anuladas"]],
        ["Ventas anuladas (monto)", ind["montoAnuladas"]],
        ["Trabajadoras activas del local", ind["trabajadoresActivos"]],
        ["Días del período", periodo["dias"]],
    ], estilo="TableStyleLight10")
    for fila in range(h.fila - 8, h.fila):
        if ws.cell(row=fila, column=1).value in ("Descuentos otorgados", "Comisiones de las trabajadoras",
                                                 "Ventas anuladas (monto)"):
            ws.cell(row=fila, column=2).number_format = CLP
    ws.cell(row=h.fila, column=1, value=(
        "Las demás hojas traen el detalle: ventas por día, días de la semana y horas, servicios, productos, "
        "métodos de pago, trabajadoras, comisiones por servicio, comparación entre locales, cada línea de "
        "venta y la asistencia.")).font = GRIS
    h.cerrar()
    ws.column_dimensions["A"].width = 34

    # ------------------------------------------------------------------ Ventas por día
    h = _Hoja(libro, "Ventas por día", r, "Ventas por día")
    filas = [[_fecha(d["fecha"]), d["dia"], d["ventas"], d["servicios"], d["ganancias"], None]
             for d in r["gananciasDiarias"]]
    _, primera, ultima = h.tabla("VentasPorDia", ["Fecha", "Día", "N° ventas", "Servicios", "Ganancias",
                                                  "Ticket promedio"], filas,
                                 {0: FECHA, 4: CLP, 5: CLP}, total={0: "Total", 2: "SUM", 3: "SUM", 4: "SUM"})
    for fila in range(primera, ultima + 1):
        h.ws.cell(row=fila, column=6, value=f'=IF(C{fila}=0,0,E{fila}/C{fila})').number_format = CLP
    _grafico(LineChart, "Ganancias por día", h.ws, 5, 1, primera, ultima, "H4", eje_y="CLP", ancho=22)
    h.cerrar()

    # ------------------------------------------------------------------ Días de la semana y horas
    h = _Hoja(libro, "Días y horas", r, "¿Qué días y a qué hora se vende más?")
    h.subtitulo("Por día de la semana")
    _, p1, u1 = h.tabla("PorDiaSemana", ["Día", "N° ventas", "Ganancias", "Promedio por día"],
                        [[d["dia"], d["ventas"], d["ganancias"], d["promedio"]] for d in r["diasSemana"]],
                        {2: CLP, 3: CLP})
    _grafico(BarChart, "Promedio de ganancias por día de la semana", h.ws, 4, 1, p1, u1, "G4", eje_y="CLP")
    h.subtitulo("Por hora del día")
    _, p2, u2 = h.tabla("PorHora", ["Hora", "N° ventas", "Ganancias"],
                        [[x["hora"], x["ventas"], x["ganancias"]] for x in r["horas"]], {2: CLP})
    _grafico(BarChart, "Ventas por hora", h.ws, 2, 1, p2, u2, "G22")
    h.cerrar()

    # ------------------------------------------------------------------ Servicios
    h = _Hoja(libro, "Servicios", r, "Servicios realizados")
    filas = [[s["nombre"], s["tipo"], s["cantidad"], s["ingresos"], None] for s in r["servicios"]]
    _, primera, ultima = h.tabla("Servicios", ["Servicio", "Tipo", "Cantidad", "Ingresos (con descuento)",
                                               "% de los servicios"], filas, {3: CLP, 4: PCT},
                                 total={0: "Total", 2: "SUM", 3: "SUM"})
    for fila in range(primera, ultima + 1):
        h.ws.cell(row=fila, column=5, value=f"=C{fila}/SUM($C${primera}:$C${ultima})").number_format = PCT
    _grafico(BarChart, "Servicios más pedidos", h.ws, 3, 1, primera, min(ultima, primera + 9), "G4")
    h.cerrar()

    # ------------------------------------------------------------------ Productos e insumos
    h = _Hoja(libro, "Productos e insumos", r, "Productos vendidos e insumos usados")
    h.subtitulo("Productos de venta")
    h.tabla("Productos", ["Producto", "Unidades", "Ingresos (con descuento)"],
            [[p["nombre"], p["cantidad"], p["ingresos"]] for p in r["productos"]], {2: CLP},
            total={0: "Total", 1: "SUM", 2: "SUM"})
    h.subtitulo("Insumos usados en los servicios (no se cobran)")
    h.tabla("Insumos", ["Insumo", "Unidades"], [[i["nombre"], i["cantidad"]] for i in r["insumos"]],
            total={0: "Total", 1: "SUM"})
    h.cerrar()

    # ------------------------------------------------------------------ Métodos de pago
    h = _Hoja(libro, "Métodos de pago", r, "Métodos de pago")
    _, primera, ultima = h.tabla("MetodosPago", ["Método", "N° ventas", "Monto", "% del monto"],
                                 [[m["metodo"], m["ventas"], m["monto"], None] for m in r["metodosPago"]],
                                 {2: CLP, 3: PCT}, total={0: "Total", 1: "SUM", 2: "SUM"})
    for fila in range(primera, ultima + 1):
        h.ws.cell(row=fila, column=4, value=f"=C{fila}/SUM($C${primera}:$C${ultima})").number_format = PCT
    _grafico(PieChart, "Monto por método de pago", h.ws, 3, 1, primera, ultima, "F4", alto=9, ancho=12)
    h.cerrar()

    # ------------------------------------------------------------------ Trabajadoras
    h = _Hoja(libro, "Trabajadoras", r, "Trabajadoras: servicios, ventas, horas y comisión")
    filas = [[t["nombre"], t["cargo"], t["estado"], t["dias"], t["horas"], t["servicios"], t["ventas"],
              t["comision"], t["comisionBase"] / 100] for t in r["trabajadores"]]
    _, primera, ultima = h.tabla("Trabajadoras", ["Trabajadora", "Cargo", "Estado", "Días trabajados", "Horas",
                                                  "Servicios", "Ventas (con descuento)", "Comisión",
                                                  "Comisión base"], filas,
                                 {4: "0.0", 6: CLP, 7: CLP, 8: PCT},
                                 total={0: "Total", 3: "SUM", 4: "SUM", 5: "SUM", 6: "SUM", 7: "SUM"})
    _grafico(BarChart, "Comisión por trabajadora", h.ws, 8, 1, primera, ultima, "K4")
    h.ws.cell(row=h.fila, column=1, value=(
        "«Inactiva»: ya no trabaja en el local, pero sus ventas y comisiones del período se mantienen. "
        "Comisión base: el % que se usa cuando un servicio no tiene un % propio.")).font = GRIS
    h.cerrar()

    # ------------------------------------------------------------------ Comisiones por servicio
    h = _Hoja(libro, "Comisiones por servicio", r, "Comisiones por servicio")
    filas = []
    for t in r["trabajadores"]:
        for d in t["detalleComision"]:
            filas.append([t["nombre"], t["estado"], d["servicio"], d["cantidad"], d["ventas"],
                          d["porcentaje"] / 100, d["comision"],
                          "% del servicio" if d["porServicio"] else "Comisión base"])
    h.tabla("ComisionesPorServicio", ["Trabajadora", "Estado", "Servicio / producto", "Cantidad",
                                      "Ventas (con descuento)", "% de comisión", "Comisión", "Origen del %"],
            filas, {4: CLP, 5: PCT, 6: CLP}, total={0: "Total", 3: "SUM", 4: "SUM", 6: "SUM"})
    h.ws.cell(row=h.fila, column=1, value=(
        "El % es el que tenía la trabajadora para ese servicio al registrar la venta. «Comisión base»: ese "
        "servicio no tenía un % propio. Tip: filtra la columna Trabajadora para ver el detalle de una sola.")
    ).font = GRIS
    h.cerrar()

    # ------------------------------------------------------------------ Comparativa entre locales
    h = _Hoja(libro, "Comparativa locales", r, "Comparación entre locales (mismo período)")
    _, primera, ultima = h.tabla("ComparativaLocales", ["Local", "N° ventas", "Ganancias", "Servicios",
                                                        "Ticket promedio", "Participación"],
                                 [[c["local"], c["ventas"], c["ganancias"], c["servicios"], c["ticketPromedio"],
                                   None] for c in r["comparativaLocales"]], {2: CLP, 4: CLP, 5: PCT},
                                 total={0: "Total", 1: "SUM", 2: "SUM", 3: "SUM"})
    for fila in range(primera, ultima + 1):
        h.ws.cell(row=fila, column=6,
                  value=f"=IF(SUM($C${primera}:$C${ultima})=0,0,C{fila}/SUM($C${primera}:$C${ultima}))"
                  ).number_format = PCT
    _grafico(BarChart, "Ganancias por local", h.ws, 3, 1, primera, ultima, "H4", eje_y="CLP")
    h.cerrar()

    # ------------------------------------------------------------------ Detalle de ventas (datos crudos)
    h = _Hoja(libro, "Detalle de ventas", r, "Cada línea de venta (para tablas dinámicas)")
    filas = [[l["folio"], l["fecha"].date(), l["fecha"].replace(tzinfo=None).time(), l["metodo"], l["clase"],
              l["tipo"], l["item"], l["cantidad"], l["precio"], l["subtotal"], l["neto"], l["trabajadora"],
              (l["porcentaje"] / 100) if l["porcentaje"] is not None else None, l["comision"]]
             for l in r.get("lineas", [])]
    h.tabla("DetalleVentas", ["Folio", "Fecha", "Hora", "Método de pago", "Clase", "Tipo de servicio", "Ítem",
                              "Cantidad", "Precio unitario", "Subtotal", "Subtotal con descuento", "Trabajadora",
                              "% comisión", "Comisión"], filas,
            {1: FECHA, 2: HORA, 8: CLP, 9: CLP, 10: CLP, 12: PCT, 13: CLP},
            total={0: "Total", 7: "SUM", 9: "SUM", 10: "SUM", 13: "SUM"})
    h.cerrar()

    # ------------------------------------------------------------------ Asistencia
    h = _Hoja(libro, "Asistencia", r, "Asistencia del período")
    filas = [[a["fecha"], a["trabajadora"], a["entrada"].replace(tzinfo=None).time() if a["entrada"] else None,
              a["salida"].replace(tzinfo=None).time() if a["salida"] else None, a["horas"], a["estado"]]
             for a in r.get("asistencias", [])]
    h.tabla("Asistencia", ["Fecha", "Trabajadora", "Entrada", "Salida", "Horas", "Estado"], filas,
            {0: FECHA, 2: HORA, 3: HORA, 4: "0.00"}, total={0: "Total", 4: "SUM"})
    h.cerrar()

    for hoja in libro.worksheets:
        hoja.sheet_properties.tabColor = MAGENTA if hoja.title == "Resumen" else "E6B8D4"
        hoja.page_setup.orientation = "landscape"
        hoja.page_setup.fitToWidth = 1
        hoja.sheet_properties.pageSetUpPr.fitToPage = True
        hoja.page_setup.fitToHeight = 0

    salida = BytesIO()
    libro.save(salida)
    return salida.getvalue()
