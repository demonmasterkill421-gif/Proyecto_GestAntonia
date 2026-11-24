import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MORADO = [181, 54, 143];
const TEXTO = [31, 18, 24];
const GRIS = [130, 130, 130];

const PAGOS = { EFECTIVO: "Efectivo", DEBITO: "Débito", CREDITO: "Crédito", TRANSFER: "Transferencia" };
const ESTADOS = { CONFIRMADA: "Confirmada", ANULADA: "Anulada" };

const dos = (n) => String(n).padStart(2, "0");

// Las fechas y los montos se arman a mano: los formatos del navegador usan espacios especiales
// que las letras del PDF no reconocen.
const fechaHora = (fecha) => {
  const d = new Date(fecha);
  return `${dos(d.getDate())}-${dos(d.getMonth() + 1)}-${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`;
};
const clp = (n) => "$" + Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const cargarImagen = (url) =>
  new Promise((resolver, rechazar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = rechazar;
    img.src = url;
  });

// Genera el PDF con las ventas indicadas y devuelve { blob, nombre }.
// Si el logo no carga, el PDF se hace igual, solo sin la marca de fondo.
export async function generarPdfVentas({
  ventas,
  esAdmin,
  nombreLocal,
  trabajadorasDe,
  lineasDe,
  periodo,
  localTexto,
  total,
  logo,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ancho = doc.internal.pageSize.getWidth();
  const alto = doc.internal.pageSize.getHeight();

  let imagen = null;
  try {
    imagen = await cargarImagen(logo);
  } catch {
    imagen = null;
  }

  // Logo de fondo, centrado y muy transparente, una sola vez por página y antes del contenido
  const paginasConMarca = new Set();
  const marcaDeAgua = () => {
    const pagina = doc.internal.getCurrentPageInfo().pageNumber;
    if (!imagen || paginasConMarca.has(pagina)) return;
    paginasConMarca.add(pagina);

    const w = 130;
    const h = (w * imagen.naturalHeight) / imagen.naturalWidth;
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.12 }));
    doc.addImage(imagen, "PNG", (ancho - w) / 2, (alto - h) / 2, w, h);
    doc.restoreGraphicsState();
  };

  marcaDeAgua();

  // Encabezado de la primera página
  const ahora = new Date();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...MORADO);
  doc.text("Listado de ventas", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXTO);
  let y = 28;
  doc.text(`Período: ${periodo}`, 14, y);
  if (localTexto) {
    y += 5;
    doc.text(`Local: ${localTexto}`, 14, y);
  }
  y += 5;
  doc.text(`${ventas.length} ${ventas.length === 1 ? "venta" : "ventas"}`, 14, y);
  doc.setTextColor(...GRIS);
  doc.text(`Emitido el ${fechaHora(ahora)}`, ancho - 14, 20, { align: "right" });

  const encabezado = ["Folio", "Fecha", ...(esAdmin ? ["Local"] : []), "Trabajadora", "Detalle", "Pago", "Estado", "Total"];
  const filas = ventas.map((v) => [
    v.folio ?? "-",
    fechaHora(v.fecha),
    ...(esAdmin ? [nombreLocal(v.local)] : []),
    trabajadorasDe(v).join(", ") || "-",
    lineasDe(v).join("\n") || "-",
    PAGOS[v.metodo_pago] ?? v.metodo_pago,
    ESTADOS[v.estado] ?? v.estado,
    clp(v.monto_total),
  ]);
  const ultima = encabezado.length - 1;

  autoTable(doc, {
    startY: y + 6,
    head: [encabezado],
    body: filas,
    theme: "plain",
    margin: { top: 20, left: 14, right: 14, bottom: 18 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: TEXTO, lineColor: [230, 184, 212], lineWidth: 0.1 },
    headStyles: { fillColor: MORADO, textColor: [255, 255, 255], fontStyle: "bold" },
    // Las celdas no llevan color de fondo para que se vea el logo detrás
    willDrawPage: marcaDeAgua,
    didParseCell: (datos) => {
      if (datos.column.index === ultima) datos.cell.styles.halign = "right";
      // Las ventas anuladas se ven en gris
      if (datos.section === "body" && ventas[datos.row.index]?.estado === "ANULADA") {
        datos.cell.styles.textColor = GRIS;
      }
    },
  });

  // Total de las ventas confirmadas (las anuladas no suman)
  let yTotal = (doc.lastAutoTable?.finalY ?? y + 6) + 8;
  if (yTotal > alto - 25) {
    doc.addPage();
    marcaDeAgua();
    yTotal = 24;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...MORADO);
  doc.text(`Total (sin ventas anuladas): ${clp(total)}`, ancho - 14, yTotal, { align: "right" });

  // Pie de página en todas las páginas
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text("GestAntonia", 14, alto - 8);
    doc.text(`Página ${i} de ${paginas}`, ancho - 14, alto - 8, { align: "right" });
  }

  // Devuelve el archivo para guardarlo en la carpeta "Reportes Ventas" (o descargarlo)
  return {
    blob: doc.output("blob"),
    nombre: `ANTONIA_ventas_${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}.pdf`,
  };
}