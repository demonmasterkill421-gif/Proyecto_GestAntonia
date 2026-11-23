import { TriangleAlert } from "lucide-react";

// Aviso de la observación interna de la clienta (se muestra al buscarla, al agendar y en el detalle).
export function AvisoObservacion({ texto }) {
  if (!texto) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900" role="note">
      <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <p>
        <b>Observación de la clienta:</b> {texto}
      </p>
    </div>
  );
}
