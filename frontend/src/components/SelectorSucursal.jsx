import { useState } from "react";
import { ChevronDown, Check, Store } from "lucide-react";
import { SUCURSALES, guardarSucursalId, useSucursalId } from "../hooks/useSucursal";

export function SelectorSucursal() {
  const [abierto, setAbierto] = useState(false);
  const id = useSucursalId();
  const actual = SUCURSALES.find((s) => s.id === id) ?? SUCURSALES[0];

  const elegir = (sucursal) => {
    guardarSucursalId(sucursal.id);
    setAbierto(false);
    // Informar al Dashboard de cambios hechos desde el selector compartido.
    window.dispatchEvent(new CustomEvent('gestantonia:sucursal-cambiada', {
      detail: { id: sucursal.id },
    }));
    try {
      localStorage.setItem("sucursal", sucursal.id);
    } catch {
      // si no se puede guardar, igual funciona
    }
  };

  return (
    <div className="relative">
      {/* En el celular es un botón redondo solo con el ícono; desde "sm" muestra también el nombre y la flecha */}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`Local: ${actual.nombre}. Cambiar local`}
        title={actual.nombre}
        className="flex h-10 w-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#f7e3f1] text-[15px] font-medium text-[#b5368f] transition hover:bg-[#f4cfe6] active:scale-95 sm:h-auto sm:w-auto sm:px-4 sm:py-1.5"
      >
        <Store size={20} className="shrink-0 sm:h-4 sm:w-4" />
        <span className="hidden max-w-[11rem] truncate sm:inline lg:max-w-none">{actual.nombre}</span>
        <ChevronDown
          size={16}
          className={`hidden shrink-0 transition-transform sm:block ${abierto ? "rotate-180" : ""}`}
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