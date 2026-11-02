// Datos de ejemplo. Después vienen de /api/locales/
export const SUCURSALES = [
  { id: 1, nombre: "Mall Plaza Calama", reservasHoy: 9, presentes: 2, especialistas: 4, ventasHoy: 185000, cantidadVentas: 6, proxima: { hora: "09:30", especialista: "Daniela Pérez" } },
  { id: 2, nombre: "Vargas", reservasHoy: 7, presentes: 2, especialistas: 3, ventasHoy: 142500, cantidadVentas: 5, proxima: { hora: "10:00", especialista: "Rocío Campos" } },
  { id: 3, nombre: "J. A. Espinosa", reservasHoy: 5, presentes: 2, especialistas: 2, ventasHoy: 98000, cantidadVentas: 3, proxima: { hora: "11:30", especialista: "Belén Ortiz" } },
];

// Lee la sucursal elegida (queda guardada en el navegador)
export function leerSucursalActual() {
  try {
    const id = Number(localStorage.getItem("sucursal"));
    return SUCURSALES.find((s) => s.id === id) ?? SUCURSALES[0];
  } catch {
    return SUCURSALES[0];
  }
}

export function guardarSucursal(id) {
  try {
    localStorage.setItem("sucursal", id);
  } catch {
    // si no se puede guardar, igual funciona
  }
}