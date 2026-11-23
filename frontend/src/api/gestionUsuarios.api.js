import api from "./client";

// Usuarios que no son especialistas (recepcionistas, administradoras). Solo la administradora.
export const listarUsuarios = () => api.get("/api/usuarios/");
export const rolesDisponibles = () => api.get("/api/usuarios/roles/");
export const crearUsuario = (datos) => api.post("/api/usuarios/", datos);
export const editarUsuario = (id, datos) => api.patch(`/api/usuarios/${id}/`, datos);
export const desactivarUsuario = (id) => api.post(`/api/usuarios/${id}/desactivar/`);
export const activarUsuario = (id) => api.post(`/api/usuarios/${id}/activar/`);

// Primera administradora (solo cuando la base no tiene usuarios)
export const estadoInstalacion = () => api.get("/api/instalacion/");
export const crearPrimeraAdministradora = (datos) => api.post("/api/instalacion/", datos);

// Junta los mensajes de error de Django en un texto (o por campo con porCampo=true)
export function erroresDe(err, porCampo = false) {
  const d = err?.response?.data;
  if (!d) return porCampo ? { general: "No hay conexión con el servidor." } : "No hay conexión con el servidor.";
  if (typeof d === "string") return porCampo ? { general: "Error del servidor." } : "Error del servidor.";
  const texto = (v) => (Array.isArray(v) ? v.join(" ") : typeof v === "object" ? Object.values(v).flat().join(" ") : String(v));
  if (porCampo) {
    const salida = {};
    for (const [campo, valor] of Object.entries(d)) salida[campo === "detail" || campo === "non_field_errors" ? "general" : campo] = texto(valor);
    return salida;
  }
  return Object.values(d).map(texto).join(" ");
}
