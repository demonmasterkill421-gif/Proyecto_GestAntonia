import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { obtenerMe } from "../api/usuario.api";

const AuthContext = createContext(null);

// Minutos sin actividad antes de cerrar la sesión.
// 0.2 = 12 segundos
const MINUTOS_INACTIVIDAD = 30;
const LIMITE_MS = MINUTOS_INACTIVIDAD * 60 * 1000;

// Acciones del usuario que cuentan como "actividad"
const EVENTOS_ACTIVIDAD = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

const limpiarSesion = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh");
  localStorage.removeItem("ultimaActividad");
};

// ¿Pasó más tiempo del permitido desde la última actividad guardada?
const inactividadVencida = () => {
  const ultima = Number(localStorage.getItem("ultimaActividad"));
  return Boolean(ultima) && Date.now() - ultima > LIMITE_MS;
};

// Al abrir la app: ¿hay una sesión guardada que todavía se pueda recuperar?
const hayTokenUtil = () => {
  if (!localStorage.getItem("token")) return false;
  if (inactividadVencida()) {
    limpiarSesion();
    return false;
  }
  return true;
};

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Mientras se recupera la sesión al recargar, no se decide nada.
  const [cargando, setCargando] = useState(hayTokenUtil);

  // Recupera la sesión al recargar la página usando el token guardado
  useEffect(() => {
    if (!localStorage.getItem("token")) return;
    obtenerMe()
      .then(({ data }) => setUsuario(data))
      .catch(() => {
        limpiarSesion();
        setUsuario(null);
      })
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = ({ access, refresh, usuario }) => {
    localStorage.setItem("token", access);
    localStorage.setItem("refresh", refresh);
    localStorage.setItem("ultimaActividad", String(Date.now()));
    setUsuario(usuario);
  };

  const cerrarSesion = useCallback(() => {
    limpiarSesion();
    setUsuario(null);
  }, []);

  // Cierre automático por inactividad: solo corre mientras hay una sesión iniciada
  const haySesion = Boolean(usuario);
  useEffect(() => {
    if (!haySesion) return;

    let ultimoRegistro = 0;
    const registrarActividad = () => {
      const ahora = Date.now();
      // Se guarda como máximo una vez por segundo para no escribir sin parar
      if (ahora - ultimoRegistro > 1000) {
        ultimoRegistro = ahora;
        localStorage.setItem("ultimaActividad", String(ahora));
      }
    };

    registrarActividad();
    EVENTOS_ACTIVIDAD.forEach((evento) =>
      window.addEventListener(evento, registrarActividad, { passive: true })
    );

    const revisar = setInterval(() => {
      if (inactividadVencida()) {
        cerrarSesion();
        window.location.replace("/login");
      }
    }, 1000);

    return () => {
      EVENTOS_ACTIVIDAD.forEach((evento) =>
        window.removeEventListener(evento, registrarActividad)
      );
      clearInterval(revisar);
    };
  }, [haySesion, cerrarSesion]);

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);