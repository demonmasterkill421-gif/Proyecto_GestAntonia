import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { TriangleAlert } from "lucide-react";
import { cambiarEstado, obtenerAgenda } from "../../../api/reservas.api";
import { useAuth } from "../../../auth/AuthContext";
import { useTitulo } from "../../../hooks/useTitulo";
import { Sidebar } from "../../../components/Sidebar";
import { BotonWhatsApp } from "../comun/BotonWhatsApp";
import { MENSAJES } from "../comun/whatsapp";
import { ESTADOS, estadoDe } from "../comun/estados";

// Primer mensaje de error de la API (detail, inicio, motivo…)
function mensajeDeError(err) {
  const data = err.response?.data;
  if (!data || typeof data !== "object") return "No se pudo cambiar el estado.";
  const primero = Object.entries(data).find(([campo]) => campo !== "sugerencias")?.[1];
  return Array.isArray(primero) ? primero[0] : String(primero ?? "No se pudo cambiar el estado.");
}

export default function Agenda() {
  useTitulo("Agenda del día");
  const { usuario } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  // Fecha de hoy en hora de Chile. toISOString() usa UTC: después de las 21:00 daba el día siguiente.
  const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }); // AAAA-MM-DD
  const fechaUrl = searchParams.get("fecha") || fechaHoy;

  const [agenda, setAgenda] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const localActual = useRef("");

  // Menú de clic derecho (como en Reservo) y ventana para el motivo al suspender
  const [menu, setMenu] = useState(null); // { x, y, reserva }
  const [suspender, setSuspender] = useState(null); // reserva
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async (fecha, idLocal) => {
    localActual.current = idLocal;
    setCargando(true);
    setError(null);
    try {
      const respuesta = await obtenerAgenda(fecha, idLocal);
      setAgenda(respuesta.data);
    } catch (err) {
      if (err.response?.status === 400 && err.response.data?.local) {
        setError("Por favor, selecciona un local en el menú superior para ver la agenda.");
      } else {
        setError("Error al cargar la agenda. Intenta de nuevo.");
      }
    }
    setCargando(false);
  };

  useEffect(() => {
    // La administradora usa el local del selector del encabezado. Si todavía no ha elegido uno,
    // se usa la primera sucursal (id 1), que es la que el selector muestra por defecto.
    const idLocal = usuario?.rol === "ADMIN" ? (localStorage.getItem("sucursal") || "1") : "";
    cargarDatos(fechaUrl, idLocal);

    const alCambiarLocal = (evento) => cargarDatos(fechaUrl, evento.detail.id);
    window.addEventListener("gestantonia:sucursal-cambiada", alCambiarLocal);

    return () => window.removeEventListener("gestantonia:sucursal-cambiada", alCambiarLocal);
  }, [fechaUrl, usuario]);

  // El menú se cierra al hacer clic en otro lado, al hacer scroll o con Escape
  useEffect(() => {
    if (!menu) return;
    const cerrar = () => setMenu(null);
    const conTecla = (e) => e.key === "Escape" && setMenu(null);
    window.addEventListener("click", cerrar);
    window.addEventListener("scroll", cerrar, true);
    window.addEventListener("keydown", conTecla);
    return () => {
      window.removeEventListener("click", cerrar);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("keydown", conTecla);
    };
  }, [menu]);

  const manejarCambioFecha = (evento) => {
    setSearchParams({ fecha: evento.target.value });
  };

  const abrirMenu = (evento, reserva) => {
    evento.preventDefault();
    const ancho = 220;
    const alto = 360;
    setMenu({
      x: Math.min(evento.clientX, window.innerWidth - ancho - 8),
      y: Math.min(evento.clientY, window.innerHeight - alto - 8),
      reserva,
    });
  };

  const aplicarEstado = async (reserva, estado, motivoSuspension = "") => {
    setGuardando(true);
    try {
      await cambiarEstado(reserva.id, estado, motivoSuspension);
      toast.success(`${reserva.cliente_nombre}: ${estadoDe(estado).nombre}`);
      setSuspender(null);
      await cargarDatos(fechaUrl, localActual.current);
    } catch (err) {
      toast.error(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  };

  const elegirEstado = (estado) => {
    const reserva = menu.reserva;
    setMenu(null);
    if (estado === reserva.estado) return;
    if (estado === "CANCELADA") {
      setMotivo("");
      setSuspender(reserva); // pide el motivo antes de suspender
      return;
    }
    aplicarEstado(reserva, estado);
  };

  if (cargando && !agenda) return <Sidebar><div className="p-6 text-gray-500">Cargando agenda...</div></Sidebar>;
  if (error) return <Sidebar><div className="p-6 text-red-700 bg-red-50 rounded-xl m-6">{error}</div></Sidebar>;
  if (!agenda) return null;

  return (
    <Sidebar>
      <div className="p-6 max-w-7xl mx-auto text-[#1f1218]">

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Agenda del día</h2>
          <h1 className="text-3xl font-bold text-[#b5368f] mb-6">{agenda.local.nombre}</h1>

          <div className="flex items-end max-w-xs">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={fechaUrl}
                onChange={manejarCambioFecha}
                className="w-full min-h-[44px] rounded-lg border-gray-300 border px-3 focus:border-[#b5368f] focus:ring-[#b5368f]"
              />
            </div>
          </div>

          {/* Leyenda de colores */}
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Estados:</span>
            {ESTADOS.map((e) => (
              <span key={e.valor} className={`rounded-full px-2 py-1 font-semibold ${e.chip}`}>{e.nombre}</span>
            ))}
            <span className="text-gray-500">· Clic derecho sobre una reserva para cambiar su estado.</span>
          </div>
        </div>

        {agenda.especialistas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500 mb-4">Este local todavía no tiene especialistas activas.</p>
            <Link to={`/agenda/clientes`} className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#b5368f] px-6 text-white hover:bg-[#9c2d7b]">
              Nueva reserva
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-center border-collapse min-w-[600px]">
              <thead className="bg-[#faf9f7] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 w-24 border-r border-gray-200 font-semibold text-gray-600">Hora</th>
                  {agenda.especialistas.map(esp => (
                    <th key={esp.id} className="py-3 px-4 font-semibold text-gray-600 border-r border-gray-200 last:border-0">
                      {esp.nombre} {!esp.activa && <span className="text-xs text-red-500 font-normal">(inactiva)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agenda.bloques.map((bloque, indexFila) => (
                  <tr key={indexFila} className="border-b border-gray-200 last:border-0">
                    <td className="py-4 px-4 border-r border-gray-200 font-medium text-gray-500 align-top">
                      {bloque.hora}
                    </td>

                    {bloque.celdas.map((celda, indexCelda) => {
                      if (celda.estado !== "OCUPADO") {
                        return (
                          <td key={indexCelda} className="border-r border-gray-200 last:border-0 p-2 align-top w-48">
                            <div className="h-full bg-green-50 border-l-4 border-green-600 p-3 rounded text-left flex flex-col justify-between">
                              <p className="font-bold text-green-700 text-sm mb-2">Libre</p>
                              <Link
                                to={`/agenda/clientes?especialista=${celda.especialista}&inicio=${bloque.inicio.slice(0,16)}`}
                                className="inline-flex min-h-[32px] items-center justify-center rounded border border-green-600 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                              >
                                Agendar
                              </Link>
                            </div>
                          </td>
                        );
                      }
                      const est = estadoDe(celda.reserva.estado);
                      return (
                        <td key={indexCelda} className="border-r border-gray-200 last:border-0 p-2 align-top w-48">
                          <div
                            onContextMenu={(e) => abrirMenu(e, celda.reserva)}
                            title="Clic derecho para cambiar el estado"
                            className={`h-full border-l-4 p-3 rounded text-left ${est.bloque}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className={`font-bold text-sm mb-1 ${est.texto}`}>{est.nombre}</p>
                                <Link to={`/agenda/reservas/${celda.reserva.id}`} className="text-xs text-gray-700 hover:text-[#b5368f] hover:underline block">
                                  {celda.reserva.cliente_observacion && (
                                    <TriangleAlert size={14} className="mr-1 inline text-amber-600" aria-label="Tiene observación" />
                                  )}
                                  {celda.reserva.cliente_nombre} · {celda.reserva.servicio_nombre}
                                </Link>
                                {celda.reserva.cliente_observacion && (
                                  <p className="mt-1 line-clamp-2 text-xs text-amber-800" title={celda.reserva.cliente_observacion}>
                                    {celda.reserva.cliente_observacion}
                                  </p>
                                )}
                              </div>
                              <BotonWhatsApp
                                compacto
                                telefono={celda.reserva.cliente_telefono}
                                texto={MENSAJES.confirmar.etiqueta}
                                mensaje={MENSAJES.confirmar.texto({ ...celda.reserva, local_nombre: agenda.local.nombre })}
                              />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reservas del día que no ocupan horario: su espacio quedó libre, pero se pueden revisar */}
        {agenda.sin_horario?.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-1">Reservas que liberaron su horario</h2>
            <p className="text-sm text-gray-500 mb-4">Suspendidas, de clientas que no llegaron o en lista de espera.</p>
            <ul className="divide-y divide-gray-100">
              {agenda.sin_horario.map((r) => {
                const est = estadoDe(r.estado);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="w-14 font-medium text-gray-600">{r.inicio.slice(11, 16)}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${est.chip}`}>{est.nombre}</span>
                    <Link to={`/agenda/reservas/${r.id}`} className="text-[#b5368f] hover:underline">
                      {r.cliente_nombre}
                    </Link>
                    <span className="text-sm text-gray-600">{r.servicio_nombre} · {r.especialista_nombre}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Menú de clic derecho */}
      {menu && (
        <div
          role="menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-[220px] rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
        >
          <p className="truncate px-3 py-2 text-xs font-semibold text-gray-500">{menu.reserva.cliente_nombre}</p>
          {ESTADOS.map((e) => (
            <button
              key={e.valor}
              type="button"
              role="menuitem"
              disabled={guardando}
              onClick={() => elegirEstado(e.valor)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${e.valor === menu.reserva.estado ? "font-bold" : ""}`}
            >
              <span className={`h-3 w-3 rounded-full border-2 ${e.bloque}`} aria-hidden="true" />
              {e.nombre}
              {e.valor === menu.reserva.estado && <span className="ml-auto text-xs text-gray-400">actual</span>}
            </button>
          ))}
          <Link
            to={`/agenda/reservas/${menu.reserva.id}`}
            className="block border-t border-gray-100 px-3 py-2 text-sm text-[#b5368f] hover:bg-gray-50"
          >
            Ver detalle e histórico
          </Link>
        </div>
      )}

      {/* Motivo obligatorio para suspender */}
      {suspender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!motivo.trim()) {
                toast.error("Indica el motivo de la suspensión.");
                return;
              }
              aplicarEstado(suspender, "CANCELADA", motivo.trim());
            }}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="mb-1 text-xl font-bold">Suspender reserva</h2>
            <p className="mb-3 text-gray-600">
              {suspender.cliente_nombre} · {suspender.servicio_nombre} · {suspender.inicio.slice(11, 16)}. El horario quedará libre.
            </p>
            <label htmlFor="motivo-suspension" className="mb-1 block font-semibold">Motivo (obligatorio)</label>
            <textarea
              id="motivo-suspension"
              rows={3}
              maxLength={200}
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: la clienta avisó que no puede asistir"
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-[#b5368f] focus:outline-none"
            />
            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={guardando} className="min-h-[44px] rounded-lg bg-red-700 px-5 font-semibold text-white hover:bg-red-800 disabled:opacity-60">
                {guardando ? "Suspendiendo…" : "Suspender"}
              </button>
              <button type="button" onClick={() => setSuspender(null)} className="min-h-[44px] rounded-lg border border-[#b5368f] px-4 text-[#b5368f] hover:bg-[#f7e3f1]">
                Volver
              </button>
            </div>
          </form>
        </div>
      )}
    </Sidebar>
  );
}
