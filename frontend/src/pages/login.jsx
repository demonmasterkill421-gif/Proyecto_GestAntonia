import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import logo from "../assets/logo.png";

import { iniciarSesion } from "../api/usuario.api";
import { useAuth } from "../auth/AuthContext";
import { INICIO_POR_ROL } from "../config/roles";
import { useTitulo } from "../hooks/useTitulo";

// Cuánto dura la pantalla de bienvenida después de iniciar sesión (en milisegundos)
const DURACION_ENTRADA = 1400;

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// Pantalla que cubre todo mientras se "prepara" la sesión
function PantallaEntrada() {
  const [visible, setVisible] = useState(false);

  // Se monta invisible y un instante después se activa: así la transición se nota
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fbeef6] px-6 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <img src={logo} alt="" className="h-28 w-auto animate-pulse" />

      <p className="mt-8 text-2xl font-bold tracking-tight text-[#1f1218]">
        Gest<span className="text-[#b5368f]">Antonia</span>
      </p>
      <p className="mt-1 text-base font-medium text-[#9c2d7b]">Preparando tu espacio…</p>

      {/* Barra que se va llenando */}
      <div className="mt-6 h-2 w-56 overflow-hidden rounded-full bg-[#e6b8d4]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#d61f9a] to-[#a8238f] transition-[width] ease-out"
          style={{
            width: visible ? "100%" : "0%",
            transitionDuration: `${DURACION_ENTRADA}ms`,
          }}
        />
      </div>
    </div>
  );
}

export function Login() {
  useTitulo("Iniciar sesión");
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entrando, setEntrando] = useState(false); // pantalla de bienvenida
  const [error, setError] = useState("");

  // Llegar al login siempre cierra cualquier sesión abierta (token y usuario).
  // Así, si alguien apretaba "atrás" después de que algo lo mandó aquí, no puede
  // volver a entrar con la cuenta anterior. Se espera a que termine de revisarse
  // la sesión guardada para que no se reabra por detrás.
  // Solo depende de auth.cargando a propósito: si dependiera de más cosas, se
  // cerraría también la sesión recién iniciada.
  useEffect(() => {
    if (!auth.cargando) auth.cerrarSesion();
  }, [auth.cargando]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Ingresa tu correo y tu contraseña.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await iniciarSesion(email, password);

      auth.iniciarSesion(data);

      // Animación de bienvenida antes de entrar
      setEntrando(true);
      await esperar(DURACION_ENTRADA);

      navigate(INICIO_POR_ROL[data.usuario.rol] ?? "/login", { replace: true });
    } catch (err) {
      console.error(err);
      setLoading(false);
      setEntrando(false);
      if (err.response?.status === 401) {
        setError("Correo o contraseña incorrectos.");
      } else {
        setError("No pudimos conectar con el servidor. Intenta de nuevo.");
      }
    }
  };

  return (
    <main className="fondo-animado min-h-screen flex flex-col items-center px-4 pt-24 pb-12">
      {entrando && <PantallaEntrada />}

      {/* Logo (colócalo en public/logo-antonia.png) */}
        <img src={logo} alt="Antonia, centro de depilación" className="w-52 h-auto" />

      {/* Título */}
      <h1 className="mt-12 text-4xl font-bold tracking-tight text-[#1f1218]">
        Gest<span className="text-[#b5368f]">Antonia</span>
      </h1>
      <p className="mt-1 text-base text-gray-600">
        Gestión de ventas, inventario y asistencia
      </p>

      {/* Tarjeta */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-8 w-full max-w-[420px] rounded-xl bg-[#fbfbf9] px-6 pt-6 pb-16 shadow-[0_2px_12px_rgba(181,54,143,0.12)]"
      >
        <h2 className="text-xl font-normal text-gray-900">Iniciar sesión</h2>

        <div className="mt-5">
          <label htmlFor="email" className="block text-sm font-bold text-gray-900">
            Correo Electrónico
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ej.: admin@gestantonia.cl"
            className="mt-2 h-11 w-full rounded-md border border-gray-200 bg-[#fbfbf9] px-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30"
          />
        </div>

        <div className="mt-5">
          <label htmlFor="password" className="block text-sm font-bold text-gray-900">
            Contraseña
          </label>
          <div className="mt-2 flex">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 min-w-0 flex-1 rounded-l-md border border-r-0 border-gray-200 bg-[#fbfbf9] px-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((f) => !f)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="flex h-11 w-11 items-center justify-center rounded-r-md border border-slate-400 text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b5368f]/40"
            >
              {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>
        </div>

        {/* Espacio reservado para mensajes de error */}
        <div className="min-h-[88px] pt-4" aria-live="polite">
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#b5368f] text-sm font-semibold text-white transition-colors hover:bg-[#9d2d7c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b5368f]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LogIn size={16} />
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}