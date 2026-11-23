import api from "./client";

export const obtenerAllVentas = (params) => api.get("/api/ventas/", { params });

export const registrarVenta = (datos) => api.post("/api/ventas/", datos);

export const obtenerServiciosVenta = () => api.get("/api/ventas/servicios/");

// Trabajadoras activas del local (la administradora puede filtrar con { local })
export const obtenerTrabajadorasVenta = (params) => api.get("/api/ventas/trabajadoras/", { params });


export const obtenerProductosVenta = async () => {
  const { data } = await api.get("/api/ventas/productos/");
  return data;
};


export const exportarVentas = async (ids) => {
  const { data } = await api.post("/api/ventas/exportar/", { ids }, { responseType: "blob" });
  return data;
};


// Solo comprueba la clave de anulación (no anula nada). Falla con 400 si es incorrecta
export const verificarClaveAnulacion = (clave) => api.post("/api/ventas/verificar-clave/", { clave });

// Clave de anulación (solo la administradora): si ya existe y cuándo se cambió. Nunca devuelve la clave
export const obtenerEstadoClave = async () => {
  const { data } = await api.get("/api/ventas/clave-anulacion/");
  return data;
};

// Crea o cambia la clave de anulación; devuelve el estado nuevo
export const cambiarClaveAnulacion = async (clave, repetirClave) => {
  const { data } = await api.post("/api/ventas/clave-anulacion/", { clave, repetir_clave: repetirClave });
  return data;
};

export const anularVenta = (id, motivo, clave) => api.post(`/api/ventas/${id}/anular/`, { motivo, clave });

export const solicitarAnulacion = (id, motivo) =>
  api.post(`/api/ventas/${id}/solicitar-anulacion/`, { motivo });

export const obtenerSolicitudes = (params) => api.get("/api/solicitudes-anulacion/", { params });

export const aprobarSolicitud = (id, respuesta = "") =>
  api.post(`/api/solicitudes-anulacion/${id}/aprobar/`, { respuesta });

export const rechazarSolicitud = (id, respuesta = "") =>
  api.post(`/api/solicitudes-anulacion/${id}/rechazar/`, { respuesta });