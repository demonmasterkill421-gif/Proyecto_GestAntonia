import { useEffect, useRef, useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  House,
  CalendarDays,
  UserCheck,
  ShoppingBag,
  Users,
  BadgeDollarSign,
  Store,
  ChartColumn,
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
  { ruta: "/admin/asistencia", etiqueta: "Asistencia", icono: UserCheck, roles: ["ADMIN"] },
  { ruta: "/recepcionista/asistencia", etiqueta: "Asistencia", icono: UserCheck, roles: ["RECEP"] },
  { ruta: "/recepcionista/ventas", etiqueta: "Ventas", icono: ShoppingBag, roles: ["RECEP"] },
  { ruta: "/especialistas", etiqueta: "Especialistas", icono: Users, roles: ["ADMIN"] },
  { ruta: "/admin/comisiones", etiqueta: "Comisiones", icono: BadgeDollarSign, roles: ["ADMIN"] },
  { ruta: "/admin/locales", etiqueta: "Locales", icono: Store, roles: ["ADMIN"] },
  { ruta: "/admin/ventas", etiqueta: "Ventas", icono: ShoppingBag, roles: ["ADMIN"] },
  { ruta: "/admin/reportes", etiqueta: "Reportes", icono: ChartColumn, roles: ["ADMIN"] },
];

const ETIQUETA_ROL = { ADMIN: "Propietaria", RECEP: "Recepcionista", TRAB: "Especialista" };

// Cuánto dura el cuadro "Cerrando sesión..." (en milisegundos: 1000 = 1 segundo)
const DURACION_SALIDA = 1000;

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// Etiqueta oscura que aparece al pasar el mouse por un ícono de la franja
const ETIQUETA_FLOTANTE =
  "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#1f1218] px-3 py-1.5 text-sm font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100";

// fondo: clase de Tailwind con el color de fondo de la página (por defecto, el gris claro de siempre)
export function Sidebar({ children, fondo = "bg-[#faf9f7]" }) {
  const [abierto, setAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const menuRef = useRef(null);
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const inicio = INICIO_POR_ROL[usuario?.rol] ?? "/login";

  // Nombre y apellido de la persona que inició sesión
  const nombreCompleto = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(" ") || "Usuario";

  // Muestra el cuadro con el círculo girando, espera y recién ahí cierra la sesión
  const salir = async () => {
    if (cerrando) return;
    setMenuUsuario(false);
    setAbierto(false);
    setCerrando(true);
    await esperar(DURACION_SALIDA);
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
    <div className={`min-h-screen overflow-x-clip ${fondo}`}>
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
          className="font-logo shrink-0 cursor-pointer text-2xl font-bold leading-none text-[#1f1218] sm:text-[28px]"
        >
          Gest<span className="text-[#b5368f]">Antonia</span>
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          {/* La propietaria elige sucursal; la recepcionista ve solo la suya (en el teléfono va dentro de la lista) */}
          {usuario?.rol === "ADMIN" ? (
            <div className="min-w-0 max-w-[9.5rem] sm:max-w-none [&_button]:h-10 [&_button]:max-w-full [&_button]:whitespace-nowrap [&_span]:min-w-0 [&_span]:truncate [&_span]:whitespace-nowrap">
              <SelectorSucursal />
            </div>
          ) : (
            usuario?.local && (
              <span className="hidden max-w-[14rem] truncate rounded-full bg-[#f7e3f1] px-4 py-1.5 text-[15px] font-medium text-[#b5368f] sm:inline-block">
                {usuario.local.nombre}
              </span>
            )
          )}

          {/* Ícono de usuario: al tocarlo se despliega el menú con el nombre y "Cerrar sesión" */}
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuUsuario(!menuUsuario)}
              aria-haspopup="menu"
              aria-expanded={menuUsuario}
              aria-label={`Menú de ${nombreCompleto}`}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition active:scale-95 sm:h-11 sm:w-11 ${
                menuUsuario
                  ? "bg-[#b5368f] text-white shadow-md shadow-[#b5368f]/30"
                  : "bg-[#f7e3f1] text-[#b5368f] hover:bg-[#f4cfe6]"
              }`}
            >
              <CircleUser className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>

            {menuUsuario && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[#e6b8d4] bg-white py-1 shadow-lg shadow-[#b5368f]/15"
              >
                {/* Datos de la persona */}
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f7e3f1] text-[#b5368f]">
                    <CircleUser size={26} />
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-base font-semibold leading-tight text-[#1f1218]">
                      {nombreCompleto}
                    </p>
                    <p className="text-sm text-gray-500">{ETIQUETA_ROL[usuario?.rol]}</p>
                    {/* En el teléfono la sucursal no cabe en el encabezado, así que se ve aquí */}
                    {usuario?.local && (
                      <p className="text-sm text-[#b5368f] sm:hidden">{usuario.local.nombre}</p>
                    )}
                  </div>
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

      {/* Franja de íconos: se ve cuando el menú está cerrado (solo pantallas medianas y grandes) */}
      <nav
        aria-label="Atajos del menú"
        className="fixed bottom-0 left-0 top-16 z-20 hidden w-16 flex-col items-center gap-1 border-r border-[#e6b8d4] bg-[#fbeef6] py-3 md:flex sm:top-20"
      >
        {opciones.map(({ ruta, etiqueta, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            aria-label={etiqueta}
            className={({ isActive }) =>
              `group relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl transition active:scale-95 ${
                isActive
                  ? "bg-[#f4cfe6] text-[#b5368f]"
                  : "text-gray-600 hover:bg-[#f7e3f1] hover:text-[#b5368f]"
              }`
            }
          >
            <Icono size={24} />
            <span className={ETIQUETA_FLOTANTE}>{etiqueta}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={salir}
          aria-label="Cerrar sesión"
          className="group relative mt-auto flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl text-gray-600 transition hover:bg-[#f7e3f1] hover:text-[#b5368f] active:scale-95"
        >
          <LogOut size={24} />
          <span className={ETIQUETA_FLOTANTE}>Cerrar sesión</span>
        </button>
      </nav>

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
            className="font-logo cursor-pointer text-[28px] font-bold leading-none text-[#1f1218]"
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

      {/* En pantallas medianas y grandes el contenido se corre para no quedar bajo la franja de íconos */}
      <main className="p-4 sm:p-8 md:pl-24">{children}</main>

      {/* Cuadro "Cerrando sesión...": cubre toda la pantalla mientras gira el círculo */}
      {cerrando && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1f1218]/50 p-4 backdrop-blur-sm"
        >
          <div className="animate-aparecer flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-[#e6b8d4] bg-white px-8 py-8 text-center shadow-xl shadow-[#b5368f]/20">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-[#f4cfe6] border-t-[#b5368f]" />
            <p className="text-xl font-semibold text-[#1f1218]">Cerrando sesión…</p>
          </div>
        </div>
      )}
    </div>
  );
}