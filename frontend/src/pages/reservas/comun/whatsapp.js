// Botón de WhatsApp (pedido de la dueña): abre el chat de la clienta con el mensaje ya escrito.
// Usa el enlace público de WhatsApp (https://wa.me/<número>?text=<mensaje>): es gratis, no necesita
// la API de Meta y sale desde el WhatsApp Business que ya usa el local. La recepcionista solo presiona Enviar.

export const NEGOCIO = "Antonia Centro de Estética";

// "+56 9 1111 1111", "911111111" o "56911111111" → "56911111111" (formato que pide wa.me: solo dígitos, con país)
export function numeroWhatsApp(telefono) {
  const digitos = String(telefono ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return ""; // vacío o no es un teléfono (por ejemplo, una clienta con datos eliminados)
  if (digitos.startsWith("56")) return digitos; // ya trae el código de Chile
  if (digitos.length === 9) return `56${digitos}`; // celular chileno: 9XXXXXXXX
  if (digitos.length === 8) return `569${digitos}`; // número antiguo, sin el 9 inicial
  return digitos; // otro país: se usa tal cual
}

export function enlaceWhatsApp(telefono, mensaje) {
  const numero = numeroWhatsApp(telefono);
  if (!numero) return "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

// La API entrega la hora de Chile con su desfase ("2026-11-20T11:00:00-03:00"): se usa el texto tal cual.
const horaDe = (valor) => valor.slice(11, 16);
function fechaDe(valor) {
  const [a, m, d] = valor.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}
const primerNombre = (nombre) => String(nombre ?? "").trim().split(/\s+/)[0] || "";

// Mensajes listos. r = reserva con cliente_nombre, servicio_nombre, inicio y (opcional) local_nombre.
export const MENSAJES = {
  confirmar: {
    etiqueta: "Pedir confirmación",
    texto: (r) =>
      `Hola ${primerNombre(r.cliente_nombre)}, ¿confirma su cita en ${NEGOCIO}${r.local_nombre ? ` (${r.local_nombre})` : ""} ` +
      `el ${fechaDe(r.inicio)} a las ${horaDe(r.inicio)} para ${r.servicio_nombre}?`,
  },
  recordatorio: {
    etiqueta: "Recordatorio",
    texto: (r) =>
      `Hola ${primerNombre(r.cliente_nombre)}, le recordamos su cita en ${NEGOCIO}${r.local_nombre ? ` (${r.local_nombre})` : ""} ` +
      `el ${fechaDe(r.inicio)} a las ${horaDe(r.inicio)} para ${r.servicio_nombre}. ¡La esperamos!`,
  },
  reprogramada: {
    etiqueta: "Avisar nuevo horario",
    texto: (r) =>
      `Hola ${primerNombre(r.cliente_nombre)}, su cita en ${NEGOCIO} para ${r.servicio_nombre} quedó reprogramada ` +
      `para el ${fechaDe(r.inicio)} a las ${horaDe(r.inicio)}. Cualquier duda, respóndanos por este medio.`,
  },
  suspendida: {
    etiqueta: "Avisar suspensión",
    texto: (r) =>
      `Hola ${primerNombre(r.cliente_nombre)}, su cita en ${NEGOCIO} del ${fechaDe(r.inicio)} a las ${horaDe(r.inicio)} ` +
      `quedó suspendida. Si desea agendar otra hora, respóndanos por este medio.`,
  },
  saludo: {
    etiqueta: "WhatsApp",
    texto: (c) => `Hola ${primerNombre(c.nombre ?? c.cliente_nombre)}, le escribimos de ${NEGOCIO}.`,
  },
};
