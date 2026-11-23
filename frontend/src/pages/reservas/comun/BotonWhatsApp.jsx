import { MessageCircle } from "lucide-react";
import { enlaceWhatsApp } from "./whatsapp";

// Enlace que abre WhatsApp (Web en el computador, la aplicación en el celular) con el mensaje escrito.
// compacto: solo el ícono (para la agenda y junto al teléfono).
export function BotonWhatsApp({ telefono, mensaje, texto = "WhatsApp", compacto = false }) {
  const enlace = enlaceWhatsApp(telefono, mensaje);
  if (!enlace) return null;

  if (compacto) {
    return (
      <a
        href={enlace}
        target="_blank"
        rel="noopener noreferrer"
        title={`Enviar WhatsApp: ${texto}`}
        aria-label={`Enviar WhatsApp: ${texto}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:bg-[#1da851]"
      >
        <MessageCircle size={16} aria-hidden="true" />
      </a>
    );
  }
  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 font-semibold text-white transition hover:bg-[#1da851]"
    >
      <MessageCircle size={18} aria-hidden="true" />
      {texto}
    </a>
  );
}
