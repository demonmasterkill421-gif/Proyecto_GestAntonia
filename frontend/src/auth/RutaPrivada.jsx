import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { INICIO_POR_ROL } from "../config/roles";

export function RutaPrivada({ roles }) {
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
    return <Navigate to={INICIO_POR_ROL[usuario.rol] ?? "/login"} replace />;
  }

  return <Outlet />;
}