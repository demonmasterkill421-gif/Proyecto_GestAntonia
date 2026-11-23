import api from "./client";

// Precios de servicios y productos: precio base y precio especial por local (solo administradora)
export const obtenerPrecios = async () => (await api.get("/api/catalogo/precios/")).data;

// cambios: { precio_base?: número, precios?: { "<id local>": número | null } } (null = usar el precio base)
export const guardarPrecio = async (id, cambios) => (await api.patch(`/api/catalogo/precios/${id}/`, cambios)).data;
