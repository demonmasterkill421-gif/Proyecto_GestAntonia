import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import {
  cambiarEstado,
  cancelarReserva,
  obtenerHistorial,
  obtenerReserva,
  reprogramarReserva,
} from "../../../api/reservas.api";
import { ESTADOS, estadoDe } from "../comun/estados";
import { BotonWhatsApp } from "../comun/BotonWhatsApp";
import { MENSAJES } from "../comun/whatsapp";

// 3.8b · Detalle de una reserva, con reprogramar y cancelar.
// Las reglas (cero topes, motivo obligatorio, no tocar canceladas o atendidas)
// las valida la API con Reserva.reprogramar() y Reserva.cancelar(); aquí solo se muestran.

// La API puede mandar texto o lista: siempre lo dejamos como lista
function aLista(valor) {
  if (!valor) return [];
  return Array.isArray(valor) ? valor.map(String) : [String(valor)];
}

// La API entrega la hora de Chile con su desfase: "2026-11-20T11:00:00-03:00".
// Se toma el texto tal cual para no depender de la zona horaria del navegador.
const fechaDe = (valor) => valor.slice(0, 10); // "2026-11-20"
const horaDe = (valor) => valor.slice(11, 16); // "11:00"
const paraInput = (valor) => valor.slice(0, 16); // "2026-11-20T11:00" (input datetime-local)

function fechaLarga(valor) {
  const [a, m, d] = fechaDe(valor).split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }); // "lunes, 16 de noviembre de 2026"
}

const conMayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);


// Clases compartidas (mismo estilo que Nueva reserva y la agenda)
const CAMPO =
  "min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 text-lg focus:border-[#b5368f] focus:outline-none";
