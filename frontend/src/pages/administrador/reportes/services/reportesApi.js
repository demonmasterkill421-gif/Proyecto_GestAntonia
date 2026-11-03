import api from '../../../../api/client.js';

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

export function exportarReporteCSV(reporte) {
  const { periodo, sucursal, indicadores, trabajadores } = reporte;
  const filas = [
    ['REPORTE — GestAntonia'],
    ['Origen', 'API Django / PostgreSQL (ventas confirmadas)'],
    ['Sucursal', sucursal.name],
    ['Desde', formatoFecha(periodo.desde)],
    ['Hasta', formatoFecha(periodo.hasta)],
    [],
    ['Indicador', 'Valor'],
    ['Ganancias CLP', indicadores.ganancias],
    ['Servicios realizados', indicadores.servicios],
    ['Trabajadores activos', indicadores.trabajadoresActivos],
    ['Asistencia promedio', indicadores.asistencia === null ? 'No calculable' : `${indicadores.asistencia}%`],
    [],
    ['Trabajador', 'Servicios', 'Ventas CLP', 'Asistencia', 'Horas', 'Comisión CLP', 'Estado'],
    ...trabajadores.map((w) => [w.nombre, w.servicios, w.ventas,
      w.asistencia === null ? 'No calculable' : `${w.asistencia}%`, w.horas, w.comision, w.estado]),
  ];
  const csv = '\uFEFF' + filas.map((fila) =>
    fila.map((valor) => `"${String(valor ?? '').replaceAll('"', '""')}"`).join(';')
  ).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `GestAntonia_Reporte_${periodo.desde}_${periodo.hasta}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
