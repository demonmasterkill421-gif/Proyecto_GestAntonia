import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// En estas rutas un 401 no significa "token vencido" (por ejemplo, un login con la clave mal)
const RUTAS_SIN_RENOVAR = ["/api/login/", "/api/token/refresh/"];

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Borra la sesión guardada y vuelve al login (igual que el cierre por inactividad)
const cerrarSesionYVolverAlLogin = () => {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("refresh");
  sessionStorage.removeItem("ultimaActividad");
  window.location.replace("/login");
};

// Si varias peticiones vencen a la vez, todas esperan la misma renovación
let renovando = null;

const renovarToken = () => {
  if (!renovando) {
    const refresh = sessionStorage.getItem("refresh");
    // Se usa axios directo (y no "api") para que esta llamada no pase por los interceptores
    renovando = axios
      .post("/api/token/refresh/", { refresh }, { baseURL: api.defaults.baseURL })
      .then(({ data }) => {
        sessionStorage.setItem("token", data.access);
        if (data.refresh) sessionStorage.setItem("refresh", data.refresh);
        return data.access;
      })
      .finally(() => {
        renovando = null;
      });
  }
  return renovando;
};

// Cuando el token de acceso vence, el servidor responde 401: se pide uno nuevo con el refresh
// y se repite la petición una sola vez. Si el refresh tampoco sirve, se cierra la sesión.
api.interceptors.response.use(
  (respuesta) => respuesta,
  async (error) => {
    const original = error.config;
    const esRutaLibre = RUTAS_SIN_RENOVAR.some((ruta) => original?.url?.includes(ruta));

    if (error.response?.status !== 401 || !original || original._reintentado || esRutaLibre) {
      return Promise.reject(error);
    }

    // Hay un token vencido pero no hay refresh para renovarlo: la sesión ya no sirve
    if (!sessionStorage.getItem("refresh")) {
      if (sessionStorage.getItem("token")) cerrarSesionYVolverAlLogin();
      return Promise.reject(error);
    }

    original._reintentado = true;
    try {
      const nuevoToken = await renovarToken();
      original.headers.Authorization = `Bearer ${nuevoToken}`;
      return api(original);
    } catch (errorRenovar) {
      // Solo se cierra la sesión si el servidor rechazó el refresh; si no hay conexión, se conserva
      if (errorRenovar.response) cerrarSesionYVolverAlLogin();
      return Promise.reject(error);
    }
  },
);

export default api;