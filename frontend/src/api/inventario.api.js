import api from "./client";

export const obtenerInventario = (params, signal) =>
  api.get("/api/catalogo/inventario/", { params, signal });
export const obtenerLocales = (signal) =>
  api.get("/api/catalogo/locales/", { signal });
export const obtenerOpcionesProducto = () =>
  api.get("/api/catalogo/productos/");

export const registrarProducto = (datos) =>
  api.post("/api/catalogo/productos/", datos);
