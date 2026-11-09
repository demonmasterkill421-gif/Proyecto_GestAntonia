import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, Clock, Download, Pencil, UserCheck, UserX, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  corregirAsistencia,
  exportarAsistencias,
  marcarAsistencia,
  obtenerDia,
  obtenerResumen,
} from "../api/asistencia.api";
import { SUCURSALES, useSucursalId } from "../hooks/useSucursal";

// ---------- Utilidades de fecha y hora ----------
const dos = (n) => String(n).padStart(2, "0");
const hoy = () => new Date().toLocaleDateString("sv-SE"); // aaaa-mm-dd
const verFecha = (f) => f.split("-").reverse().join("-"); // aaaa-mm-dd → dd-mm-aaaa
const hora = (h) =>
  h ? new Date(h).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "—";
const horaInput = (h) =>
  h ? new Date(h).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) : ""; // hh:mm
const horas = (n) => `${Number(n).toLocaleString("es-CL", { maximumFractionDigits: 2 })} h`;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Los últimos 4 meses, cada uno con sus dos quincenas y el mes completo
function crearPeriodos() {
  const ahora = new Date();
  const grupos = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const anio = d.getFullYear();
    const mes = d.getMonth();
    const ultimo = new Date(anio, mes + 1, 0).getDate();
    const base = `${anio}-${dos(mes + 1)}`;
    grupos.push({
      grupo: `${MESES[mes]} ${anio}`,
      opciones: [
        { id: `${base}-q1`, nombre: "1ª quincena (1 al 15)", desde: `${base}-01`, hasta: `${base}-15` },
        { id: `${base}-q2`, nombre: `2ª quincena (16 al ${ultimo})`, desde: `${base}-16`, hasta: `${base}-${dos(ultimo)}` },
        { id: `${base}-mes`, nombre: "Mes completo", desde: `${base}-01`, hasta: `${base}-${dos(ultimo)}` },
      ],
    });
  }
  return grupos;
}

