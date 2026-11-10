// Datos y funciones compartidas por las pantallas de especialistas (3.8c · Edson).

export const CARGOS = [
  { valor: "MANICURISTA", etiqueta: "Manicurista" },
  { valor: "DEPILADORA", etiqueta: "Depiladora" },
  { valor: "COSMETOLOGA", etiqueta: "Cosmetóloga" },
  { valor: "MASOTERAPEUTA", etiqueta: "Masoterapeuta" },
  { valor: "OTRO", etiqueta: "Otro" },
];

export const etiquetaCargo = (valor) => CARGOS.find((c) => c.valor === valor)?.etiqueta ?? "—";

// La API responde los errores como { campo: ["mensaje"] } o { detail: "mensaje" }.
// Esta función los deja siempre como texto, para mostrarlos en pantalla.
export function textoError(valor) {
  if (!valor) return "";
  return Array.isArray(valor) ? valor.join(" ") : String(valor);
}

// Mensaje general de un error de axios (sin red, sin permiso o error de la API).
export function mensajeGeneral(error) {
  const datos = error?.response?.data;
  if (!error?.response) return "No se pudo conectar con el servidor. Revisa que Django esté corriendo.";
  if (datos?.detail) return textoError(datos.detail);
  if (error.response.status === 403) return "No tienes permiso para hacer esto.";
  if (error.response.status === 404) return "No se encontró lo que buscas.";
  return "Ocurrió un error. Revisa los datos e inténtalo de nuevo.";
}
