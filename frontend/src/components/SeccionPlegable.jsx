import { useState } from "react";
import { ChevronDown } from "lucide-react";

// icono: componente de lucide-react (ej. Sparkles). Si no se pasa, se usa el número como antes.
// detalle: texto pequeño que se muestra solo cuando la sección está cerrada.
export function SeccionPlegable({ icono: Icono, numero, titulo, detalle, abiertaInicial = false, children }) {
  const [abierta, setAbierta] = useState(abiertaInicial);

  return (
    <section className="rounded-3xl border border-[#e6b8d4] bg-[#f7e3f1] shadow-lg shadow-[#b5368f]/15">
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        className="flex w-full cursor-pointer items-center gap-4 p-6 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#b5368f] text-base font-bold text-white shadow-md shadow-[#b5368f]/30">
          {Icono ? <Icono size={22} /> : numero}
        </span>
        <h2 className="flex-1 text-2xl font-bold text-[#1f1218]">{titulo}</h2>
        {detalle && !abierta && (
          <span className="text-base font-medium text-[#b5368f]">{detalle}</span>
        )}
        <ChevronDown
          size={24}
          className={`shrink-0 text-[#b5368f] transition-transform duration-300 ${abierta ? "rotate-180" : ""}`}
        />
      </button>

      <div
        inert={!abierta}
        className={`grid transition-all duration-300 ease-in-out ${
          abierta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6">{children}</div>
        </div>
      </div>
    </section>
  );
}