import { AlertTriangle, Search, X } from "lucide-react";

// Mismo estilo de campo que el buscador de Ventas
const campo =
  "h-12 w-full rounded-lg border border-[#e6b8d4] bg-white px-3 text-base text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30";

// Botón tipo "pastilla": marcado = relleno rosado
const pastilla = (activo) =>
  `cursor-pointer rounded-full border px-4 py-2 text-base font-semibold ${
    activo
      ? "border-[#b5368f] bg-[#b5368f] text-white"
      : "border-[#e6b8d4] bg-white text-[#b5368f] hover:bg-[#fbeef6]"
  }`;

export function BuscadorInventario({ filtros, onChange, locales }) {
  const hayFiltros = filtros.busqueda || filtros.local || filtros.bajo_minimo;

  return (
    <div className="px-4 pb-4 sm:px-6">
      {/* Buscador */}
      <div className="flex gap-3 pb-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar producto</span>
          <Search
            size={20}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b5368f]"
          />
          <input
            type="search"
            value={filtros.busqueda}
            maxLength={100}
            onChange={(e) => onChange({ ...filtros, busqueda: e.target.value })}
            placeholder="Buscar producto (ej.: esmalte, algodón…)"
            className={`${campo} pl-10`}
          />
        </label>

        {hayFiltros && (
          <button
            type="button"
            onClick={() => onChange({ busqueda: "", local: "", bajo_minimo: false })}
            aria-label="Limpiar filtros"
            title="Limpiar filtros"
            className="flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#b5368f] bg-white px-3 text-base font-semibold text-[#b5368f] hover:bg-[#fbeef6] sm:px-4"
          >
            <X size={20} />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        )}
      </div>

      {/* Atajos de local + stock bajo */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Local" className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!filtros.local}
            onClick={() => onChange({ ...filtros, local: "" })}
            className={pastilla(!filtros.local)}
          >
            Todos
          </button>
          {locales.map((local) => {
            const activo = String(filtros.local) === String(local.id);
            return (
              <button
                key={local.id}
                type="button"
                aria-pressed={activo}
                onClick={() => onChange({ ...filtros, local: String(local.id) })}
                className={pastilla(activo)}
              >
                {local.nombre}
              </button>
            );
          })}
        </div>

        <span className="mx-1 hidden h-6 w-px bg-[#e6b8d4] sm:block" aria-hidden="true" />

        <button
          type="button"
          aria-pressed={filtros.bajo_minimo}
          onClick={() => onChange({ ...filtros, bajo_minimo: !filtros.bajo_minimo })}
          className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-base font-semibold ${
            filtros.bajo_minimo
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-amber-300 bg-white text-amber-800 hover:bg-amber-50"
          }`}
        >
          <AlertTriangle size={18} />
          Solo stock bajo
        </button>
      </div>
    </div>
  );
}
