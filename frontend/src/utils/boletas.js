// Boletas en PDF: se guardan en la carpeta "Boletas Ventas" (la lógica de carpetas está en carpetas.js,
// que también usan los reportes de ventas y de asistencia).
import { carpetaActual as carpetaDe, guardarArchivo, prepararCarpeta } from "./carpetas";

export { soportaCarpeta } from "./carpetas";

/** Deja lista la carpeta "Boletas Ventas" (ver prepararCarpeta en carpetas.js). */
export const prepararCarpetaBoletas = (opciones) => prepararCarpeta("boletas", opciones);

/** Nombre de la carpeta donde se están guardando las boletas (para mostrarlo), o null. */
export const carpetaActual = () => carpetaDe("boletas");

/** Guarda la boleta en la carpeta o, si no hay, la descarga. Devuelve "carpeta" o "descarga". */
export const guardarBoleta = guardarArchivo;

/** Abre el diálogo de impresión con la boleta (sin salir de la página). */
export function imprimirBoleta(blob) {
  const url = URL.createObjectURL(blob);
  const marco = document.createElement("iframe");
  marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  marco.src = url;
  marco.onload = () => {
    try {
      marco.contentWindow.focus();
      marco.contentWindow.print();
    } catch {
      window.open(url, "_blank"); // si el navegador no deja imprimir el marco, se abre en otra pestaña
    }
    setTimeout(() => {
      marco.remove();
      URL.revokeObjectURL(url);
    }, 120_000);
  };
  document.body.appendChild(marco);
}

/** Lee el nombre del archivo que envía Django (Content-Disposition). */
export function nombreDesdeCabecera(cabeceras, porDefecto) {
  const valor = cabeceras?.["content-disposition"] ?? "";
  const coincide = /filename="?([^";]+)"?/i.exec(valor);
  return coincide ? coincide[1] : porDefecto;
}
