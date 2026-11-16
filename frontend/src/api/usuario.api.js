import api from "./client";

export const iniciarSesion = (email, password) => //U2. Arma la solicitud y la envía a GestAntonia urls.py
  api.post("/api/login/", { email, password });

export const obtenerMe = () => api.get("/api/me/");