import api from "./client";

export const obtenerAllVentas = (params) => api.get("/api/ventas/", { params });

export const registrarVenta = (datos) => api.post("/api/ventas/", datos);

export const obtenerServiciosVenta = () => api.get("/api/ventas/servicios/");