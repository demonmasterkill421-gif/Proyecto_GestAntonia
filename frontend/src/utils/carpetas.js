// Guarda los archivos que genera el sistema en carpetas del computador del local:
//   boletas    → "Boletas Ventas"       (boleta de cada venta)
//   ventas     → "Reportes Ventas"      (reporte de gestión y exportaciones de la lista de ventas)
//   asistencia → "Reportes Asistencia"  (exportación de la asistencia)
//
// Los navegadores no dejan que una página escriba en el disco por su cuenta: cada carpeta se elige
// UNA vez (botón "Elegir carpeta") y desde ahí los archivos se guardan solos. Se recuerda en este navegador.
//
// OJO: Chrome NO deja elegir directamente Documentos, Descargas ni Escritorio ("contiene archivos del
// sistema"), pero sí una carpeta DENTRO de ellas. Si se elige una carpeta con el nombre exacto
// (ej.: "Reportes Ventas") se usa esa; si se elige otra (ej.: "GestAntonia"), adentro se crea la que falta,
// y esa misma carpeta queda para los demás tipos que aún no tengan una.
//
// Funciona en Chrome y Edge. En otros navegadores (Firefox, Safari), o sin carpeta elegida,
// el archivo se descarga normalmente a la carpeta de descargas.

export const CARPETAS = {
  boletas: "Boletas Ventas",
  ventas: "Reportes Ventas",
  asistencia: "Reportes Asistencia",
};

const BASE_DATOS = "gestantonia";
const ALMACEN = "carpetas";
// "boletas" conserva la clave que ya usaban las boletas (no hay que volver a elegir su carpeta)
const CLAVE = { boletas: "boletas", ventas: "carpeta-ventas", asistencia: "carpeta-asistencia" };

export const soportaCarpeta = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

function abrirBase() {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(BASE_DATOS, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
  });
}

async function leerGuardada(tipo) {
  try {
    const base = await abrirBase();
    return await new Promise((resolver) => {
      const pedido = base.transaction(ALMACEN).objectStore(ALMACEN).get(CLAVE[tipo]);
      pedido.onsuccess = () => resolver(pedido.result ?? null);
      pedido.onerror = () => resolver(null);
    });
  } catch {
    return null;
  }
}

async function recordar(tipo, carpeta) {
  try {
    const base = await abrirBase();
    await new Promise((resolver) => {
      const tx = base.transaction(ALMACEN, "readwrite");
      tx.objectStore(ALMACEN).put(carpeta, CLAVE[tipo]);
      tx.oncomplete = resolver;
      tx.onerror = resolver;
    });
  } catch {
    // Sin IndexedDB (ventana privada): se volverá a preguntar la próxima vez
  }
}

async function elegir(tipo) {
  const elegida = await window.showDirectoryPicker({ id: `gestantonia-${tipo}`, mode: "readwrite", startIn: "documents" });
  await recordar(tipo, elegida);
  // Si eligieron una carpeta "madre" (no la del nombre exacto), sirve también para los tipos sin carpeta
  if (!Object.values(CARPETAS).includes(elegida.name)) {
    for (const otro of Object.keys(CARPETAS)) {
      if (otro !== tipo && !(await leerGuardada(otro))) await recordar(otro, elegida);
    }
  }
  return elegida;
}

/**
 * Deja lista la carpeta del tipo indicado. Hay que llamarla DIRECTO desde el clic de un botón:
 * el navegador solo muestra sus ventanas de permiso en respuesta a un clic.
 * cambiar: abre la ventana para elegir otra carpeta.
 * elegirSiFalta: si aún no hay carpeta, abre la ventana; con false devuelve null (el archivo se descarga).
 * Devuelve la carpeta o null (navegador sin soporte, sin carpeta elegida, o la persona canceló).
 */
export async function prepararCarpeta(tipo, { cambiar = false, elegirSiFalta = true } = {}) {
  if (!soportaCarpeta()) return null;
  const nombre = CARPETAS[tipo];
  try {
    let base = cambiar ? null : await leerGuardada(tipo);
    if (base) {
      let permiso = await base.queryPermission({ mode: "readwrite" });
      if (permiso !== "granted") permiso = await base.requestPermission({ mode: "readwrite" });
      if (permiso !== "granted") base = null;
    }
    if (!base) {
      if (!cambiar && !elegirSiFalta) return null;
      base = await elegir(tipo);
    }
    if (base.name === nombre) return base;
    return await base.getDirectoryHandle(nombre, { create: true });
  } catch (error) {
    if (error?.name !== "AbortError") console.warn(`No se pudo usar la carpeta «${nombre}»:`, error);
    return null;
  }
}

/** Nombre de la carpeta donde se guarda ese tipo (para mostrarlo), o null si aún no se eligió. */
export async function carpetaActual(tipo) {
  const nombre = CARPETAS[tipo];
  const base = await leerGuardada(tipo);
  if (!base) return null;
  if (!base.name || base.name === nombre) return nombre;
  return `${base.name} › ${nombre}`;
}

export function descargar(blob, nombre) {
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
 * Guarda un archivo. Con carpeta (de prepararCarpeta) lo escribe ahí; si no, lo descarga.
 * Devuelve "carpeta" o "descarga".
 */
export async function guardarArchivo(blob, nombre, carpeta) {
  if (carpeta) {
    try {
      const archivo = await carpeta.getFileHandle(nombre, { create: true });
      const escritor = await archivo.createWritable();
      await escritor.write(blob);
      await escritor.close();
      return "carpeta";
    } catch (error) {
      console.warn("No se pudo escribir en la carpeta; se descarga:", error);
    }
  }
  descargar(blob, nombre);
  return "descarga";
}
