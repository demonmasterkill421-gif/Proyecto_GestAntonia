import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function PanelAtajo({ titulo, descripcion, ruta, icono: Icono, destacado = false }) {
  const estiloCaja = destacado
    ? "bg-gradient-to-r from-[#d61f9a] to-[#a8238f] text-white shadow-md shadow-[#d61f9a]/30"
    : "border border-[#e6b8d4] bg-white text-[#1f1218] hover:bg-[#fbeef6]";

  return (
    <Link
      to={ruta}
      className={`group flex items-center gap-3 rounded-2xl p-4 transition active:scale-[0.99] sm:gap-4 sm:p-5 ${estiloCaja}`}
    >
      {Icono && (
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${
            destacado ? "bg-white/20 text-white" : "bg-[#f7e3f1] text-[#b5368f]"
          }`}
        >
          <Icono className="h-6 w-6" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold sm:text-xl">{titulo}</h2>
        {descripcion && (
          <p className={`text-sm sm:text-base ${destacado ? "text-white/85" : "text-gray-600"}`}>
            {descripcion}
          </p>
        )}
      </div>

      <ArrowRight
        className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${
          destacado ? "text-white" : "text-[#b5368f]"
        }`}
      />
    </Link>
  );
}