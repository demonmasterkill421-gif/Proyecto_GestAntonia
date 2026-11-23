import api from "./client";

// Locales reales de la base de datos (id y nombre), para los selectores.
export const listarLocales = () => api.get("/api/reservas/locales/");

// Gestión de locales (solo la administradora): todos, con ubicación, descripción y estado.
export const obtenerLocalesGestion = () => api.get("/api/locales/");
export const crearLocal = (datos) => api.post("/api/locales/", datos);
export const editarLocal = (id, datos) => api.patch(`/api/locales/${id}/`, datos);
