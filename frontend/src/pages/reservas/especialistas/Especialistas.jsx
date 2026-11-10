// 3.8c · Edson: especialistas por local (versión React de la pantalla Django 2.4). Solo la administradora.
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Pencil, Plus, Power } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { listarLocales } from "../../../api/locales.api";
import { activarEspecialista, desactivarEspecialista, listarEspecialistas } from "../../../api/reservas.api";
import { etiquetaCargo, mensajeGeneral } from "./utilidades";

export function Especialistas() {
  useTitulo("Especialistas");
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const local = params.get("local") ?? "";            // "" = todos los locales

  const [locales, setLocales] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  // El formulario devuelve aquí un mensaje de éxito (equivale a messages.success de Django)
  const [mensaje, setMensaje] = useState(location.state?.mensaje ?? "");
  const [ocupado, setOcupado] = useState(null);       // id de la especialista que se está activando/desactivando

  // Borra el mensaje del historial para que no vuelva a salir al recargar
  useEffect(() => {
    if (location.state?.mensaje) navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location, navigate]);

  useEffect(() => {
    listarLocales().then(({ data }) => setLocales(data)).catch(() => setLocales([]));
  }, []);

  // Se vuelve a pedir la lista cuando cambia el filtro o después de activar/desactivar (recarga + 1)
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vigente = true;                               // evita mostrar una respuesta vieja si se cambia de filtro rápido
    listarEspecialistas(local || undefined)
      .then(({ data }) => vigente && (setEspecialistas(data), setError("")))
      .catch((e) => vigente && setError(mensajeGeneral(e)))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [local, recarga]);

  const cambiarLocal = (valor) => {
    setCargando(true);
    setParams(valor ? { local: valor } : {});
  };

  // Desactivar o activar. La API no deja desactivar si tiene reservas futuras y lo explica en "detail".
  const cambiarEstado = async (e) => {
    setOcupado(e.id);
    setError("");
    setMensaje("");
    try {
      if (e.activa) {
        await desactivarEspecialista(e.id);
        setMensaje(`${e.nombre} ${e.apellido} quedó desactivada.`);
      } else {
        await activarEspecialista(e.id);
        setMensaje(`${e.nombre} ${e.apellido} quedó activa otra vez.`);
      }
      setRecarga((n) => n + 1);
    } catch (err) {
      setError(mensajeGeneral(err));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Sidebar>
      <p className="text-lg text-gray-600">Administración</p>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-bold text-[#1f1218]">Especialistas por local</h1>
        <Link
          to={`/especialistas/nueva${local ? `?local=${local}` : ""}`}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-[#b5368f] px-5 text-lg font-semibold text-white transition hover:bg-[#9c2d7b] active:scale-95"
        >
          <Plus size={20} /> Agregar especialista
        </Link>
      </div>

      <div className="mb-5 max-w-sm">
        <label htmlFor="filtro-local" className="mb-1 block font-semibold text-[#1f1218]">Local</label>
        <select
          id="filtro-local"
          value={local}
          onChange={(ev) => cambiarLocal(ev.target.value)}
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-lg focus:border-[#b5368f] focus:outline-none"
        >
          <option value="">Todos los locales</option>
          {locales.map((l) => (
            <option key={l.id} value={l.id}>{l.nombre}</option>
          ))}
        </select>
      </div>

      {mensaje && (
        <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">{mensaje}</p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>
      )}

      {cargando ? (
        <p className="text-gray-600">Cargando especialistas…</p>
      ) : especialistas.length === 0 ? (
        <p className="text-gray-600">No hay especialistas en este local.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-[#f7e3f1] text-[#1f1218]">
              <tr>
                {["Nombre", "Local", "Cargo", "Comisión", "Reservas futuras", "Estado", "Acciones"].map((t) => (
                  <th key={t} className="px-4 py-3 font-semibold">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {especialistas.map((e) => (
                <tr key={e.id} className={`border-t border-gray-200 ${e.activa ? "" : "bg-gray-50 text-gray-500"}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{e.nombre} {e.apellido}</span>
                    <span className="block text-sm text-gray-500">{e.email}</span>
                  </td>
                  <td className="px-4 py-3">{e.local_nombre ?? "—"}</td>
                  <td className="px-4 py-3">{etiquetaCargo(e.cargo)}</td>
                  <td className="px-4 py-3">{Number(e.porcentaje_comision)} %</td>
                  <td className="px-4 py-3">{e.reservas_futuras ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                      e.activa ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                    }`}>
                      {e.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        to={`/especialistas/${e.id}/editar`}
                        className="flex min-h-11 items-center gap-1 rounded-lg border border-gray-300 px-3 text-[#1f1218] transition hover:bg-[#f7e3f1]"
                      >
                        <Pencil size={16} /> Editar
                      </Link>
                      <button
                        type="button"
                        onClick={() => cambiarEstado(e)}
                        disabled={ocupado === e.id}
                        className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 transition hover:bg-[#f7e3f1] disabled:cursor-wait disabled:opacity-60"
                      >
                        <Power size={16} /> {e.activa ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sidebar>
  );
}
