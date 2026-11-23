// Pestañas del personal del local (solo la administradora): Especialistas y Recepcionistas.
import { NavLink } from "react-router-dom";

const PESTANAS = [
  { ruta: "/especialistas", texto: "Especialistas" },
  { ruta: "/recepcionistas", texto: "Recepcionistas" },
];

export function PestanasPersonal() {
  return (
    <nav aria-label="Personal del local" className="mb-6 flex gap-2 border-b border-gray-200">
      {PESTANAS.map((p) => (
        <NavLink
          key={p.ruta}
          to={p.ruta}
          className={({ isActive }) =>
            `-mb-px flex min-h-11 items-center border-b-2 px-4 text-lg font-semibold transition ${
              isActive ? "border-[#b5368f] text-[#b5368f]" : "border-transparent text-gray-600 hover:text-[#b5368f]"
            }`
          }
        >
          {p.texto}
        </NavLink>
      ))}
    </nav>
  );
}
