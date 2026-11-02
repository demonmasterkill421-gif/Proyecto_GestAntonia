import { useState } from "react";
import { ChevronDown, Check, Store } from "lucide-react";

// Lista de ejemplo. Después se reemplaza por los datos de /api/locales/
const SUCURSALES = [
  { id: 1, nombre: "Local Mall Plaza Calama" },
  { id: 2, nombre: "Local Centro 1" },
  { id: 3, nombre: "Local Centro 2" },
];

function leerGuardada() {
  try {
    const id = Number(localStorage.getItem("sucursal"));
    return SUCURSALES.find((s) => s.id === id) ?? SUCURSALES[0];
  } catch {
    return SUCURSALES[0];
  }
}

export function SelectorSucursal() {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState(leerGuardada);

  const elegir = (sucursal) => {
    setActual(sucursal);
    setAbierto(false);
    try {
      localStorage.setItem("sucursal", sucursal.id);
    } catch {
      // si no se puede guardar, igual funciona
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex cursor-pointer items-center gap-2 rounded-full bg-[#f7e3f1] px-4 py-1.5 text-[15px] font-medium text-[#b5368f] transition hover:bg-[#f4cfe6] active:scale-95"
      >
        <Store size={16} />
        {actual.nombre}
        <ChevronDown
          size={16}
          className={`transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>

      {abierto && (
        <>
          {/* Fondo invisible: al tocarlo se cierra la lista */}
          <div className="fixed inset-0 z-20" onClick={() => setAbierto(false)} />

          <ul className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            {SUCURSALES.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => elegir(s)}
                  className={`flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-[16px] hover:bg-[#fbeef6] ${
                    s.id === actual.id ? "font-semibold text-[#b5368f]" : "text-gray-700"
                  }`}
                >
                  {s.nombre}
                  {s.id === actual.id && <Check size={18} />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}