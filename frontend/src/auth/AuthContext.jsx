import { createContext, useContext, useEffect, useState } from "react";
import { obtenerMe } from "../api/usuario.api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Mientras se recupera la sesión al recargar, no se decide nada.
  const [cargando, setCargando] = useState(Boolean(localStorage.getItem("token")));

  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    obtenerMe()
      .then(({ data }) => setUsuario(data))
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("refresh");
      })
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = ({ access, refresh, usuario }) => {
    localStorage.setItem("token", access);
    localStorage.setItem("refresh", refresh);
    setUsuario(usuario);
  };

  const cerrarSesion = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh");
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);