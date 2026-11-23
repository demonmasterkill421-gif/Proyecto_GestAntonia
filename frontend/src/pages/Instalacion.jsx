import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import logo from "../assets/logo.png";
import { useTitulo } from "../hooks/useTitulo";
import { crearPrimeraAdministradora, erroresDe, estadoInstalacion } from "../api/gestionUsuarios.api";

// Primera vez (entrega oficial): la base no tiene usuarios y se crea la cuenta de la administradora.
// Apenas existe un usuario, esta pantalla deja de estar disponible y lleva al inicio de sesión.
const campo =
  "mt-1 h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-base text-gray-900 focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30";
const etiqueta = "block text-sm font-bold text-gray-900";

export function Instalacion() {
  useTitulo("Primera configuración");
  const navigate = useNavigate();
  const [estado, setEstado] = useState(null); // { pendiente, pide_codigo }
  const [datos, setDatos] = useState({ nombre: "", apellido: "", email: "", clave: "", repetir_clave: "", codigo: "" });
  const [verClave, setVerClave] = useState(false);
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    estadoInstalacion()
      .then(({ data }) => (data.pendiente ? setEstado(data) : navigate("/login", { replace: true })))
      .catch(() => setErrores({ general: "No hay conexión con el servidor." }));
  }, [navigate]);

  const cambiar = (nombre) => (e) => {
    setDatos({ ...datos, [nombre]: e.target.value });
    setErrores({ ...errores, [nombre]: undefined, general: undefined });
  };
  const error = (nombre) => errores[nombre] && <p className="mt-1 text-sm font-medium text-red-700">{errores[nombre]}</p>;

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (datos.clave !== datos.repetir_clave) {
      setErrores({ repetir_clave: "Las contraseñas no coinciden." });
      return;
    }
    setEnviando(true);
    try {
      await crearPrimeraAdministradora(datos);
      toast.success("Cuenta creada. Ahora inicia sesión con tu correo y contraseña.");
      navigate("/login", { replace: true });
    } catch (err) {
      setErrores(erroresDe(err, true));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="fondo-animado flex min-h-screen flex-col items-center px-4 pb-12 pt-12">
      <img src={logo} alt="Antonia, centro de depilación" className="h-auto w-40" />
      <h1 className="mt-6 text-3xl font-bold text-[#1f1218]">
        Gest<span className="text-[#b5368f]">Antonia</span> · primera configuración
      </h1>

      {!estado && !errores.general && <p className="mt-6 text-gray-600">Revisando…</p>}
      {!estado && errores.general && <p role="alert" className="mt-6 font-medium text-red-700">{errores.general}</p>}

      {estado && (
        <form onSubmit={enviar} className="mt-6 w-full max-w-[460px] rounded-xl bg-[#fbfbf9] p-6 shadow-[0_2px_12px_rgba(181,54,143,0.12)]">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <ShieldCheck className="text-[#b5368f]" /> Cuenta de la administradora
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            El sistema todavía no tiene usuarios. Crea la cuenta de la administradora; con ella después se crean
            los locales, las recepcionistas y las especialistas. Esta pantalla se cierra sola apenas exista la cuenta.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="i-nombre" className={etiqueta}>Nombre *</label>
              <input id="i-nombre" required autoFocus value={datos.nombre} onChange={cambiar("nombre")} className={campo} />
              {error("nombre")}
            </div>
            <div>
              <label htmlFor="i-apellido" className={etiqueta}>Apellido</label>
              <input id="i-apellido" value={datos.apellido} onChange={cambiar("apellido")} className={campo} />
              {error("apellido")}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="i-email" className={etiqueta}>Correo (con este inicia sesión) *</label>
              <input id="i-email" type="email" required autoComplete="username" value={datos.email} onChange={cambiar("email")} className={campo} />
              {error("email")}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="i-clave" className={etiqueta}>Contraseña *</label>
              <div className="relative">
                <input id="i-clave" type={verClave ? "text" : "password"} required autoComplete="new-password"
                  placeholder="Mínimo 10 caracteres" value={datos.clave} onChange={cambiar("clave")} className={`${campo} pr-11`} />
                <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 cursor-pointer text-[#b5368f]">
                  {verClave ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {error("clave")}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="i-repetir" className={etiqueta}>Repetir contraseña *</label>
              <input id="i-repetir" type={verClave ? "text" : "password"} required autoComplete="new-password"
                value={datos.repetir_clave} onChange={cambiar("repetir_clave")} className={campo} />
              {error("repetir_clave")}
            </div>
            {estado.pide_codigo && (
              <div className="sm:col-span-2">
                <label htmlFor="i-codigo" className={etiqueta}>Código de instalación *</label>
                <input id="i-codigo" required autoComplete="off" value={datos.codigo} onChange={cambiar("codigo")} className={campo} />
                <p className="mt-1 text-xs text-gray-500">
                  Lo muestra el script de despliegue al terminar (también está en el archivo .env del servidor).
                </p>
                {error("codigo")}
              </div>
            )}
          </div>

          {errores.general && <p role="alert" className="mt-4 text-base font-medium text-red-700">{errores.general}</p>}
          <button type="submit" disabled={enviando}
            className="mt-6 h-12 w-full cursor-pointer rounded-lg bg-[#b5368f] text-lg font-semibold text-white hover:bg-[#9c2d7b] disabled:opacity-50">
            {enviando ? "Creando..." : "Crear cuenta de administradora"}
          </button>
        </form>
      )}
    </main>
  );
}
