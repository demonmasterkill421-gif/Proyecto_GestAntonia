import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  House,
  CalendarDays,
  UserCheck,
  Receipt,
  Users,
  BadgeDollarSign,
  Store,
  ChartColumn,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { INICIO_POR_ROL } from "../config/roles";

// Cada opción, su ícono y qué roles la ven
const MENU = [
  { ruta: "/agenda", etiqueta: "Agenda", icono: CalendarDays, roles: ["ADMIN", "RECEP"] },
  { ruta: "/asistencia", etiqueta: "Asistencia", icono: UserCheck, roles: ["ADMIN", "RECEP"] },
  { ruta: "/ventas/registrar", etiqueta: "Registrar venta", icono: Receipt, roles: ["RECEP"] },
  { ruta: "/especialistas", etiqueta: "Especialistas", icono: Users, roles: ["ADMIN"] },
  { ruta: "/comisiones", etiqueta: "Comisiones", icono: BadgeDollarSign, roles: ["ADMIN"] },
  { ruta: "/sucursales", etiqueta: "Sucursales", icono: Store, roles: ["ADMIN"] },
  { ruta: "/reportes", etiqueta: "Reportes", icono: ChartColumn, roles: ["ADMIN"] },
];

const ETIQUETA_ROL = { ADMIN: "Propietaria", RECEP: "Recepcionista" };

export function Sidebar({ children }) {
  const [abierto, setAbierto] = useState(false);
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const inicio = INICIO_POR_ROL[usuario?.rol] ?? "/login";

  const salir = () => {
    cerrarSesion();
    navigate("/login", { replace: true });
  };

  // El primer botón siempre es Inicio y lleva a la página principal del rol
  const opciones = [
    { ruta: inicio, etiqueta: "Inicio", icono: House },
    ...MENU.filter((m) => m.roles.includes(usuario?.rol)),
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Encabezado */}
      <header className="flex h-20 items-center gap-4 border-b border-gray-200 bg-white px-5">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="cursor-pointer rounded-lg p-2 text-[#1f1218] transition hover:bg-[#f7e3f1] hover:text-[#b5368f] active:scale-95"
          aria-label="Abrir menú"
        >
          <Menu size={30} />
        </button>

        {/* GestAntonia es un botón que lleva al inicio del rol */}
        <Link
          to={inicio}
          className="cursor-pointer text-[22px] font-bold text-[#1f1218]"
        >
          Gest<span className="text-[#b5368f]">Antonia</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {usuario?.local && (
            <span className="rounded-full bg-[#f7e3f1] px-4 py-1.5 text-[15px] font-medium text-[#b5368f]">
              {usuario.local.nombre}
            </span>
          )}
          <span className="rounded-md border border-gray-200 px-4 py-1.5 text-[15px] text-gray-700">
            {ETIQUETA_ROL[usuario?.rol]}
          </span>
        </div>
      </header>

      {/* Fondo oscuro: al tocarlo se cierra */}
      {abierto && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setAbierto(false)} />
      )}

      {/* Panel lateral */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col bg-[#fbeef6] p-4 shadow-lg transition-transform duration-200 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between px-2">
          <Link
            to={inicio}
            onClick={() => setAbierto(false)}
            className="cursor-pointer text-[22px] font-bold text-[#1f1218]"
          >
            Gest<span className="text-[#b5368f]">Antonia</span>
          </Link>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="cursor-pointer rounded-lg p-2 text-gray-600 transition hover:bg-[#f7e3f1] hover:text-[#b5368f] active:scale-95"
            aria-label="Cerrar menú"
          >
            <X size={26} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {opciones.map(({ ruta, etiqueta, icono: Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              onClick={() => setAbierto(false)}
              className={({ isActive }) =>
                `flex h-14 cursor-pointer items-center gap-3 rounded-lg px-4 text-[20px] transition ${
                  isActive
                    ? "bg-[#f4cfe6] font-semibold text-[#b5368f]"
                    : "text-gray-700 hover:bg-[#f7e3f1]"
                }`
              }
            >
              <Icono size={22} />
              {etiqueta}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={salir}
          className="mt-auto flex h-14 cursor-pointer items-center gap-3 rounded-lg px-4 text-[20px] text-gray-600 transition hover:bg-[#f7e3f1] hover:text-[#b5368f] active:scale-95"
        >
          <LogOut size={22} />
          Cerrar sesión
        </button>
      </aside>

      <main className="p-6 sm:p-8">{children}</main>
    </div>
  );
}