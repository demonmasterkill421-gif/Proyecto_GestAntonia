import api from '../../../../api/client.js';
import { guardarArchivo, prepararCarpeta } from '../../../../utils/carpetas.js';

// Endpoint protegido con JWT; el interceptor global agrega el token automáticamente.
export async function obtenerReporte({ sucursal, desde, hasta }) {
  const { data } = await api.get('/api/reportes/resumen/', {
    params: { local_id: sucursal, desde, hasta },
  });
  return data;
}

export function formatoCLP(cantidad) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(cantidad ?? 0);
}

export function formatoFecha(fechaISO) {
  if (!fechaISO) return '—';
  const [year, month, day] = fechaISO.split('-');
  return `${day}/${month}/${year}`;
}

// Descarga el reporte ya filtrado en Excel ("excel") o PDF ("pdf"), generado por Django, y lo guarda en la
// carpeta "Reportes Ventas" si ya se eligió (si no, se descarga). Devuelve el texto para avisar dónde quedó.
export async function descargarReporte(tipo, { sucursal, desde, hasta }) {
  // La carpeta se pide antes de esperar al servidor (el permiso del navegador necesita el clic reciente)
  const carpeta = await prepararCarpeta('ventas', { elegirSiFalta: false });
  const respuesta = await api.get(`/api/reportes/${tipo}/`, {
    params: { local_id: sucursal, desde, hasta },
    responseType: 'blob',
  });
  const extension = tipo === 'excel' ? 'xlsx' : 'pdf';
  const coincide = /filename="?([^";]+)"?/i.exec(respuesta.headers['content-disposition'] ?? '');
  const nombre = coincide ? coincide[1] : `GestAntonia_Reporte_${desde}_${hasta}.${extension}`;
  const donde = await guardarArchivo(respuesta.data, nombre, carpeta);
  return donde === 'carpeta' ? `Reporte guardado en «Reportes Ventas»: ${nombre}` : `Reporte descargado: ${nombre}`;
}

// Los errores de una descarga llegan como Blob: se leen para mostrar el mensaje de Django.
export async function mensajeDeDescarga(err) {
  const datos = err?.response?.data;
  if (datos instanceof Blob) {
    try {
      return JSON.parse(await datos.text()).detail ?? 'No se pudo generar el archivo.';
    } catch {
      return 'No se pudo generar el archivo.';
    }
  }
  return err?.response ? 'No se pudo generar el archivo.' : 'No hay conexión con el servidor.';
}
