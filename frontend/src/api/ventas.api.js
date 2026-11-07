import api from "./client";

export const obtenerAllVentas = (params) => api.get("/api/ventas/", { params });

export const registrarVenta = (datos) => api.post("/api/ventas/", datos);

export const obtenerServiciosVenta = () => api.get("/api/ventas/servicios/");


export const obtenerProductosVenta = async () => {
  const { data } = await api.get("/api/ventas/productos/");
  return data;
};


export const exportarVentas = async (ids) => {
  const { data } = await api.post("/api/ventas/exportar/", { ids }, { responseType: "blob" });
  return data;
};