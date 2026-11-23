// Guarda las boletas en PDF dentro de una carpeta "Boletas Ventas" en el computador del local.
//
// Los navegadores no dejan que una página escriba en el disco por su cuenta: la primera vez se
// pregunta DÓNDE crear la carpeta (por ejemplo, en Documentos) y desde ahí cada boleta se guarda
// sola en "Boletas Ventas". La carpeta elegida se recuerda en este navegador.
//
// Funciona en Chrome y Edge (API de acceso a archivos). En otros navegadores (Firefox, Safari) o
// si se cancela la elección, la boleta se descarga normalmente a la carpeta de descargas.

const NOMBRE_CARPETA = "Boletas Ventas";
const BASE_DATOS = "gestantonia";
const ALMACEN = "carpetas";
const CLAVE = "boletas";

export const soportaCarpeta = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

function abrirBase() {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(BASE_DATOS, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

async function leerCarpetaGuardada() {
  try {
    const base = await abrirBase();
    return await new Promise((resolver) => {
      const pedido = base.transaction(ALMACEN).objectStore(ALMACEN).get(CLAVE);
      pedido.onsuccess = () => resolver(pedido.result ?? null);
      pedido.onerror = () => resolver(null);
    });
  } catch {
    return null;
  }
}

async function recordarCarpeta(carpeta) {
  try {
    const base = await abrirBase();
    await new Promise((resolver) => {
      const tx = base.transaction(ALMACEN, "readwrite");
      tx.objectStore(ALMACEN).put(carpeta, CLAVE);
      tx.oncomplete = resolver;
      tx.onerror = resolver;
    });
  } catch {
    // Sin IndexedDB (ventana privada): se volverá a preguntar la próxima vez
  }
}

async function elegirCarpeta() {
  const base = await window.showDirectoryPicker({ id: "gestantonia-boletas", mode: "readwrite", startIn: "documents" });
  await recordarCarpeta(base);
  return base;
}

/**
 * Deja lista la carpeta "Boletas Ventas". Hay que llamarla DIRECTO desde el clic del botón
 * (antes de esperar al servidor): el navegador solo muestra sus ventanas de permiso en respuesta a un clic.
 * Devuelve la carpeta o null (navegador sin soporte, o la persona canceló).
 */
export async function prepararCarpetaBoletas({ cambiar = false } = {}) {
  if (!soportaCarpeta()) return null;
  try {
    let base = cambiar ? null : await leerCarpetaGuardada();
    if (base) {
      let permiso = await base.queryPermission({ mode: "readwrite" });
      if (permiso !== "granted") permiso = await base.requestPermission({ mode: "readwrite" });
      if (permiso !== "granted") base = null;
    }
    if (!base) base = await elegirCarpeta();
    // Si eligieron directamente una carpeta llamada "Boletas Ventas", se usa esa misma
    if (base.name === NOMBRE_CARPETA) return base;
    return await base.getDirectoryHandle(NOMBRE_CARPETA, { create: true });
  } catch (error) {
    if (error?.name !== "AbortError") console.warn("No se pudo usar la carpeta de boletas:", error);
    return null;
  }
}

/** Nombre de la carpeta donde se están guardando las boletas (para mostrarlo), o null. */
export async function carpetaActual() {
  const base = await leerCarpetaGuardada();
  if (!base) return null;
  if (!base.name || base.name === NOMBRE_CARPETA) return NOMBRE_CARPETA;
  return `${base.name} › ${NOMBRE_CARPETA}`;
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Guarda la boleta. Con carpeta (de prepararCarpetaBoletas) la escribe ahí; si no, la descarga.
 * Devuelve "carpeta" o "descarga".
 */
export async function guardarBoleta(blob, nombre, carpeta) {
  if (carpeta) {
    try {
      const archivo = await carpeta.getFileHandle(nombre, { create: true });
      const escritor = await archivo.createWritable();
      await escritor.write(blob);
      await escritor.close();
      return "carpeta";
    } catch (error) {
      console.warn("No se pudo escribir en la carpeta de boletas; se descarga:", error);
    }
  }
  descargar(blob, nombre);
  return "descarga";
}

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
