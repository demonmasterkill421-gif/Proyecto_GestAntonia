import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./reservas.css";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { useAuth } from "../../../auth/AuthContext";
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
      <div key={m} className="text-danger small mt-1">
        {m}
      </div>
    ));

  return (
    <Sidebar>
      <div className="tarjeta-gest p-4 mx-auto mx-md-0">
        <p className="small text-secondary mb-1">
          <Link to="/agenda">Agenda</Link> › Nueva reserva
        </p>
        <h1 className="h3 fw-bold mb-1" style={{ color: "#1f1218" }}>
          Nueva reserva
        </h1>
        {usuario?.local && <p className="text-secondary">{usuario.local.nombre}</p>}

        {errorCarga && (
          <div className="alert alert-danger" role="alert">
            {errorCarga}
          </div>
        )}

        <form onSubmit={enviar} noValidate>
          {generales.length > 0 && (
            <div className="alert alert-danger" role="alert">
              {generales.map((m) => (
                <div key={m}>{m}</div>
              ))}
            </div>
          )}

          {/* Cliente */}
          <div className="mb-3">
            <label className="form-label fw-semibold">Cliente</label>
            {clienteId ? (
              <div className="form-control bg-light d-flex align-items-center">
                {cliente ? `${cliente.nombre} (${cliente.telefono})` : "Cargando cliente..."}
              </div>
            ) : (
              <div>
                <Link className="btn btn-chip d-inline-flex align-items-center" to="/agenda/clientes">
                  Buscar cliente
                </Link>
              </div>
            )}
            {errorDe("cliente")}
          </div>

          {/* Especialista */}
          <div className="mb-3">
            <label htmlFor="especialista" className="form-label fw-semibold">
              Especialista
            </label>
            <select
              id="especialista"
              className="form-select"
              value={especialista}
              onChange={(e) => setEspecialista(e.target.value)}
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
          <div className="mb-3">
            <label htmlFor="servicio" className="form-label fw-semibold">
              Servicio
            </label>
            <select
              id="servicio"
              className="form-select"
              value={servicio}
              onChange={(e) => setServicio(e.target.value)}
              disabled={cargando}
            >
              <option value="">---------</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} ({s.duracion} min)
                </option>
              ))}
            </select>
            {errorDe("servicio")}
          </div>

          {/* Inicio */}
          <div className="mb-3">
            <label htmlFor="inicio" className="form-label fw-semibold">
              Fecha y hora de inicio
            </label>
            <input
              id="inicio"
              type="datetime-local"
              className="form-control"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
            {errorDe("inicio")}
          </div>

          {/* Mensaje del error de local (cuenta sin local) */}
          {aLista(errores.local).length > 0 && (
            <div className="alert alert-danger" role="alert">
              {aLista(errores.local).map((m) => (
                <div key={m}>{m}</div>
              ))}
            </div>
          )}

          {/* Sugerencias que manda la API cuando hay tope */}
          {sugerencias.length > 0 && (
            <div className="mb-3">
              <p className="small text-secondary mb-2">
                Horarios libres más cercanos de la especialista (toca uno para usarlo):
              </p>
              <div className="d-flex flex-wrap gap-2">
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn btn-chip"
                    onClick={() => setInicio(s.slice(0, 16))}
                  >
                    {horaDe(s)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-gest px-4" disabled={guardando || cargando}>
            {guardando ? "Guardando..." : "Confirmar reserva"}
          </button>
          <p className="mt-3 mb-0">
            <Link to="/agenda">← Volver a la agenda</Link>
          </p>
        </form>
      </div>
    </Sidebar>
  );
}