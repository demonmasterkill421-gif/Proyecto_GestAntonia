import api from "./client";

// Locales reales de la base de datos (id y nombre), para los selectores.
export const listarLocales = () => api.get("/api/reservas/locales/");
