import { BRANCHES, DEMO_DAYS, DEMO_SERVICES, DEMO_WORKERS, DEMO_RANGE } from '../data/demoReportes.js';

/**
 * Servicio de REPORTES, en modo demostración exclusivamente.
 * Contrato previsto para Django: GET /api/reportes/resumen/?local_id=...&desde=...&hasta=...
 * No existe ni se realiza ninguna llamada HTTP real en esta etapa.
 */
export async function obtenerReporteDemo({ sucursal = 'todas', desde = DEMO_RANGE.start, hasta = DEMO_RANGE.end } = {}) {
  const branch = BRANCHES.find((item) => item.id === sucursal) ?? BRANCHES[0];
  const dias = DEMO_DAYS.filter((item) => item.fecha >= desde && item.fecha <= hasta);
  const hayDatos = dias.length > 0;
  const dayRatio = dias.length / DEMO_DAYS.length;
  const factor = branch.factor;
  const ingresoBase = dias.reduce((acc, item) => acc + item.ganancias, 0);
  const serviciosBase = dias.reduce((acc, item) => acc + item.servicios, 0);
  const escala = (value) => Math.round(value * factor);
  const trabajadores = DEMO_WORKERS.filter((worker) => sucursal === 'todas' || worker.local === sucursal)
    .map((worker) => ({
      ...worker,
      servicios: Math.round(worker.servicios * dayRatio),
      ventas: Math.round(worker.ventas * dayRatio),
      horas: Math.round(worker.horas * dayRatio),
      comision: Math.round(worker.comision * dayRatio),
    }));

  return {
    modo: 'demo',
    sucursal: branch,
    periodo: { desde, hasta },
    hayDatos,
    indicadores: {
      ganancias: escala(ingresoBase),
      variacionGanancias: hayDatos ? 12.3 : null,
      servicios: escala(serviciosBase),
      variacionServicios: hayDatos ? Math.round(18 * factor * dayRatio) : null,
      trabajadoresActivos: hayDatos ? (sucursal === 'todas' ? 14 : sucursal === 'mall' ? 6 : 4) : 0,
      sucursales: sucursal === 'todas' ? 3 : 1,
      asistencia: hayDatos ? (sucursal === 'todas' ? 94 : sucursal === 'mall' ? 96 : sucursal === 'vargas' ? 93 : 92) : 0,
      variacionAsistencia: hayDatos ? 2 : null,
    },
    gananciasDiarias: dias.map((dia) => ({ ...dia, ganancias: escala(dia.ganancias) })),
    serviciosPorTipo: hayDatos ? DEMO_SERVICES.map((item) => ({
      ...item,
      porcentaje: Math.min(100, Math.round(item.porcentaje * (sucursal === 'todas' ? 1 : sucursal === 'mall' ? 1 : sucursal === 'vargas' ? 0.89 : 0.78))),
    })) : [],
    trabajadores: hayDatos ? trabajadores : [],
  };
}

export function formatoCLP(cantidad) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(cantidad);
}

export function formatoFecha(fechaISO) {
  if (!fechaISO) return '—';
  const [year, month, day] = fechaISO.split('-');
  return `${day}/${month}/${year}`;
}

export function exportarReporteCSV(reporte) {
  const { periodo, sucursal, indicadores, trabajadores } = reporte;
  const filas = [
    ['REPORTE DEMOSTRATIVO — GestAntonia'],
    ['Origen', 'Datos simulados: NO corresponden a una base de datos real'],
    ['Sucursal', sucursal.name],
    ['Desde', formatoFecha(periodo.desde)],
    ['Hasta', formatoFecha(periodo.hasta)],
    [],
    ['Indicador', 'Valor'],
    ['Ganancias CLP', indicadores.ganancias],
    ['Servicios realizados', indicadores.servicios],
    ['Trabajadores activos', indicadores.trabajadoresActivos],
    ['Asistencia promedio', `${indicadores.asistencia}%`],
    [],
    ['Trabajador', 'Servicios', 'Ventas CLP', 'Asistencia', 'Horas', 'Comisión CLP', 'Estado'],
    ...trabajadores.map((w) => [w.nombre, w.servicios, w.ventas, `${w.asistencia}%`, w.horas, w.comision, w.estado]),
  ];
  const csv = '\uFEFF' + filas.map((fila) => fila.map((valor) => `"${String(valor ?? '').replaceAll('"', '""')}"`).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `GestAntonia_Reportes_DEMO_${periodo.desde}_${periodo.hasta}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
