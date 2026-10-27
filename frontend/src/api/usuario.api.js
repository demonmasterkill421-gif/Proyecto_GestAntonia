import api from "./client";

export const iniciarSesion = (email, password) =>
  api.post("/api/login/", { email, password });

export const obtenerMe = () => api.get("/api/me/");