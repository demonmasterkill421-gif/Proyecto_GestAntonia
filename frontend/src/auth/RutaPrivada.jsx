import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { INICIO_POR_ROL } from "../config/roles";

export function RutaPrivada({ roles }) {
  const { usuario, cargando } = useAuth();

  // Mientras se revisa si hay sesión guardada, no se muestra nada
  if (cargando) return null;

  // Sin sesión: al login
  if (!usuario) return <Navigate to="/login" replace />;

  // Con sesión pero rol no permitido: a su propio inicio
  if (roles && !roles.includes(usuario.rol)) {
    return <Navigate to={INICIO_POR_ROL[usuario.rol] ?? "/login"} replace />;
  }

  return <Outlet />;
}