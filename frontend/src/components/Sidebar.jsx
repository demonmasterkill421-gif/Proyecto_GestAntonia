import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  House,
  CalendarDays,
  UserCheck,
  Receipt,
  ShoppingBag,
  Users,
  BadgeDollarSign,
  Store,
  ChartColumn,
  ChevronDown,
  CircleUser,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { INICIO_POR_ROL } from "../config/roles";
import { SelectorSucursal } from "./SelectorSucursal";

// Cada opción, su ícono y qué roles la ven
const MENU = [
  { ruta: "/agenda", etiqueta: "Agenda", icono: CalendarDays, roles: ["ADMIN", "RECEP"] },
  { ruta: "/asistencia", etiqueta: "Asistencia", icono: UserCheck, roles: ["ADMIN", "RECEP"] },
  { ruta: "/recepcionista/registrar-venta", etiqueta: "Registrar Venta", icono: Receipt, roles: ["RECEP"] },
  { ruta: "/recepcionista/ventas", etiqueta: "Ventas", icono: ShoppingBag, roles: ["RECEP"] },
  { ruta: "/especialistas", etiqueta: "Especialistas", icono: Users, roles: ["ADMIN"] },
  { ruta: "/comisiones", etiqueta: "Comisiones", icono: BadgeDollarSign, roles: ["ADMIN"] },
  { ruta: "/admin/locales", etiqueta: "Locales", icono: Store, roles: ["ADMIN"] },
  { ruta: "/admin/reportes", etiqueta: "Reportes", icono: ChartColumn, roles: ["ADMIN"] },
];

const ETIQUETA_ROL = { ADMIN: "Propietaria", RECEP: "Recepcionista" };

export function Sidebar({ children }) {
  const [abierto, setAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const menuRef = useRef(null);
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const inicio = INICIO_POR_ROL[usuario?.rol] ?? "/login";

  const salir = () => {
    cerrarSesion();
    navigate("/login", { replace: true });
  };

  // Cierra la lista al tocar fuera de ella o al presionar Escape
  useEffect(() => {
    if (!menuUsuario) return;
    const fuera = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuUsuario(false);
    };
    const tecla = (e) => {
      if (e.key === "Escape") setMenuUsuario(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menuUsuario]);

  // El primer botón siempre es Inicio y lleva a la página principal del rol
  const opciones = [
    { ruta: inicio, etiqueta: "Inicio", icono: House },
    ...MENU.filter((m) => m.roles.includes(usuario?.rol)),
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#faf9f7]">
      {/* Encabezado */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-gray-200 bg-white px-3 sm:h-20 sm:gap-4 sm:px-5">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="shrink-0 cursor-pointer rounded-lg p-2 text-[#1f1218] transition hover:bg-[#f7e3f1] hover:text-[#b5368f] active:scale-95"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6 sm:h-[30px] sm:w-[30px]" />
        </button>

        {/* GestAntonia es un botón que lleva al inicio del rol */}
        <Link
          to={inicio}
          className="shrink-0 cursor-pointer text-lg font-bold text-[#1f1218] sm:text-[22px]"
        >
          Gest<span className="text-[#b5368f]">Antonia</span>
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {/* La propietaria elige sucursal; la recepcionista ve solo la suya (en el teléfono va dentro de la lista) */}
          {usuario?.rol === "ADMIN" ? (
            <div className="min-w-0">
              <SelectorSucursal />
            </div>
          ) : (
            usuario?.local && (
              <span className="hidden max-w-[14rem] truncate rounded-full bg-[#f7e3f1] px-4 py-1.5 text-[15px] font-medium text-[#b5368f] sm:inline-block">
                {usuario.local.nombre}
              </span>
            )
          )}

          {/* Rol: al tocarlo se despliega la lista con "Cerrar sesión" */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuUsuario(!menuUsuario)}
              aria-haspopup="menu"
              aria-expanded={menuUsuario}
              aria-label={ETIQUETA_ROL[usuario?.rol] ?? "Usuario"}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-[15px] transition active:scale-95 sm:px-4 ${
                usuario?.rol === "ADMIN"
                  ? "bg-gradient-to-r from-[#d61f9a] to-[#a8238f] font-semibold text-white shadow-md shadow-[#d61f9a]/30 hover:brightness-110"
                  : "border border-gray-200 text-gray-700 hover:border-[#b5368f] hover:bg-[#f7e3f1] hover:text-[#b5368f]"
              }`}
            >
              <CircleUser size={20} className="sm:hidden" />
              <span className="hidden sm:inline">{ETIQUETA_ROL[usuario?.rol]}</span>
              <ChevronDown
                size={18}
                className={`transition-transform duration-200 ${menuUsuario ? "rotate-180" : ""}`}
              />
            </button>

            {menuUsuario && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-[#e6b8d4] bg-white py-1 shadow-lg shadow-[#b5368f]/15"
              >
                {/* Datos del usuario: en el teléfono se ven aquí porque no caben en el encabezado */}
                <div className="border-b border-gray-100 px-4 py-3 sm:hidden">
                  <p className="text-base font-semibold text-[#1f1218]">
                    {ETIQUETA_ROL[usuario?.rol]}
                  </p>
                  {usuario?.local && (
                    <p className="text-sm text-[#b5368f]">{usuario.local.nombre}</p>
                  )}
                </div>

                <button
                  type="button"
                  role="menuitem"
                  onClick={salir}
                  className="flex h-12 w-full cursor-pointer items-center gap-3 px-4 text-left text-[16px] text-gray-700 transition hover:bg-[#f7e3f1] hover:text-[#b5368f]"
                >
                  <LogOut size={20} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
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

      <main className="p-4 sm:p-8">{children}</main>
    </div>
  );
}