const BOTON =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg bg-[#b5368f] px-6 text-lg font-semibold text-white transition hover:bg-[#9c2d7b] active:scale-95 disabled:cursor-wait disabled:opacity-60";
const BOTON_PELIGRO =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg bg-red-700 px-6 text-lg font-semibold text-white transition hover:bg-red-800 active:scale-95 disabled:cursor-wait disabled:opacity-60";
const BOTON_BORDE =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-[#b5368f] bg-white px-4 text-[#b5368f] transition hover:bg-[#f7e3f1]";
const ALERTA_ERROR = "mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700";
const ALERTA_OK = "mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800";
const ENLACE = "text-[#b5368f] hover:underline";

function Dato({ etiqueta, children }) {
  return (
    <div className="border-b border-gray-100 py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="font-semibold text-[#1f1218]">{etiqueta}</dt>
      <dd className="text-lg text-gray-800 sm:col-span-2">{children}</dd>
    </div>
  );
}

export function DetalleReserva() {
  useTitulo("Detalle de reserva");
  const { id } = useParams();

  const [reserva, setReserva] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");
  const [aviso, setAviso] = useState("");

  // Reprogramar
  const [modo, setModo] = useState(""); // "" | "reprogramar" | "cancelar"
  const [nuevoInicio, setNuevoInicio] = useState("");
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  const [guardando, setGuardando] = useState(false);

  // Estado de la reserva e histórico de la clienta
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [errorEstado, setErrorEstado] = useState("");
  const [historial, setHistorial] = useState(null);
  const [versionHistorial, setVersionHistorial] = useState(0);

  // Carga la reserva (como DetailView en Django)
  useEffect(() => {
    let vigente = true;
    obtenerReserva(id)
      .then(({ data }) => {
        if (vigente) setReserva(data);
      })
      .catch((err) => {
        if (!vigente) return;
        const codigo = err.response?.status;
        if (codigo === 404) {
          setErrorCarga("La reserva no existe o pertenece a otro local.");
        } else if (codigo === 403) {
          setErrorCarga("No tienes permiso para ver esta reserva.");
        } else {
          setErrorCarga("No se pudo conectar con el servidor. Intenta de nuevo.");
        }
      });
    return () => {
      vigente = false;
    };
  }, [id]);

  const clienteId = reserva?.cliente;
  useEffect(() => {
    if (!clienteId) return;
    let vigente = true;
    obtenerHistorial(clienteId)
      .then(({ data }) => vigente && setHistorial(data))
      .catch(() => vigente && setHistorial({ resumen: [], reservas: [], error: true }));
    return () => {
      vigente = false;
    };
  }, [clienteId, versionHistorial]);

  const abrir = (nuevoModo) => {
    setModo(nuevoModo);
    setErrores([]);
    setSugerencias([]);
    setAviso("");
    if (nuevoModo === "reprogramar") setNuevoInicio(paraInput(reserva.inicio));
    if (nuevoModo === "cancelar") setMotivo("");
  };

  // Junta los mensajes de error de la API (inicio, detail, motivo, etc.)
  const leerErrores = (err) => {
    const data = err.response?.data;
    if (!err.response) return ["No se pudo conectar con el servidor. Intenta de nuevo."];
    if (err.response.status === 404) return ["La reserva no existe o pertenece a otro local."];
    if (err.response.status === 403) return ["No tienes permiso para modificar esta reserva."];
    if (data && typeof data === "object") {
      return Object.entries(data)
        .filter(([campo]) => campo !== "sugerencias")
        .flatMap(([, mensajes]) => aLista(mensajes));
    }
    return ["No se pudo guardar el cambio."];
  };

  const reprogramar = async (e) => {
    e.preventDefault();
    if (!nuevoInicio) {
      setErrores(["Indica la nueva fecha y hora."]);
      return;
    }
    setGuardando(true);
    setErrores([]);
    setSugerencias([]);
    try {
      const { data } = await reprogramarReserva(id, nuevoInicio);
      setReserva(data);
      setModo("");
      setAviso(`Reserva reprogramada para el ${fechaLarga(data.inicio)} a las ${horaDe(data.inicio)}.`);
      setVersionHistorial((v) => v + 1);
    } catch (err) {
      setErrores(leerErrores(err));
      setSugerencias(aLista(err.response?.data?.sugerencias));
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async (e) => {
    e.preventDefault();
    if (!motivo.trim()) {
      setErrores(["Indica el motivo de la suspensión."]);
      return;
    }
    setGuardando(true);
    setErrores([]);
    try {
      const { data } = await cancelarReserva(id, motivo.trim());
      setReserva(data);
      setModo("");
      setAviso("Reserva suspendida. El horario quedó libre en la agenda.");
      setVersionHistorial((v) => v + 1);
    } catch (err) {
      setErrores(leerErrores(err));
    } finally {
      setGuardando(false);
    }
  };

  // Cambiar el estado (los mismos de la agenda). «Suspendió» abre el formulario del motivo.
  const guardarEstado = async () => {
    setErrorEstado("");
    if (!nuevoEstado || nuevoEstado === reserva.estado) return;
    if (nuevoEstado === "CANCELADA") {
      abrir("cancelar");
      return;
    }
    setGuardando(true);
    try {
      const { data } = await cambiarEstado(id, nuevoEstado);
      setReserva(data);
      setNuevoEstado("");
      setAviso(`Estado cambiado a «${data.estado_nombre}».`);
      setVersionHistorial((v) => v + 1);
    } catch (err) {
      setErrorEstado(leerErrores(err).join(" "));
    } finally {
      setGuardando(false);
    }
  };

  const listaErrores = errores.length > 0 && (
    <div className={ALERTA_ERROR} role="alert">
      {errores.map((m) => (
        <div key={m}>{m}</div>
      ))}
    </div>
  );

  // ---------- Pantallas de carga y error (nunca en blanco)
  if (errorCarga) {
    return (
      <Sidebar>
        <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6">
          <h1 className="mb-3 text-3xl font-bold text-[#1f1218]">Reserva no disponible</h1>
          <div className={ALERTA_ERROR} role="alert">{errorCarga}</div>
          <Link to="/agenda" className={ENLACE}>← Volver a la agenda</Link>
        </div>
      </Sidebar>
    );
  }
  if (!reserva) {
    return (
      <Sidebar>
        <p className="text-lg text-gray-600">Cargando reserva…</p>
      </Sidebar>
    );
  }

  // Una reserva suspendida o atendida ya no se reprograma ni se suspende (lo valida el modelo).
  const editable = !["CANCELADA", "ATENDIDA"].includes(reserva.estado);
  const est = estadoDe(reserva.estado);
  const volver = `/agenda?fecha=${fechaDe(reserva.inicio)}`;

  return (
    <Sidebar>
      <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6">
        <p className="mb-1 text-gray-600">
          <Link to={volver} className={ENLACE}>Agenda</Link> › Reserva N.º {reserva.id}
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-bold text-[#1f1218]">Detalle de reserva</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${est.chip}`}>
            {est.nombre}
          </span>
        </div>

        {aviso && <div className={ALERTA_OK} role="status">{aviso}</div>}

        <dl className="mb-6">
          <Dato etiqueta="Cliente">{reserva.cliente_nombre}</Dato>
          <Dato etiqueta="Teléfono">
            <span className="inline-flex items-center gap-3">
              {reserva.cliente_telefono}
              <BotonWhatsApp compacto telefono={reserva.cliente_telefono} texto="Escribirle" mensaje={MENSAJES.saludo.texto(reserva)} />
            </span>
          </Dato>
          <Dato etiqueta="Servicio">{reserva.servicio_nombre}</Dato>
          <Dato etiqueta="Especialista">{reserva.especialista_nombre}</Dato>
          <Dato etiqueta="Local">{reserva.local_nombre}</Dato>
          <Dato etiqueta="Fecha">{conMayuscula(fechaLarga(reserva.inicio))}</Dato>
          <Dato etiqueta="Horario">{horaDe(reserva.inicio)} a {horaDe(reserva.fin)}</Dato>
          {reserva.estado === "CANCELADA" && (
            <Dato etiqueta="Motivo de la suspensión">{reserva.motivo_cancelacion || "—"}</Dato>
          )}
        </dl>

        {/* WhatsApp: abre el chat de la clienta con el mensaje escrito; la recepcionista solo presiona Enviar */}
        <div className="mb-6">
          <h2 className="mb-2 font-semibold text-[#1f1218]">Avisar por WhatsApp</h2>
          <div className="flex flex-wrap gap-2">
            {(reserva.estado === "CANCELADA" ? ["suspendida"] : ["confirmar", "recordatorio", "reprogramada"]).map((clave) => (
              <BotonWhatsApp
                key={clave}
                telefono={reserva.cliente_telefono}
                texto={MENSAJES[clave].etiqueta}
                mensaje={MENSAJES[clave].texto(reserva)}
              />
            ))}
          </div>
        </div>

        {/* Modificar estado (también se puede con clic derecho en la agenda) */}
        <div className="mb-6">
          <label htmlFor="nuevo-estado" className="mb-1 block font-semibold text-[#1f1218]">Modificar estado</label>
          <div className="flex flex-wrap gap-2">
            <select
              id="nuevo-estado"
              value={nuevoEstado}
              onChange={(e) => setNuevoEstado(e.target.value)}
              className={`${CAMPO} max-w-xs`}
            >
              <option value="">---------</option>
              {ESTADOS.filter((e) => e.valor !== reserva.estado).map((e) => (
                <option key={e.valor} value={e.valor}>{e.nombre}</option>
              ))}
            </select>
            <button type="button" className={BOTON_BORDE} disabled={!nuevoEstado || guardando} onClick={guardarEstado}>
              Guardar estado
            </button>
          </div>
          {errorEstado && <p className="mt-2 text-red-700" role="alert">{errorEstado}</p>}
          {est.libera && <p className="mt-2 text-sm text-gray-600">Con este estado el horario queda libre para otra clienta.</p>}
        </div>

        {!editable && (
          <p className="mb-4 text-gray-600">
            {reserva.estado === "CANCELADA"
              ? "Esta reserva está suspendida: para reprogramarla, primero cámbiale el estado."
              : "Esta reserva ya fue atendida: ya no se puede reprogramar ni suspender."}
          </p>
        )}

        {/* Botones principales */}
        {editable && modo === "" && (
          <div className="mb-4 flex flex-wrap gap-3">
            <button type="button" className={BOTON} onClick={() => abrir("reprogramar")}>
              Reprogramar
            </button>
            <button type="button" className={BOTON_BORDE} onClick={() => abrir("cancelar")}>
              Suspender reserva
            </button>
          </div>
        )}

        {/* Reprogramar */}
        {editable && modo === "reprogramar" && (
          <form onSubmit={reprogramar} className="mb-4 rounded-lg border border-gray-200 p-4" noValidate>
            <h2 className="mb-3 text-2xl font-bold text-[#1f1218]">Reprogramar</h2>
            {listaErrores}
            <label htmlFor="nuevo-inicio" className="mb-1 block font-semibold text-[#1f1218]">
              Nueva fecha y hora
            </label>
            <input
              id="nuevo-inicio"
              type="datetime-local"
              className={`${CAMPO} mb-4`}
              value={nuevoInicio}
              onChange={(e) => setNuevoInicio(e.target.value)}
            />
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
                      className={BOTON_BORDE}
                      onClick={() => setNuevoInicio(paraInput(s))}
                    >
                      {horaDe(s)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="submit" className={BOTON} disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar nuevo horario"}
              </button>
              <button type="button" className={BOTON_BORDE} onClick={() => abrir("")}>
                Volver
              </button>
            </div>
          </form>
        )}

        {/* Cancelar: pide motivo y confirmación */}
        {editable && modo === "cancelar" && (
          <form onSubmit={cancelar} className="mb-4 rounded-lg border border-red-200 bg-red-50/40 p-4" noValidate>
            <h2 className="mb-1 text-2xl font-bold text-[#1f1218]">Suspender reserva</h2>
            <p className="mb-3 text-gray-700">
              ¿Seguro que quieres suspender la reserva de {reserva.cliente_nombre} del{" "}
              {fechaLarga(reserva.inicio)} a las {horaDe(reserva.inicio)}? El horario quedará libre.
            </p>
            {listaErrores}
            <label htmlFor="motivo" className="mb-1 block font-semibold text-[#1f1218]">
              Motivo (obligatorio)
            </label>
            <textarea
              id="motivo"
              rows={3}
              maxLength={200}
              className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-lg focus:border-[#b5368f] focus:outline-none"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: la clienta avisó que no puede asistir"
            />
            <div className="flex flex-wrap gap-3">
              <button type="submit" className={BOTON_PELIGRO} disabled={guardando}>
                {guardando ? "Suspendiendo…" : "Sí, suspender reserva"}
              </button>
              <button type="button" className={BOTON_BORDE} onClick={() => abrir("")}>
                No, volver
              </button>
            </div>
          </form>
        )}

        {/* Histórico de la clienta (como «Histórico del Cliente» de Reservo) */}
        <section className="mt-8 border-t border-gray-200 pt-6">
          <h2 className="mb-3 text-2xl font-bold text-[#1f1218]">Histórico de {reserva.cliente_nombre}</h2>
          {historial === null && <p className="text-gray-600">Cargando histórico…</p>}
          {historial?.error && <p className="text-red-700">No se pudo cargar el histórico.</p>}
          {historial && !historial.error && (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {historial.resumen.filter((f) => f.total > 0).map((f) => (
                  <span key={f.estado} className={`rounded-full px-3 py-1 text-sm font-semibold ${estadoDe(f.estado).chip}`}>
                    {f.estado_nombre}: {f.total}
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-[#faf9f7] text-gray-600">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Especialista</th>
                      <th className="px-3 py-2">Servicio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.reservas.map((h) => (
                      <tr key={h.id} className={`border-t border-gray-100 ${h.id === reserva.id ? "bg-[#f7e3f1]" : ""}`}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {h.id === reserva.id ? (
                            <b>{fechaDe(h.inicio).split("-").reverse().join("/")} {horaDe(h.inicio)}</b>
                          ) : (
                            <Link to={`/agenda/reservas/${h.id}`} className={ENLACE}>
                              {fechaDe(h.inicio).split("-").reverse().join("/")} {horaDe(h.inicio)}
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${estadoDe(h.estado).chip}`}>{h.estado_nombre}</span>
                        </td>
                        <td className="px-3 py-2">{h.especialista_nombre}</td>
                        <td className="px-3 py-2">{h.servicio_nombre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <p className="mt-4">
          <Link to={volver} className={ENLACE}>← Volver a la agenda</Link>
        </p>
      </div>
    </Sidebar>
  );
}
