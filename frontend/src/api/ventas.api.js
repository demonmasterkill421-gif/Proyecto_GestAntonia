//Se importa el cliente, cuando se ejecuta una consulta, se obtiene el token de
//acceso
import api from "./client"; 




//GET____________________________________________________________________________

export const obtenerAllVentas = (params) => api.get("/api/ventas/", { params });
export const obtenerServiciosVenta = () => api.get("/api/ventas/servicios/");

export const obtenerProductosVenta = async () => {
  const { data } = await api.get("/api/ventas/productos/");
  return data;
};



//POST___________________________________________________________________________
export const registrarVenta = (datos) => api.post("/api/ventas/", datos);


export const exportarVentas = async (ids) => {
  const { data } = await api.post("/api/ventas/exportar/", { ids }, { responseType: "blob" });
  return data;
};








export const anularVenta = (id, motivo) => api.post(`/api/ventas/${id}/anular/`, { motivo });

export const solicitarAnulacion = (id, motivo) =>
  api.post(`/api/ventas/${id}/solicitar-anulacion/`, { motivo });

export const obtenerSolicitudes = (params) => api.get("/api/solicitudes-anulacion/", { params });

export const aprobarSolicitud = (id, respuesta = "") =>
  api.post(`/api/solicitudes-anulacion/${id}/aprobar/`, { respuesta });

export const rechazarSolicitud = (id, respuesta = "") =>
  api.post(`/api/solicitudes-anulacion/${id}/rechazar/`, { respuesta });