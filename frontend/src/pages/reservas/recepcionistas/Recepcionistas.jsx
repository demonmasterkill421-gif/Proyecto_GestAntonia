// Recepcionistas por local (solo la administradora · Edson). Antes solo se creaban en /admin/ de Django.
// No se borran: se desactivan, porque sus ventas quedan registradas a su nombre. Desactivada no puede entrar.
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Pencil, Plus, Power } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { listarLocales } from "../../../api/locales.api";
import { activarRecepcionista, desactivarRecepcionista, listarRecepcionistas } from "../../../api/reservas.api";
import { mensajeGeneral } from "../especialistas/utilidades";
import { PestanasPersonal } from "../comun/PestanasPersonal";

export function Recepcionistas() {
  useTitulo("Recepcionistas");
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const local = params.get("local") ?? ""; // "" = todos los locales

  const [locales, setLocales] = useState([]);
  const [recepcionistas, setRecepcionistas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState(location.state?.mensaje ?? "");
  const [ocupado, setOcupado] = useState(null);
  const [recarga, setRecarga] = useState(0);

  // Borra el mensaje del historial para que no vuelva a salir al recargar
  useEffect(() => {
    if (location.state?.mensaje) navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location, navigate]);

  useEffect(() => {
    listarLocales().then(({ data }) => setLocales(data)).catch(() => setLocales([]));
  }, []);

  useEffect(() => {
    let vigente = true;
    listarRecepcionistas(local || undefined)
      .then(({ data }) => vigente && (setRecepcionistas(data), setError("")))
      .catch((e) => vigente && setError(mensajeGeneral(e)))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [local, recarga]);

  const cambiarLocal = (valor) => {
    setCargando(true);
    setParams(valor ? { local: valor } : {});
  };

  const cambiarEstado = async (r) => {
    setOcupado(r.id);
    setError("");
    setMensaje("");
    try {
      if (r.activa) {
        await desactivarRecepcionista(r.id);
        setMensaje(`${r.nombre} ${r.apellido} quedó desactivada: ya no puede iniciar sesión.`);
      } else {
        await activarRecepcionista(r.id);
        setMensaje(`${r.nombre} ${r.apellido} quedó activa otra vez.`);
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
      <PestanasPersonal />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-bold text-[#1f1218]">Recepcionistas por local</h1>
        <Link
          to={`/recepcionistas/nueva${local ? `?local=${local}` : ""}`}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-[#b5368f] px-5 text-lg font-semibold text-white transition hover:bg-[#9c2d7b] active:scale-95"
        >
          <Plus size={20} /> Agregar recepcionista
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
        <p className="text-gray-600">Cargando recepcionistas…</p>
      ) : recepcionistas.length === 0 ? (
        <p className="text-gray-600">No hay recepcionistas en este local.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[620px] text-left">
            <thead className="bg-[#f7e3f1] text-[#1f1218]">
              <tr>
                {["Nombre", "Local", "Estado", "Acciones"].map((t) => (
                  <th key={t} className="px-4 py-3 font-semibold">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recepcionistas.map((r) => (
                <tr key={r.id} className={`border-t border-gray-200 ${r.activa ? "" : "bg-gray-50 text-gray-500"}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{`${r.nombre} ${r.apellido}`.trim() || "(sin nombre)"}</span>
                    <span className="block text-sm text-gray-500">{r.email}</span>
                  </td>
                  <td className="px-4 py-3">{r.local_nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                      r.activa ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                    }`}>
                      {r.activa ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        to={`/recepcionistas/${r.id}/editar`}
                        className="flex min-h-11 items-center gap-1 rounded-lg border border-gray-300 px-3 text-[#1f1218] transition hover:bg-[#f7e3f1]"
                      >
                        <Pencil size={16} /> Editar
                      </Link>
                      <button
                        type="button"
                        onClick={() => cambiarEstado(r)}
                        disabled={ocupado === r.id}
                        className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 transition hover:bg-[#f7e3f1] disabled:cursor-wait disabled:opacity-60"
                      >
                        <Power size={16} /> {r.activa ? "Desactivar" : "Activar"}
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