const periodoActual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${d.getDate() <= 15 ? "q1" : "q2"}`;
};

// Saca el mensaje de error que manda el backend
const mensajeError = (e, porDefecto) => {
  const datos = e?.response?.data;
  if (!datos) return porDefecto;
  if (typeof datos.detail === "string") return datos.detail;
  const primero = Object.values(datos)[0];
  return Array.isArray(primero) ? primero[0] : porDefecto;
};

// ---------- Carga de datos con refresco automático ----------
// "funcion" debe venir de useCallback para que no se vuelva a cargar en cada render.
function useCarga(funcion, cadaMs) {
  const [estado, setEstado] = useState({ origen: null, datos: null, error: "" });
  const contador = useRef(0);

  const recargar = useCallback(async () => {
    const turno = ++contador.current;
    try {
      const { data } = await funcion();
      if (turno === contador.current) setEstado({ origen: funcion, datos: data, error: "" });
    } catch {
      if (turno === contador.current) {
        setEstado((e) => ({
          origen: funcion,
          datos: e.origen === funcion ? e.datos : null,
          error: "No se pudieron cargar los datos",
        }));
      }
    }
  }, [funcion]);

  useEffect(() => {
    recargar();
    const id = setInterval(recargar, cadaMs);
    return () => clearInterval(id);
  }, [recargar, cadaMs]);

  const actual = estado.origen === funcion;
  return {
    datos: actual ? estado.datos : null,
    cargando: !actual,
    error: actual ? estado.error : "",
    recargar,
  };
}

// ---------- Estilos ----------
const BADGES = {
  PRESENTE: { texto: "Presente", clase: "bg-emerald-100 text-emerald-700" },
  SIN_ENTRADA: { texto: "Sin entrada", clase: "bg-red-100 text-red-700" },
  CERRADA: { texto: "Salida registrada", clase: "bg-gray-200 text-gray-700" },
  SIN_SALIDA: { texto: "Sin salida", clase: "bg-amber-100 text-amber-800" },
};

const campo =
  "h-12 w-full rounded-lg border border-[#e6b8d4] bg-white px-3 text-base text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30";
const etiqueta = "mb-1 block text-base font-semibold text-[#9c2d7b]";
const botonEntrada =
  "h-10 cursor-pointer rounded-lg bg-[#b5368f] px-4 text-base font-semibold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b] disabled:cursor-not-allowed disabled:opacity-50";
const botonSalida =
  "h-10 cursor-pointer rounded-lg border border-[#b5368f] bg-white px-4 text-base font-semibold text-[#b5368f] hover:bg-[#fbeef6] disabled:cursor-not-allowed disabled:opacity-50";

function Tarjeta({ icono: Icono, titulo, valor }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e6b8d4] bg-white p-4 shadow-sm shadow-[#b5368f]/10">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f7e3f1] text-[#b5368f]">
        <Icono size={22} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-base text-[#9c2d7b]">{titulo}</p>
        <p className="text-2xl font-bold text-[#1f1218]">{valor}</p>
      </div>
    </div>
  );
}

// rol: "ADMIN" o "RECEP". Los dos marcan entrada y salida; solo ADMIN corrige (lápiz), descarga el Excel
// y cambia de sucursal con los botones. La recepcionista solo ve su local (lo filtra el backend).
export function ListaAsistencia({ rol }) {
  const esAdmin = rol === "ADMIN";
  const sucursalId = useSucursalId();

  const [fecha, setFecha] = useState(hoy);
  const [localId, setLocalId] = useState(String(sucursalId)); // sucursal que se está viendo
  const [periodoId, setPeriodoId] = useState(periodoActual);
  const [ahora, setAhora] = useState(() => new Date());
  const [marcando, setMarcando] = useState(null); // id de la trabajadora en proceso
  const [edicion, setEdicion] = useState(null); // diálogo del lápiz
  const [descargando, setDescargando] = useState(false);

  // Si se cambia la sucursal en el encabezado, el panel la sigue
  useEffect(() => {
    setLocalId(String(sucursalId));
  }, [sucursalId]);

  const sucursal = SUCURSALES.find((s) => String(s.id) === localId);

  const grupos = useMemo(crearPeriodos, []);
  const periodo = grupos.flatMap((g) => g.opciones).find((o) => o.id === periodoId);

  const cargarDia = useCallback(() => obtenerDia({ fecha, local: localId }), [fecha, localId]);
  const cargarResumen = useCallback(
    () => obtenerResumen({ desde: periodo.desde, hasta: periodo.hasta, local: localId }),
    [periodo.desde, periodo.hasta, localId]
  );

  const dia = useCarga(cargarDia, 30000);
  const resumen = useCarga(cargarResumen, 60000);

  const esHoy = fecha === hoy();
  const filas = dia.datos?.filas ?? [];
  const filasResumen = resumen.datos?.filas ?? [];

  // Reloj de la tarjeta "Hora actual"
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Diálogo abierto: Escape lo cierra y la página de atrás no se desplaza
  const dialogoAbierto = edicion !== null;
  useEffect(() => {
    if (!dialogoAbierto) return;
    const tecla = (e) => {
      if (e.key === "Escape") setEdicion(null);
    };
    document.addEventListener("keydown", tecla);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = anterior;
    };
  }, [dialogoAbierto]);

  const estadoDe = (fila) => {
    const a = fila.asistencia;
    if (!a) return "SIN_ENTRADA";
    if (a.hora_salida) return "CERRADA";
    return esHoy ? "PRESENTE" : "SIN_SALIDA";
  };

  const estados = filas.map(estadoDe);
  const presentes = estados.filter((e) => e === "PRESENTE").length;
  const sinEntrada = estados.filter((e) => e === "SIN_ENTRADA").length;
  const cerradas = estados.filter((e) => e === "CERRADA").length;

  const recargarTodo = () => Promise.all([dia.recargar(), resumen.recargar()]);

  // ---------- Marcar entrada / salida ----------
  const marcar = async (fila, accion) => {
    setMarcando(fila.trabajador);
    try {
      await marcarAsistencia({ trabajador: fila.trabajador, accion });
      await recargarTodo();
      toast.success(`${accion === "entrada" ? "Entrada" : "Salida"} registrada: ${fila.trabajador_nombre}`);
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo registrar la asistencia"));
    } finally {
      setMarcando(null);
    }
  };

  // ---------- Descargar el Excel del período (solo ADMIN) ----------
  const descargar = async () => {
    setDescargando(true);
    try {
      const archivo = await exportarAsistencias({
        desde: periodo.desde,
        hasta: periodo.hasta,
        local: localId,
      });
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `asistencia_${periodo.desde}_a_${periodo.hasta}.xlsx`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel descargado");
    } catch {
      toast.error("No se pudo descargar el Excel");
    } finally {
      setDescargando(false);
    }
  };

  // ---------- Lápiz: corregir o crear (solo ADMIN) ----------
  const abrirEdicion = (fila) => {
    setEdicion({
      fila,
      entrada: horaInput(fila.asistencia?.hora_entrada),
      salida: horaInput(fila.asistencia?.hora_salida),
      motivo: "",
      error: "",
      guardando: false,
    });
  };
  const cambiarEdicion = (nombre) => (e) => setEdicion({ ...edicion, [nombre]: e.target.value });

  const guardar = async () => {
    const { fila, entrada, salida, motivo } = edicion;
    const fallo = (error) => setEdicion((ed) => ({ ...ed, error, guardando: false }));

    if (!entrada || !salida) return fallo("Falta la hora de entrada o de salida");
    if (salida <= entrada) return fallo("La salida debe ser posterior a la entrada");
    if (!motivo.trim()) return fallo("Escribe el motivo de la corrección");

    setEdicion((ed) => ({ ...ed, guardando: true, error: "" }));
    try {
      await corregirAsistencia({
        trabajador: fila.trabajador,
        fecha,
        hora_entrada: new Date(`${fecha}T${entrada}`).toISOString(),
        hora_salida: new Date(`${fecha}T${salida}`).toISOString(),
        motivo: motivo.trim(),
      });
      setEdicion(null);
      await recargarTodo();
      toast.success(`Registro guardado: ${fila.trabajador_nombre}`);
    } catch (e) {
      fallo(mensajeError(e, "No se pudo guardar el registro"));
    }
  };

  // ---------- Piezas que se repiten en celular y computador ----------
  const insignia = (fila, estado) => {
    const b = BADGES[estado];
    const a = fila.asistencia;
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-base font-semibold ${b.clase}`}>{b.texto}</span>
        {a?.estado === "CORREGIDA" && (
          <span
            title={a.motivo_correccion || ""}
            className="rounded-full bg-sky-100 px-2 py-0.5 text-sm font-semibold text-sky-700"
          >
            Corregida
          </span>
        )}
      </span>
    );
  };

  const acciones = (fila, estado) => {
    const ocupada = marcando === fila.trabajador;
    return (
      <div className="flex items-center gap-2">
        {estado === "SIN_ENTRADA" && esHoy && (
          <button type="button" disabled={ocupada} onClick={() => marcar(fila, "entrada")} className={botonEntrada}>
            Marcar entrada
          </button>
        )}
        {estado === "PRESENTE" && (
          <button type="button" disabled={ocupada} onClick={() => marcar(fila, "salida")} className={botonSalida}>
            Marcar salida
          </button>
        )}
        {estado === "CERRADA" && (
          <span className="text-base font-medium text-[#9c2d7b]">Jornada cerrada</span>
        )}
        {!esAdmin && (estado === "SIN_SALIDA" || (estado === "SIN_ENTRADA" && !esHoy)) && (
          <span className="text-base text-[#9c2d7b]">—</span>
        )}
        {esAdmin && (
          <button
            type="button"
            onClick={() => abrirEdicion(fila)}
            aria-label={`Corregir registro de ${fila.trabajador_nombre}`}
            title="Corregir registro"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#e6b8d4] bg-white text-[#b5368f] hover:bg-[#fbeef6]"
          >
            <Pencil size={18} />
          </button>
        )}
      </div>
    );
  };

  const mensajeVacio = dia.cargando
    ? "Cargando..."
    : filas.length === 0
      ? "No hay especialistas registradas en este local."
      : "";

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-[#e6b8d4] bg-[#f7e3f1] p-4 shadow-lg shadow-[#b5368f]/15 sm:p-6">
      {/* Encabezado y selector de día */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#b5368f] text-white shadow-md shadow-[#b5368f]/30">
            <Clock size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[#1f1218] sm:text-2xl">Asistencia del día</h2>
            <p className="text-base font-medium text-[#9c2d7b]">
              {sucursal ? `${sucursal.nombre} · ` : ""}
              {esHoy ? "Hoy, " : ""}
              {verFecha(fecha)}
            </p>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 sm:w-56 sm:flex-none">
            <label htmlFor="dia-asistencia" className={etiqueta}>
              Día
            </label>
            <input
              id="dia-asistencia"
              type="date"
              value={fecha}
              max={hoy()}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              className={campo}
            />
          </div>
          {!esHoy && (
            <button type="button" onClick={() => setFecha(hoy())} className={`${botonSalida} h-12`}>
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Atajos de sucursal (solo la administradora): cambian el panel al instante */}
      {esAdmin && (
        <div role="group" aria-label="Sucursal" className="flex flex-wrap gap-2">
          {SUCURSALES.map((s) => {
            const activa = String(s.id) === localId;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={activa}
                onClick={() => setLocalId(String(s.id))}
                className={`cursor-pointer rounded-full border px-4 py-2 text-base font-semibold ${
                  activa
                    ? "border-[#b5368f] bg-[#b5368f] text-white"
                    : "border-[#e6b8d4] bg-white text-[#b5368f] hover:bg-[#fbeef6]"
                }`}
              >
                {s.nombre}
              </button>
            );
          })}
        </div>
      )}

      {dia.error && <p className="text-base font-medium text-[#b5368f]">{dia.error}</p>}

      {/* Tarjetas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta icono={UserCheck} titulo="Presentes ahora" valor={presentes} />
        <Tarjeta icono={UserX} titulo="Sin entrada" valor={sinEntrada} />
        <Tarjeta icono={CircleCheck} titulo="Jornada cerrada" valor={cerradas} />
        <Tarjeta icono={Clock} titulo="Hora actual" valor={hora(ahora)} />
      </div>

      {/* Tabla del día */}
      <div className="rounded-2xl border border-[#e6b8d4] bg-white p-4 shadow-sm shadow-[#b5368f]/10 sm:p-5">
        {!esHoy && (
          <p className="mb-3 text-base font-medium text-[#9c2d7b]">
            Estás viendo un día anterior: solo se puede marcar la asistencia de hoy.
          </p>
        )}
        {mensajeVacio && <p className="py-2 text-base font-medium text-[#9c2d7b]">{mensajeVacio}</p>}

        {/* Celular: tarjetas */}
        <ul className="flex flex-col gap-3 md:hidden">
          {filas.map((fila, i) => {
            const estado = estados[i];
            const a = fila.asistencia;
            return (
              <li key={fila.trabajador} className="rounded-2xl border border-[#e6b8d4] p-4">
                <p className="truncate text-lg font-bold text-[#b5368f]">{fila.trabajador_nombre}</p>
                <div className="mt-1">{insignia(fila, estado)}</div>
                <p className="mt-2 text-base text-[#9c2d7b]">
                  Entrada <span className="font-semibold text-[#1f1218]">{hora(a?.hora_entrada)}</span> · Salida{" "}
                  <span className="font-semibold text-[#1f1218]">{hora(a?.hora_salida)}</span>
                </p>
                <div className="mt-3">{acciones(fila, estado)}</div>
              </li>
            );
          })}
        </ul>

        {/* Computador: tabla */}
        {filas.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] text-left text-base text-[#1f1218]">
              <thead>
                <tr className="border-b border-[#e6b8d4] text-[#9c2d7b]">
                  <th className="py-2 pr-3 font-semibold">Especialista</th>
                  <th className="py-2 pr-3 font-semibold">Estado</th>
                  <th className="py-2 pr-3 font-semibold">Entrada</th>
                  <th className="py-2 pr-3 font-semibold">Salida</th>
                  <th className="py-2 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, i) => {
                  const estado = estados[i];
                  const a = fila.asistencia;
                  return (
                    <tr key={fila.trabajador} className="border-b border-[#f7e3f1]">
                      <td className="py-3 pr-3 font-bold text-[#b5368f]">{fila.trabajador_nombre}</td>
                      <td className="py-3 pr-3">{insignia(fila, estado)}</td>
                      <td className="py-3 pr-3">{hora(a?.hora_entrada)}</td>
                      <td className="py-3 pr-3">{hora(a?.hora_salida)}</td>
                      <td className="py-3">{acciones(fila, estado)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Días trabajados por período */}
      <div className="rounded-2xl border border-[#e6b8d4] bg-white p-4 shadow-sm shadow-[#b5368f]/10 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="text-xl font-bold text-[#1f1218]">Días trabajados por período</h3>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={periodoId}
              onChange={(e) => setPeriodoId(e.target.value)}
              aria-label="Período"
              className={`${campo} sm:w-72`}
            >
              {grupos.map((g) => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.opciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {esAdmin && (
              <button
                type="button"
                onClick={descargar}
                disabled={descargando}
                className={`${botonEntrada} inline-flex h-12 items-center justify-center gap-2 px-5`}
              >
                <Download size={20} />
                {descargando ? "Descargando..." : "Descargar Excel"}
              </button>
            )}
          </div>
        </div>

        {resumen.error && <p className="mb-2 text-base font-medium text-[#b5368f]">{resumen.error}</p>}
        {resumen.cargando && <p className="py-2 text-base font-medium text-[#9c2d7b]">Cargando...</p>}

        {!resumen.cargando && filasResumen.length === 0 && (
          <p className="py-2 text-base font-medium text-[#9c2d7b]">No hay especialistas registradas en este local.</p>
        )}

        {filasResumen.length > 0 && (
          <table className="w-full text-left text-base text-[#1f1218]">
            <thead>
              <tr className="border-b border-[#e6b8d4] text-[#9c2d7b]">
                <th className="py-2 pr-3 font-semibold">Especialista</th>
                <th className="py-2 pr-3 font-semibold">Días</th>
                <th className="py-2 font-semibold">Horas</th>
              </tr>
            </thead>
            <tbody>
              {filasResumen.map((f) => (
                <tr key={f.trabajador} className="border-b border-[#f7e3f1]">
                  <td className="py-3 pr-3 font-bold text-[#b5368f]">{f.trabajador_nombre}</td>
                  <td className="py-3 pr-3">{f.dias}</td>
                  <td className="py-3">{horas(f.horas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Diálogo del lápiz (solo ADMIN) */}
      {esAdmin && edicion && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-6"
          onClick={() => setEdicion(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Corregir registro"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
          >
            <div className="flex items-start gap-3 border-b border-[#f0cfe3] px-6 py-5">
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-bold text-[#1f1218]">
                  {edicion.fila.asistencia ? "Corregir registro" : "Crear registro"}
                </h3>
                <p className="truncate text-base font-medium text-[#9c2d7b]">
                  {edicion.fila.trabajador_nombre} · {verFecha(fecha)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEdicion(null)}
                aria-label="Cerrar"
                className="cursor-pointer rounded-full p-2 text-[#1f1218] hover:bg-[#f7e3f1] hover:text-[#b5368f]"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-entrada" className={etiqueta}>
                    Entrada
                  </label>
                  <input
                    id="edit-entrada"
                    type="time"
                    value={edicion.entrada}
                    onChange={cambiarEdicion("entrada")}
                    className={campo}
                  />
                </div>
                <div>
                  <label htmlFor="edit-salida" className={etiqueta}>
                    Salida
                  </label>
                  <input
                    id="edit-salida"
                    type="time"
                    value={edicion.salida}
                    onChange={cambiarEdicion("salida")}
                    className={campo}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-motivo" className={etiqueta}>
                  Motivo (obligatorio)
                </label>
                <textarea
                  id="edit-motivo"
                  rows={3}
                  value={edicion.motivo}
                  onChange={cambiarEdicion("motivo")}
                  placeholder="Ej.: Olvidó marcar la salida"
                  className={`${campo} h-auto py-2`}
                />
              </div>

              {edicion.error && <p className="text-base font-medium text-[#b5368f]">{edicion.error}</p>}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#f0cfe3] px-6 py-4">
              <button type="button" onClick={() => setEdicion(null)} className={`${botonSalida} h-12`}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardar}
                disabled={edicion.guardando}
                className={`${botonEntrada} h-12 px-6`}
              >
                {edicion.guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}