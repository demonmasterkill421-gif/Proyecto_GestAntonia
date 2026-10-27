import api from "./client";

export const obtenerAllVentas = () => api.get("/api/ventas/");