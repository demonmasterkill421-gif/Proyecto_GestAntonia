import api from "./client";

export const obtenerInventario = (params, signal) =>
  api.get("/api/catalogo/inventario/", { params, signal });
export const obtenerLocales = (signal) =>
  api.get("/api/catalogo/locales/", { signal });
export const obtenerOpcionesProducto = () =>
  api.get("/api/catalogo/productos/");

export const registrarProducto = (datos) =>
  api.post("/api/catalogo/productos/", datos);

// M11: editar datos del producto y el stock mínimo del local.
export const editarInventario = (id, datos) =>
  api.patch(`/api/catalogo/inventario/${id}/`, datos);

// M11: reponer (+) o descontar (-) stock. Deja registro en MovimientoInventario.
export const ajustarStock = (id, cantidad) =>
  api.post(`/api/catalogo/inventario/${id}/ajustar/`, { cantidad });
