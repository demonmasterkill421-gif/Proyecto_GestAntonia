import api from "./client";

// Lista general (la que ya existía)
export const obtenerAsistencias = (params) =>
  api.get("/api/asistencias/", { params });

// Una fila por trabajadora del local, con su registro del día (o null)
// params: { fecha: "2026-11-09", local: 1 }
export const obtenerDia = (params) =>
  api.get("/api/asistencias/dia/", { params });

// Días y horas por trabajadora en un período
// params: { desde: "2026-11-01", hasta: "2026-11-15", local: 1 }
export const obtenerResumen = (params) =>
  api.get("/api/asistencias/resumen/", { params });

// Marcar entrada o salida de hoy (ADMIN y RECEP)
// datos: { trabajador: 5, accion: "entrada" | "salida" }
export const marcarAsistencia = (datos) =>
  api.post("/api/asistencias/marcar/", datos);

// Corregir o crear un registro (solo ADMIN)
// datos: { trabajador, fecha, hora_entrada, hora_salida, motivo }
export const corregirAsistencia = (datos) =>
  api.post("/api/asistencias/corregir/", datos);

// Descargar el Excel del período (solo ADMIN)
// params: { desde: "2026-11-01", hasta: "2026-11-15", local: 1 }
// Devuelve el archivo (blob), igual que exportarVentas
export const exportarAsistencias = async (params) => {
  const { data } = await api.get("/api/asistencias/exportar/", {
    params,
    responseType: "blob",
  });
  return data;
};