import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { useAuth } from "../../../auth/AuthContext";
import { AvisoObservacion } from "../comun/AvisoObservacion";
import {
  crearReserva,
  listarEspecialistas,
  listarServicios,
  obtenerCliente,
} from "../../../api/reservas.api";

// La API puede mandar texto o lista: siempre lo dejamos como lista
function aLista(valor) {
  if (!valor) return [];
  return Array.isArray(valor) ? valor.map(String) : [String(valor)];
}

// "2026-11-10T12:00:00-03:00" -> "12:00"
function horaDe(valor) {
  return new Date(valor).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function leerLocalGuardado() {
  try {
    const id = localStorage.getItem("sucursal");
    return id ? Number(id) : undefined;
  } catch {
    return undefined;
  }
}

export function NuevaReserva() {
  useTitulo("Nueva reserva");
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const esAdmin = usuario?.rol === "ADMIN";

  // Datos que vienen en la URL (como request.GET)
  const clienteId = params.get("cliente");

  const [cliente, setCliente] = useState(null);
  const [especialistas, setEspecialistas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [localAdmin, setLocalAdmin] = useState(leerLocalGuardado);

  const [especialista, setEspecialista] = useState(params.get("especialista") ?? "");
  const [servicio, setServicio] = useState("");
  const [inicio, setInicio] = useState(params.get("inicio") ?? "");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [errores, setErrores] = useState({});
  const [generales, setGenerales] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);

  // Cada especialista solo realiza los servicios que se le asignaron en Especialistas.
  // Las que aún no tienen servicios asignados (creadas antes del cambio) pueden hacer cualquiera.
  const asignadosDe = (idEspecialista) =>
    especialistas.find((s) => String(s.id) === String(idEspecialista))?.servicios?.map((s) => s.servicio) ?? [];
  const idsAsignados = asignadosDe(especialista);
  const serviciosDisponibles = idsAsignados.length ? servicios.filter((s) => idsAsignados.includes(s.id)) : servicios;
  const elegirEspecialista = (valor) => {
    setEspecialista(valor);
    const ids = asignadosDe(valor);
    if (servicio && ids.length && !ids.includes(Number(servicio))) setServicio(""); // ese servicio no lo realiza
  };

  // La administradora cambia de local desde el selector: recargamos
  useEffect(() => {
    const alCambiar = (e) => {
      setLocalAdmin(e.detail.id);
      setEspecialista("");
      setSugerencias([]);
    };
    window.addEventListener("gestantonia:sucursal-cambiada", alCambiar);
    return () => window.removeEventListener("gestantonia:sucursal-cambiada", alCambiar);
  }, []);

  // Nombre del cliente
  useEffect(() => {
    if (!clienteId) return;
    obtenerCliente(clienteId)
      .then(({ data }) => setCliente(data))
      .catch(() => setCliente(null));
  }, [clienteId]);

  // Especialistas y servicios
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setErrorCarga("");
    const local = esAdmin ? localAdmin : undefined;
    Promise.all([listarEspecialistas(local), listarServicios()])
      .then(([resEsp, resServ]) => {
        if (!vigente) return;
        setEspecialistas(resEsp.data);
        setServicios(resServ.data);
      })
      .catch(() => {
        if (vigente) setErrorCarga("No se pudieron cargar las especialistas y los servicios.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [esAdmin, localAdmin]);

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    setGenerales([]);
    setSugerencias([]);
    try {
      const { data } = await crearReserva({
        cliente: clienteId ? Number(clienteId) : null,
        especialista: especialista ? Number(especialista) : null,
        servicio: servicio ? Number(servicio) : null,
        inicio,
      });
      // Al guardar, volvemos a la agenda en la fecha de la reserva
      navigate(`/agenda?fecha=${data.inicio.slice(0, 10)}`);
    } catch (error) {
      const data = error.response?.data;
      if (data && typeof data === "object") {
        setErrores(data);
        setGenerales([...aLista(data.detail), ...aLista(data.non_field_errors)]);
        setSugerencias(aLista(data.sugerencias));
      } else {
        setGenerales(["No se pudo conectar con el servidor. Intenta de nuevo."]);
      }
    } finally {
      setGuardando(false);
    }
  };

  const errorDe = (campo) =>
    aLista(errores[campo]).map((m) => (
      <div key={m} className="mt-1 text-sm text-red-700">
        {m}
      </div>
    ));

  return (
    <Sidebar>
      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6">
        <p className="mb-1 text-gray-600">
          <Link to="/agenda" className="text-[#b5368f] hover:underline">Agenda</Link> › Nueva reserva
        </p>
        <h1 className="mb-1 text-4xl font-bold text-[#1f1218]">
          Nueva reserva
        </h1>
        {usuario?.local && <p className="mb-4 text-lg text-gray-600">{usuario.local.nombre}</p>}

        {errorCarga && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700" role="alert">
            {errorCarga}
          </div>
        )}

        <form onSubmit={enviar} noValidate>
          {generales.length > 0 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700" role="alert">
              {generales.map((m) => (
                <div key={m}>{m}</div>
              ))}
            </div>
          )}

          {/* Cliente */}
          <div className="mb-4">
            <label className="mb-1 block font-semibold text-[#1f1218]">Cliente</label>
            {clienteId ? (
              <div className="flex min-h-11 items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-lg">
                {cliente ? `${cliente.nombre} (${cliente.telefono})` : "Cargando cliente..."}
              </div>
            ) : (
              <div>
                <Link className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[#b5368f] bg-white px-4 text-[#b5368f] transition hover:bg-[#f7e3f1]" to="/agenda/clientes">
                  Buscar cliente
                </Link>
              </div>
            )}
            {errorDe("cliente")}
            {cliente?.observacion && (
              <div className="mt-2">
                <AvisoObservacion texto={cliente.observacion} />
              </div>
            )}
          </div>

          {/* Especialista */}
          <div className="mb-4">
            <label htmlFor="especialista" className="mb-1 block font-semibold text-[#1f1218]">
              Especialista
            </label>
            <select
              id="especialista"
              className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-lg focus:border-[#b5368f] focus:outline-none"
              value={especialista}
              onChange={(e) => elegirEspecialista(e.target.value)}
              disabled={cargando}
            >
              <option value="">---------</option>
              {especialistas
                .filter((s) => s.activa)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} {s.apellido}
                  </option>
                ))}
            </select>
            {errorDe("especialista")}
          </div>

          {/* Servicio */}
          <div className="mb-4">
            <label htmlFor="servicio" className="mb-1 block font-semibold text-[#1f1218]">
              Servicio
            </label>
            <select
              id="servicio"
              className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-lg focus:border-[#b5368f] focus:outline-none"
              value={servicio}
              onChange={(e) => setServicio(e.target.value)}
              disabled={cargando}
            >
              <option value="">---------</option>
              {serviciosDisponibles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({s.duracion} min)
                </option>
              ))}
            </select>
            {especialista && !idsAsignados.length && !cargando && (
              <p className="mt-1 text-sm text-amber-700">
                Esta especialista aún no tiene servicios asignados: se muestran todos. Configúralos en Especialistas.
              </p>
            )}
            {errorDe("servicio")}
          </div>

          {/* Inicio */}
          <div className="mb-4">
            <label htmlFor="inicio" className="mb-1 block font-semibold text-[#1f1218]">
              Fecha y hora de inicio
            </label>
            <input
              id="inicio"
              type="datetime-local"
              className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-lg focus:border-[#b5368f] focus:outline-none"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
            {errorDe("inicio")}
          </div>

          {/* Mensaje del error de local (cuenta sin local) */}
          {aLista(errores.local).length > 0 && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700" role="alert">
              {aLista(errores.local).map((m) => (
                <div key={m}>{m}</div>
              ))}
            </div>
          )}

          {/* Sugerencias que manda la API cuando hay tope */}
          {sugerencias.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm text-gray-600">
                Horarios libres más cercanos de la especialista (toca uno para usarlo):
              </p>
              <div className="flex flex-wrap gap-2">
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[#b5368f] bg-white px-4 text-[#b5368f] transition hover:bg-[#f7e3f1]"
                    onClick={() => setInicio(s.slice(0, 16))}
                  >
                    {horaDe(s)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="min-h-11 cursor-pointer rounded-lg bg-[#b5368f] px-6 text-lg font-semibold text-white transition hover:bg-[#9c2d7b] active:scale-95 disabled:cursor-wait disabled:opacity-60" disabled={guardando || cargando}>
            {guardando ? "Guardando..." : "Confirmar reserva"}
          </button>
          <p className="mt-4">
            <Link to="/agenda" className="text-[#b5368f] hover:underline">← Volver a la agenda</Link>
          </p>
        </form>
      </div>
    </Sidebar>
  );
}