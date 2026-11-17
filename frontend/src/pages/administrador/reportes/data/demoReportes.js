/**
 * DATOS 100 % FICTICIOS, inspirados en los valores de la maqueta suministrada.
 * La UI solo consume servicios/reportesApi.js para poder reemplazar esta capa por Django.
 */
export const BRANCHES = [
  { id: 'todas', name: 'Todas las sucursales', shortName: 'Todas las sucursales', factor: 1 },
  { id: 'mall', name: 'Mall Plaza Calama', shortName: 'Mall Plaza Calama', factor: 0.45 },
  { id: 'vargas', name: 'Centro Vargas', shortName: 'Centro Vargas', factor: 0.32 },
  { id: 'espinosa', name: 'Centro J. A. Espinosa', shortName: 'Centro J. A. Espinosa', factor: 0.23 },
];

export const DEMO_RANGE = { start: '2026-10-01', end: '2026-10-12' };

export const DEMO_DAYS = [
  { fecha: '2026-10-01', ganancias: 260000, servicios: 16 },
  { fecha: '2026-10-02', ganancias: 420000, servicios: 23 },
  { fecha: '2026-10-03', ganancias: 350000, servicios: 20 },
  { fecha: '2026-10-04', ganancias: 580000, servicios: 32 },
  { fecha: '2026-10-05', ganancias: 510000, servicios: 27 },
  { fecha: '2026-10-06', ganancias: 645000, servicios: 36 },
  { fecha: '2026-10-07', ganancias: 560000, servicios: 30 },
  { fecha: '2026-10-08', ganancias: 760000, servicios: 42 },
  { fecha: '2026-10-09', ganancias: 590000, servicios: 34 },
  { fecha: '2026-10-10', ganancias: 570900, servicios: 26 },
]; // Total demo: CLP $5.245.900 y 286 servicios.

export const DEMO_SERVICES = [
  { nombre: 'Manicure permanente', porcentaje: 86 },
  { nombre: 'Uñas acrílicas', porcentaje: 68 },
  { nombre: 'Pedicure', porcentaje: 54 },
  { nombre: 'Depilación', porcentaje: 42 },
  { nombre: 'Lifting de pestañas', porcentaje: 36 },
];

export const DEMO_WORKERS = [
  { nombre: 'Camila Rojas', servicios: 46, ventas: 845000, asistencia: 96, horas: 82, comision: 84500, local: 'mall', estado: 'Activa' },
  { nombre: 'Fernanda Díaz', servicios: 39, ventas: 716000, asistencia: 94, horas: 78, comision: 71600, local: 'vargas', estado: 'Activa' },
  { nombre: 'Javiera Muñoz', servicios: 34, ventas: 628000, asistencia: 91, horas: 76, comision: 62800, local: 'espinosa', estado: 'Activa' },
];
