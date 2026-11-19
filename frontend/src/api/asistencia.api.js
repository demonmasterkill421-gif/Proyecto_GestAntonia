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

// Eliminar un registro de asistencia con motivo obligatorio (solo ADMIN)
export const eliminarAsistencia = (id, motivo) =>
  api.post(`/api/asistencias/${id}/eliminar/`, { motivo });

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

// Petición automática para marcar entrada/salida desde el QR con token de seguridad
export const escanearAsistenciaAutomatica = (token) =>
  api.post("/api/asistencias/escanear/", { token });

// Consultar el QR activo de un local (solo ADMIN)
export const obtenerQR = (local) =>
  api.get("/api/asistencias/qr/", { params: { local } });

// Generar o reemplazar el QR activo de un local (solo ADMIN)
export const generarQR = (local) =>
  api.post("/api/asistencias/qr/", { local });

// Registros propios de la trabajadora con sesión iniciada (M6)
export const obtenerMiAsistencia = () =>
  api.get("/api/asistencias/mia/");