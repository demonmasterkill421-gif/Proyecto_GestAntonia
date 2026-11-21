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

// Porcentajes de comisión: en Chile se escribe con coma ("12,5"). El campo es de texto (no "number")
// porque el navegador borraba la coma sin avisar: "0,12" quedaba como "012" y se guardaba 12 %.
// Devuelve { valor: "12.5" (con punto, como lo pide la API), error, aviso }.
export function leerPorcentaje(texto) {
  const limpio = String(texto ?? "").trim().replace(",", ".");
  if (limpio === "") return { valor: "", error: "Ingresa el porcentaje (de 0 a 100)." };
  if (!/^\d+(\.\d+)?$/.test(limpio)) return { valor: "", error: "Usa solo números, por ejemplo 12 o 12,5." };
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return { valor: "", error: "Máximo 2 decimales, por ejemplo 12,55." };
  const numero = Number(limpio);
  if (numero > 100) return { valor: "", error: "No puede ser mayor que 100 %." };
  // Entre 0 y 1 es válido, pero casi siempre es un error de tipeo (0,12 en vez de 12)
  const aviso =
    numero > 0 && numero < 1
      ? `Ojo: es menos de 1 %. ¿Quisiste decir ${String(Math.round(numero * 10000) / 100).replace(".", ",")} %?`
      : "";
  return { valor: String(numero), error: "", aviso };
}

// Mostrar un porcentaje de la API ("12.50") como se escribe en Chile ("12,5")
export const mostrarPorcentaje = (valor) => String(Number(valor ?? 0)).replace(".", ",");

// Mensaje general de un error de axios (sin red, sin permiso o error de la API).
export function mensajeGeneral(error) {
  const datos = error?.response?.data;
  if (!error?.response) return "No se pudo conectar con el servidor. Revisa que Django esté corriendo.";
  if (datos?.detail) return textoError(datos.detail);
  if (error.response.status === 403) return "No tienes permiso para hacer esto.";
  if (error.response.status === 404) return "No se encontró lo que buscas.";
  return "Ocurrió un error. Revisa los datos e inténtalo de nuevo.";
}
