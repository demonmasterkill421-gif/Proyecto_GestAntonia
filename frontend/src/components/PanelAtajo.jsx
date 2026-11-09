import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

// titulo: nombre del atajo
// descripcion: frase corta opcional
// boton: texto de la píldora (por defecto "Abrir")
// destacado: true para la tarjeta principal (degradado magenta de intensidad media)
// proximamente: true para una tarjeta gris, sin enlace, de algo que aún no existe
export function PanelAtajo({
  titulo,
  descripcion,
  boton = "Abrir",
  ruta,
  icono: Icono,
  destacado = false,
  proximamente = false,
}) {
  // ---------- Tarjeta bloqueada ----------
  if (proximamente) {
    return (
      <div
        aria-disabled="true"
        className="relative flex cursor-not-allowed items-center gap-4 overflow-hidden rounded-3xl border border-dashed border-[#d9bccd] bg-white/60 p-5 pl-7 text-gray-500 sm:gap-5 sm:p-6 sm:pl-8"
      >
        <span className="absolute inset-y-0 left-0 w-2 bg-gray-300" aria-hidden="true" />

        {Icono && (
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-200 text-gray-400 sm:h-16 sm:w-16">
            <Icono className="h-7 w-7 sm:h-8 sm:w-8" />
          </span>
        )}

        <div className="relative min-w-0 flex-1">
          <h2 className="text-xl font-bold sm:text-2xl">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-base">{descripcion}</p>}
        </div>

        <span className="relative shrink-0 rounded-full bg-gray-200 px-3 py-2 text-base font-semibold text-gray-500 sm:px-4">
          Próximamente
        </span>
      </div>
    );
  }

  // ---------- Tarjeta normal ----------
  const caja = destacado
    ? "border-transparent bg-gradient-to-r from-[#cf40a1] to-[#ab3391] text-white shadow-[#b5368f]/30 hover:shadow-[#b5368f]/45"
    : "border-[#e6b8d4] bg-white text-[#1f1218] shadow-[#b5368f]/20 hover:shadow-[#b5368f]/35";

  const franja = destacado ? "bg-white/40" : "bg-gradient-to-b from-[#d61f9a] to-[#a8238f]";
  // El círculo es magenta (o blanco en la destacada). En reposo no se ve (0 %)
  // y al pasar el mouse aparece al 25 % y se agranda un poco
  const circulo = destacado ? "bg-white" : "bg-[#b5368f]";
  const cuadroIcono = destacado
    ? "bg-white/20 text-white"
    : "bg-gradient-to-br from-[#d61f9a] to-[#a8238f] text-white shadow-md shadow-[#b5368f]/30";
  const pildora = destacado
    ? "bg-white/20 text-white group-hover:bg-white group-hover:text-[#a8238f]"
    : "bg-[#f7e3f1] text-[#9c2d7b] group-hover:bg-[#b5368f] group-hover:text-white";

  return (
    <Link
      to={ruta}
      className={`group relative flex items-center gap-4 overflow-hidden rounded-3xl border p-5 pl-7 shadow-lg transition duration-200 hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:scale-[0.99] sm:gap-5 sm:p-6 sm:pl-8 ${caja}`}
    >
      {/* Adornos */}
      <span className={`absolute inset-y-0 left-0 w-2 ${franja}`} aria-hidden="true" />
      <span
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 transition-all duration-300 group-hover:scale-125 group-hover:opacity-25 ${circulo}`}
        aria-hidden="true"
      />

      {Icono && (
        <span
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16 ${cuadroIcono}`}
        >
          <Icono className="h-7 w-7 sm:h-8 sm:w-8" />
        </span>
      )}

      <div className="relative min-w-0 flex-1">
        <h2 className="text-xl font-bold sm:text-2xl">{titulo}</h2>
        {descripcion && (
          <p className={`mt-0.5 text-base ${destacado ? "text-white/90" : "text-[#9c2d7b]"}`}>{descripcion}</p>
        )}
      </div>

      <span
        className={`relative flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-base font-semibold transition-colors sm:px-4 ${pildora}`}
      >
        <span className="hidden sm:inline">{boton}</span>
        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}