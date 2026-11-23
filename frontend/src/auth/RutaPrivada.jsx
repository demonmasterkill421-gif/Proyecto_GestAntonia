import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogIn, UserRound } from "lucide-react";
import { useAuth } from "./AuthContext";
import { INICIO_POR_ROL } from "../config/roles";

const NOMBRE_ROL = { ADMIN: "administradora", RECEP: "recepcionista", TRAB: "especialista" };

// Se muestra cuando alguien abre el enlace del QR con otra cuenta ya iniciada en el navegador
// (por ejemplo, la administradora). En vez de mandarla a su menú, le ofrece cambiar de cuenta
// y, después de iniciar sesión, la devuelve al mismo enlace del QR.
function CambiarCuenta({ usuario, desde }) {
  const navigate = useNavigate();
  const rol = NOMBRE_ROL[usuario.rol] ?? "otro rol";

  return (
    <main className="fondo-animado flex min-h-screen flex-col items-center justify-center bg-[#fbfbf9] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white px-8 py-10 text-center shadow-[0_4px_24px_rgba(181,54,143,0.12)]">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-[#1f1218]">
          Gest<span className="text-[#b5368f]">Antonia</span>
        </h1>
        <div className="mb-4 inline-flex rounded-full bg-[#fbf3f8] p-4">
          <UserRound className="h-12 w-12 text-[#b5368f]" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Este enlace es para registrar asistencia</h2>
        <p className="mt-3 text-base text-gray-600">
          Lo usan las especialistas y las recepcionistas. En este navegador hay una sesión abierta
          como <strong>{rol}</strong>.
        </p>
        <button
          type="button"
          onClick={() => navigate("/login", { state: { from: desde }, replace: true })}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#b5368f] text-sm font-semibold text-white transition hover:bg-[#9d2d7c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b5368f]/50"
        >
          <LogIn size={18} />
          Cerrar sesión e ingresar con otra cuenta
        </button>
        <button
          type="button"
          onClick={() => navigate(INICIO_POR_ROL[usuario.rol] ?? "/login", { replace: true })}
          className="mt-3 h-12 w-full rounded-lg border border-[#ecd3e6] text-sm font-semibold text-[#b5368f] transition hover:bg-[#f7e3f1]"
        >
          Volver a mi inicio
        </button>
      </div>
    </main>
  );
}

// pedirCambioDeCuenta: si la persona tiene sesión pero con un rol no permitido, en vez de
// mandarla a su inicio se le ofrece cambiar de cuenta (lo usa el enlace del QR de asistencia).
export function RutaPrivada({ roles, pedirCambioDeCuenta = false }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation(); // 1. Hook para capturar la URL exacta (incluyendo el ?qr=TOKEN)

  // Mientras se revisa si hay sesión guardada, no se muestra nada
  if (cargando) return null;

  // Sin sesión: al login (GUARDANDO LA RUTA EN LA MEMORIA 'state')
  if (!usuario) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Con sesión pero rol no permitido: a su propio inicio
  if (roles && !roles.includes(usuario.rol)) {
    if (pedirCambioDeCuenta) return <CambiarCuenta usuario={usuario} desde={location} />;
    return <Navigate to={INICIO_POR_ROL[usuario.rol] ?? "/login"} replace />;
  }

  return <Outlet />;
}