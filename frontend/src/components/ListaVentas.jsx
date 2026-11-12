import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Ban,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Receipt,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useDatos } from "../hooks/useDatos";
import {
  obtenerAllVentas,
  obtenerServiciosVenta,
  obtenerProductosVenta,
  exportarVentas,
  anularVenta,
  solicitarAnulacion,
  obtenerSolicitudes,
} from "../api/ventas.api";
import { ESPECIALISTAS } from "../data/catalogo";
import { SUCURSALES, useSucursalId } from "../hooks/useSucursal";

const clp = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

// Definidas fuera del componente para que useDatos las reconozca como estables.
// (Las ventas se piden dentro del componente porque dependen de los filtros.)
const cargarServicios = () => obtenerServiciosVenta();
const cargarProductos = () => obtenerProductosVenta();
const cargarPendientes = () => obtenerSolicitudes({ estado: "PENDIENTE" });

const fechaLocal = (fecha) => new Date(fecha).toLocaleDateString("sv-SE"); // aaaa-mm-dd
const fechaCorta = (fecha) =>
  new Date(fecha).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const verFecha = (f) => (f ? f.split("-").reverse().join("-") : "…"); // aaaa-mm-dd → dd-mm-aaaa
const haceDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("sv-SE");
};
const hoy = () => haceDias(0);
const esHoy = (fecha) => fechaLocal(fecha) === hoy();
const inicioMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("sv-SE");
};

const PAGOS = { EFECTIVO: "Efectivo", DEBITO: "Débito", CREDITO: "Crédito", TRANSFER: "Transferencia" };
const ESTADOS = {
  CONFIRMADA: { texto: "Confirmada", clase: "bg-emerald-100 text-emerald-700" },
  ANULADA: { texto: "Anulada", clase: "bg-gray-200 text-gray-600" },
};

// El motivo de la anulación: mínimo y máximo de letras (el servidor exige lo mismo)
const MOTIVO_MINIMO = 5;
const MOTIVO_MAXIMO = 500;

// Saca un texto legible del error que devuelve el servidor
const mensajeError = (err) => {
  const d = err?.response?.data;
  if (!d) return "No hay conexión con el servidor.";
  if (typeof d === "string") return "No se pudo completar la acción.";
  const t = d.detail ?? d.motivo ?? Object.values(d)[0];
  return Array.isArray(t) ? t.join(" ") : String(t);
};

// Mismo estilo que Registrar venta
const campo =
  "h-12 w-full rounded-lg border border-[#e6b8d4] bg-white px-3 text-base text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30";
const etiqueta = "mb-2 block text-base font-semibold text-[#9c2d7b]";

// Etiqueta amarilla que marca las ventas de hoy
function EtiquetaHoy() {
  return (
    <span className="rounded-full bg-yellow-200 px-2.5 py-0.5 text-sm font-bold uppercase text-yellow-900">Hoy</span>
  );
}

// Etiqueta naranja: la venta tiene una solicitud de anulación esperando respuesta
function EtiquetaPendiente() {
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800">
      Anulación pendiente
    </span>
  );
}

// Botones de opción (como las estrellas del ejemplo): uno solo queda marcado
function Opciones({ valor, onChange, opciones }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map(([v, nombre]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`cursor-pointer rounded-full border px-4 py-2 text-base font-semibold ${
            valor === v
              ? "border-[#b5368f] bg-[#b5368f] text-white"
              : "border-[#e6b8d4] bg-white text-[#b5368f] hover:bg-[#fbeef6]"
          }`}
        >
          {nombre}
        </button>
      ))}
    </div>
  );
}

// rol: "ADMIN" (ve todos los locales, anula y exporta) o "RECEP" (solo su local y solicita anulación).
// El filtrado por local de la recepcionista lo hace el backend; aquí solo se oculta el filtro.
export function ListaVentas({ rol }) {
  const esAdmin = rol === "ADMIN";

  const sucursalId = useSucursalId();
  const porDefecto = () => ({
    desde: inicioMes(),
    hasta: hoy(),
    local: String(sucursalId),
    estado: "",
    pago: "",
  });

  const [filtros, setFiltros] = useState(porDefecto); // filtros aplicados
  const [borrador, setBorrador] = useState(porDefecto); // lo que se edita dentro del panel
  const [texto, setTexto] = useState(""); // búsqueda (se aplica al escribir)
  const [panel, setPanel] = useState(false); // panel de filtros
  const [descarga, setDescarga] = useState(false); // panel de descarga (Excel / PDF)
  const [abierta, setAbierta] = useState(null); // id de la venta desplegada
  const [errorDescarga, setErrorDescarga] = useState("");
  const [exportando, setExportando] = useState(false);

  // Ventana para anular (propietaria) o solicitar la anulación (recepcionista)
  const [dialogo, setDialogo] = useState(false); // ventana abierta o cerrada
  const [anulando, setAnulando] = useState(null); // venta de la ventana (se conserva mientras se cierra)
  const [motivo, setMotivo] = useState("");
  const [enviandoAnulacion, setEnviandoAnulacion] = useState(false);
  const [errorMotivo, setErrorMotivo] = useState("");
  const motivoRef = useRef(null);

  // Las ventas se piden al servidor ya filtradas por período (y por local, si es la administradora),
  // en vez de traer todo el historial. Al cambiar estos filtros, useDatos vuelve a pedirlas.
  const cargarVentas = useCallback(
    () =>
      obtenerAllVentas({
        desde: filtros.desde || undefined,
        hasta: filtros.hasta || undefined,
        local: esAdmin && filtros.local ? filtros.local : undefined,
      }),
    [filtros.desde, filtros.hasta, filtros.local, esAdmin],
  );

  const { datos: ventas, cargando, error, recargar } = useDatos(cargarVentas, { cadaMs: 30000 });
  const { datos: pendientes, recargar: recargarPendientes } = useDatos(cargarPendientes, { cadaMs: 30000 });
  const { datos: servicios } = useDatos(cargarServicios, { cadaMs: 60000 });
  const { datos: productos } = useDatos(cargarProductos, { cadaMs: 60000 });

  // Ids de las ventas que tienen una solicitud de anulación esperando respuesta
  const idsPendientes = new Set((pendientes ?? []).map((s) => s.venta));

  // La administradora sigue la sucursal elegida en el encabezado (igual que Reportes)
  useEffect(() => {
    setFiltros((f) => ({ ...f, local: String(sucursalId) }));
  }, [sucursalId]);

  // Con un panel abierto: Escape lo cierra y la página de atrás no se desplaza
  const hayPanel = panel || descarga || dialogo;
  useEffect(() => {
    if (!hayPanel) return;
    const tecla = (e) => {
      if (e.key === "Escape") {
        document.activeElement?.blur(); // el foco no puede quedar dentro del panel oculto
        setPanel(false);
        setDescarga(false);
        if (!enviandoAnulacion) setDialogo(false);
      }
    };
    document.addEventListener("keydown", tecla);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = anterior;
    };
  }, [hayPanel, enviandoAnulacion]);

  // Al abrir la ventana de anulación, el cursor queda listo para escribir el motivo
  useEffect(() => {
    if (!dialogo) return;
    const id = setTimeout(() => motivoRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [dialogo]);

  const abrirPanel = () => {
    setBorrador(filtros);
    setPanel(true);
  };
  // Quita el foco antes de ocultar el panel, para que el navegador no avise
  const cerrarPanel = () => {
    document.activeElement?.blur();
    setPanel(false);
  };
  const aplicar = () => {
    setFiltros(borrador);
    cerrarPanel();
  };
  const abrirDescarga = () => {
    setErrorDescarga("");
    setDescarga(true);
  };
  const cerrarDescarga = () => {
    document.activeElement?.blur();
    setDescarga(false);
  };
  const cambiarBorrador = (nombre) => (valor) => setBorrador({ ...borrador, [nombre]: valor });

  // Anulación: abrir y cerrar la ventana del motivo
  const abrirAnulacion = (venta) => {
    setAnulando(venta);
    setMotivo("");
    setErrorMotivo("");
    setDialogo(true);
  };
  const cerrarAnulacion = () => {
    if (enviandoAnulacion) return;
    document.activeElement?.blur();
    setDialogo(false);
  };

  const motivoLimpio = motivo.trim();
  const motivoValido = motivoLimpio.length >= MOTIVO_MINIMO;

  // La propietaria anula la venta; la recepcionista envía la solicitud
  const confirmarAnulacion = async () => {
    if (!anulando || enviandoAnulacion || !motivoValido) return;
    setEnviandoAnulacion(true);
    setErrorMotivo("");
    try {
      if (esAdmin) {
        await anularVenta(anulando.id, motivoLimpio);
        toast.success(`Venta con folio ${anulando.folio ?? "—"} anulada.`);
      } else {
        await solicitarAnulacion(anulando.id, motivoLimpio);
        toast.success("Solicitud enviada. La propietaria la revisará.");
      }
      document.activeElement?.blur();
      setDialogo(false);
      await Promise.all([recargar(), recargarPendientes()]);
    } catch (err) {
      setErrorMotivo(mensajeError(err));
    } finally {
      setEnviandoAnulacion(false);
    }
  };

  // Atajo de sucursal: cambia el local de la lista al instante, sin abrir los filtros
  const elegirLocal = (valor) => setFiltros((f) => ({ ...f, local: valor }));

  const atajos = [
    { nombre: "Hoy", desde: hoy(), hasta: hoy() },
    { nombre: "Últimos 7 días", desde: haceDias(6), hasta: hoy() },
    { nombre: "Este mes", desde: inicioMes(), hasta: hoy() },
    { nombre: "Todo", desde: "", hasta: "" },
  ];

  const nombreItem = Object.fromEntries([...servicios, ...productos].map((i) => [i.id, i.nombre]));
  const nombreTrabajadora = (id) =>
    ESPECIALISTAS.find((e) => String(e.id) === String(id))?.nombre ?? `Trabajadora #${id}`;
  const nombreLocal = (id) => SUCURSALES.find((s) => String(s.id) === String(id))?.nombre ?? `Local #${id}`;
  const trabajadorasDe = (v) =>
    [...new Set(v.detalles.filter((d) => d.trabajador).map((d) => nombreTrabajadora(d.trabajador)))];
  const estadoDe = (v) => ESTADOS[v.estado] ?? { texto: v.estado, clase: "bg-gray-200 text-gray-600" };

  const rangoValido = !filtros.desde || !filtros.hasta || filtros.desde <= filtros.hasta;
  const borradorValido = !borrador.desde || !borrador.hasta || borrador.desde <= borrador.hasta;
  const busqueda = texto.trim().toLowerCase();

  // Cuántos filtros se salen de lo normal (el número del botón)
  const base = porDefecto();
  const activos =
    (filtros.desde !== base.desde || filtros.hasta !== base.hasta ? 1 : 0) +
    (esAdmin && filtros.local !== base.local ? 1 : 0) +
    (filtros.estado ? 1 : 0) +
    (filtros.pago ? 1 : 0);

  const filtradas = ventas
    .filter((v) => v.estado !== "BORRADOR")
    .filter((v) => {
      const dia = fechaLocal(v.fecha);
      return (
        rangoValido &&
        (!esAdmin || !filtros.local || String(v.local) === filtros.local) &&
        (!filtros.estado || v.estado === filtros.estado) &&
        (!filtros.pago || v.metodo_pago === filtros.pago) &&
        (!filtros.desde || dia >= filtros.desde) &&
        (!filtros.hasta || dia <= filtros.hasta) &&
        (!busqueda ||
          String(v.folio ?? "").includes(busqueda) ||
          trabajadorasDe(v).some((n) => n.toLowerCase().includes(busqueda)))
      );
    })
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  // Las anuladas no suman al total
  const total = filtradas.filter((v) => v.estado === "CONFIRMADA").reduce((suma, v) => suma + v.monto_total, 0);

  const mensajeVacio = cargando ? "Cargando..." : filtradas.length === 0 ? "No hay ventas con estos filtros." : "";
  const alternar = (id) => setAbierta(abierta === id ? null : id);

  // Descarga en Excel exactamente lo que se ve en la lista (solo la administradora)
  const exportar = async () => {
    setErrorDescarga("");
    setExportando(true);
    try {
      const archivo = await exportarVentas(filtradas.map((v) => v.id));
      const url = URL.createObjectURL(archivo);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `ventas_${hoy()}.xlsx`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      cerrarDescarga();
    } catch {
      setErrorDescarga("No se pudo descargar. Intenta de nuevo.");
    } finally {
      setExportando(false);
    }
  };

  // Detalle de una venta. Es el mismo en el celular y en el computador.
  // Las líneas separan secciones; los ítems van agrupados, sin línea entre ellos.
  const detalle = (v) => (
    <div className="divide-y divide-[#e6b8d4]">
      <div className="grid grid-cols-2 gap-3 pb-3 text-base">
        <div>
          <p className="text-[#9c2d7b]">Trabajadora</p>
          <p className="font-semibold text-[#1f1218]">{trabajadorasDe(v).join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-[#9c2d7b]">Pago</p>
          <p className="font-semibold text-[#1f1218]">{PAGOS[v.metodo_pago] ?? v.metodo_pago}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2 py-3">
        {v.detalles.map((d, i) => (
          <li key={i} className="flex items-start justify-between gap-3 text-base">
            <span className="min-w-0">
              {d.cantidad} × <span className="font-semibold">{nombreItem[d.item] ?? `Ítem #${d.item}`}</span>
              {d.trabajador && <span className="block text-[#9c2d7b]">{nombreTrabajadora(d.trabajador)}</span>}
            </span>
            <span className="shrink-0 font-semibold">{clp(d.subtotal)}</span>
          </li>
        ))}
      </ul>

      {Number(v.descuento) > 0 && (
        <div className="flex items-center justify-between gap-3 py-3 text-base font-medium text-[#9c2d7b]">
          <span>Descuento aplicado</span>
          <span className="font-semibold">{Number(v.descuento)}%</span>
        </div>
      )}

      {v.descripcion && (
        <div className="py-3">
          <p className="text-base text-[#9c2d7b]">Descripción</p>
          <p className="break-words text-base text-[#1f1218]">{v.descripcion}</p>
        </div>
      )}

      {v.estado === "CONFIRMADA" && (
        <div className="pt-3">
          {idsPendientes.has(v.id) && (
            <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-base font-semibold text-amber-800">
              {esAdmin
                ? "Hay una solicitud de anulación pendiente para esta venta."
                : "Pediste anular esta venta. Estamos esperando la respuesta de la propietaria."}
            </p>
          )}

          {/* La recepcionista no puede pedir dos veces la misma venta */}
          {(esAdmin || !idsPendientes.has(v.id)) && (
            <button
              type="button"
              onClick={() => abrirAnulacion(v)}
              className="h-11 w-full cursor-pointer rounded-lg border border-[#b5368f] bg-white px-4 text-base font-semibold text-[#b5368f] hover:bg-[#f7e3f1]"
            >
              {esAdmin ? "Anular venta" : "Solicitar anulación"}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <section className="flex min-h-[calc(100vh-12rem)] flex-col rounded-3xl border border-[#e6b8d4] bg-[#f7e3f1] shadow-lg shadow-[#b5368f]/15">
      {/* Encabezado */}
      <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#b5368f] text-white shadow-md shadow-[#b5368f]/30">
          <Receipt size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-[#1f1218] sm:text-2xl">Listado de ventas</h2>
          <p className="text-base font-medium text-[#9c2d7b]">
            {filtradas.length} {filtradas.length === 1 ? "venta" : "ventas"} · {clp(total)}
          </p>
        </div>
        {/* Solo la administradora descarga. En celular solo se ve el ícono */}
        {esAdmin && (
          <button
            type="button"
            onClick={abrirDescarga}
            disabled={filtradas.length === 0}
            aria-haspopup="dialog"
            aria-label="Descargar"
            title="Descargar"
            className="flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#b5368f] px-3 text-base font-semibold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
          >
            <Download size={20} />
            <span className="hidden sm:inline">Descargar</span>
          </button>
        )}
      </div>

      {error && <p className="px-4 pb-3 text-base font-medium text-[#b5368f] sm:px-6">{error}</p>}

      {/* Buscador + botón de filtros */}
      <div className="flex gap-3 px-4 pb-3 sm:px-6">
        <div className="relative min-w-0 flex-1">
          <Search
            size={20}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b5368f]"
          />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por folio o trabajadora..."
            className={`${campo} pl-10`}
          />
        </div>
        <button
          type="button"
          onClick={abrirPanel}
          aria-haspopup="dialog"
          className="flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-[#b5368f] bg-white px-4 text-base font-semibold text-[#b5368f] hover:bg-[#fbeef6]"
        >
          <SlidersHorizontal size={20} />
          Filtros
          {activos > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#b5368f] px-1.5 text-sm font-bold text-white">
              {activos}
            </span>
          )}
        </button>
      </div>

      {/* Atajos de sucursal (solo la administradora): cambian la lista al instante */}
      {esAdmin && (
        <div role="group" aria-label="Sucursal" className="px-4 pb-3 sm:px-6">
          <Opciones
            valor={filtros.local}
            onChange={elegirLocal}
            opciones={[["", "Todos"], ...SUCURSALES.map((s) => [String(s.id), s.nombre])]}
          />
        </div>
      )}

      <p className="px-4 pb-4 text-base font-medium text-[#9c2d7b] sm:px-6">
        Período: {verFecha(filtros.desde)} – {verFecha(filtros.hasta)}
        {!filtros.desde && !filtros.hasta && " (todo el historial)"}
      </p>
      {!rangoValido && (
        <p className="px-4 pb-4 text-base font-medium text-[#b5368f] sm:px-6">
          La fecha «Desde» no puede ser posterior a «Hasta».
        </p>
      )}

      {/* Listado: tarjetas en celular, tabla desde pantallas medianas */}
      <div className="flex flex-1 px-4 pb-6 sm:px-6">
        <div className="w-full md:rounded-2xl md:border md:border-[#e6b8d4] md:bg-white md:p-5 md:shadow-sm md:shadow-[#b5368f]/10">
          {/* Celular: tarjetas con lo mínimo; el resto aparece al abrirlas */}
          <div className="md:hidden">
            {mensajeVacio && <p className="py-2 text-base font-medium text-[#9c2d7b]">{mensajeVacio}</p>}
            <ul className="flex flex-col gap-3">
              {filtradas.map((v) => {
                const estado = estadoDe(v);
                const desplegada = abierta === v.id;
                return (
                  <li
                    key={v.id}
                    className={`rounded-2xl border bg-white shadow-sm shadow-[#b5368f]/10 ${
                      desplegada ? "border-[#b5368f]" : "border-[#e6b8d4]"
                    } ${v.estado === "ANULADA" ? "opacity-70" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => alternar(v.id)}
                      aria-expanded={desplegada}
                      className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-bold text-[#b5368f]">Folio {v.folio ?? "—"}</span>
                          {esHoy(v.fecha) && <EtiquetaHoy />}
                          {v.estado === "CONFIRMADA" && idsPendientes.has(v.id) && <EtiquetaPendiente />}
                          {v.estado === "ANULADA" && (
                            <span className={`rounded-full px-3 py-0.5 text-base font-semibold ${estado.clase}`}>
                              {estado.texto}
                            </span>
                          )}
                        </div>
                        <p className="text-base text-[#9c2d7b]">
                          {fechaCorta(v.fecha)}
                          {esAdmin && ` · ${nombreLocal(v.local)}`}
                        </p>
                      </div>
                      <span
                        className={`text-xl font-bold text-[#1f1218] ${
                          v.estado === "ANULADA" ? "line-through" : ""
                        }`}
                      >
                        {clp(v.monto_total)}
                      </span>
                      <ChevronDown
                        size={22}
                        className={`shrink-0 text-[#b5368f] transition-transform ${desplegada ? "rotate-180" : ""}`}
                      />
                    </button>
                    {desplegada && <div className="border-t border-[#e6b8d4] px-4 py-3">{detalle(v)}</div>}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pantallas medianas y grandes */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[46rem] text-left text-base text-[#1f1218]">
              <thead>
                <tr className="border-b border-[#e6b8d4] text-base text-[#9c2d7b]">
                  <th className="py-2 pr-3 font-semibold">Folio</th>
                  <th className="py-2 pr-3 font-semibold">Fecha</th>
                  {esAdmin && <th className="py-2 pr-3 font-semibold">Local</th>}
                  <th className="py-2 pr-3 font-semibold">Trabajadora</th>
                  <th className="py-2 pr-3 font-semibold">Pago</th>
                  <th className="py-2 pr-3 font-semibold">Total</th>
                  <th className="py-2 pr-3 font-semibold">Estado</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {mensajeVacio && (
                  <tr>
                    <td colSpan={8} className="py-4 font-medium text-[#9c2d7b]">
                      {mensajeVacio}
                    </td>
                  </tr>
                )}

                {filtradas.map((v) => {
                  const estado = estadoDe(v);
                  const desplegada = abierta === v.id;
                  return (
                    <Fragment key={v.id}>
                      <tr
                        onClick={() => alternar(v.id)}
                        className={`cursor-pointer border-b border-[#f7e3f1] hover:bg-[#fbeef6] ${
                          v.estado === "ANULADA" ? "text-gray-500" : ""
                        }`}
                      >
                        <td className="py-3 pr-3 font-bold text-[#b5368f]">{v.folio ?? "—"}</td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {fechaCorta(v.fecha)}
                            {esHoy(v.fecha) && <EtiquetaHoy />}
                          </div>
                        </td>
                        {esAdmin && <td className="py-3 pr-3">{nombreLocal(v.local)}</td>}
                        <td className="py-3 pr-3">{trabajadorasDe(v).join(", ") || "—"}</td>
                        <td className="py-3 pr-3">{PAGOS[v.metodo_pago] ?? v.metodo_pago}</td>
                        <td className={`py-3 pr-3 font-bold ${v.estado === "ANULADA" ? "line-through" : ""}`}>
                          {clp(v.monto_total)}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-base font-semibold ${estado.clase}`}>
                              {estado.texto}
                            </span>
                            {v.estado === "CONFIRMADA" && idsPendientes.has(v.id) && <EtiquetaPendiente />}
                          </div>
                        </td>
                        <td className="py-3">
                          <ChevronDown
                            size={20}
                            className={`text-[#b5368f] transition-transform ${desplegada ? "rotate-180" : ""}`}
                          />
                        </td>
                      </tr>

                      {desplegada && (
                        <tr className="border-b border-[#f7e3f1] bg-[#fbeef6]">
                          <td colSpan={8} className="px-4 py-4">
                            {/* Misma tarjeta que en el celular, ocupando todo el ancho */}
                            <div className="w-full rounded-2xl border border-[#e6b8d4] bg-white px-4 py-3 shadow-sm shadow-[#b5368f]/10">
                              {detalle(v)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Panel de filtros, siempre montado para poder animarlo:
          celular → sube desde abajo; computador → aparece con fundido y un leve zoom */}
      <div
        inert={!panel}
        aria-hidden={!panel}
        className={`fixed inset-0 z-[60] flex items-end justify-center transition-all duration-300 sm:items-center sm:p-6 ${
          panel ? "visible bg-black/40" : "invisible bg-black/0"
        }`}
        onClick={cerrarPanel}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filtros"
          onClick={(e) => e.stopPropagation()}
          className={`flex max-h-[90vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl transition-all duration-300 ease-out sm:max-w-xl sm:rounded-3xl ${
            panel
              ? "translate-y-0 opacity-100 sm:scale-100"
              : "translate-y-full opacity-0 sm:translate-y-4 sm:scale-95"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-[#f0cfe3] px-6 py-5">
            <h3 className="text-2xl font-bold text-[#1f1218]">Filtros</h3>
            {activos > 0 && (
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#f7e3f1] px-2 text-base font-bold text-[#b5368f]">
                {activos}
              </span>
            )}
            <button
              type="button"
              onClick={cerrarPanel}
              aria-label="Cerrar filtros"
              className="ml-auto cursor-pointer rounded-full p-2 text-[#1f1218] hover:bg-[#f7e3f1] hover:text-[#b5368f]"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
            <div>
              <label className={etiqueta}>Período</label>
              <div className="mb-3">
                <Opciones
                  valor={atajos.find((a) => a.desde === borrador.desde && a.hasta === borrador.hasta)?.nombre}
                  onChange={(nombre) => {
                    const a = atajos.find((x) => x.nombre === nombre);
                    setBorrador({ ...borrador, desde: a.desde, hasta: a.hasta });
                  }}
                  opciones={atajos.map((a) => [a.nombre, a.nombre])}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="mb-1 block text-base text-[#9c2d7b]">Desde</span>
                  <input
                    type="date"
                    value={borrador.desde}
                    onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
                    className={campo}
                  />
                </div>
                <div>
                  <span className="mb-1 block text-base text-[#9c2d7b]">Hasta</span>
                  <input
                    type="date"
                    value={borrador.hasta}
                    onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
                    className={campo}
                  />
                </div>
              </div>
              {!borradorValido && (
                <p className="mt-2 text-base font-medium text-[#b5368f]">
                  La fecha «Desde» no puede ser posterior a «Hasta».
                </p>
              )}
            </div>

            {esAdmin && (
              <div>
                <label className={etiqueta}>Local</label>
                <Opciones
                  valor={borrador.local}
                  onChange={cambiarBorrador("local")}
                  opciones={[["", "Todos"], ...SUCURSALES.map((s) => [String(s.id), s.nombre])]}
                />
              </div>
            )}

            <div>
              <label className={etiqueta}>Estado</label>
              <Opciones
                valor={borrador.estado}
                onChange={cambiarBorrador("estado")}
                opciones={[
                  ["", "Todos"],
                  ["CONFIRMADA", "Confirmada"],
                  ["ANULADA", "Anulada"],
                ]}
              />
            </div>

            <div>
              <label className={etiqueta}>Método de pago</label>
              <Opciones
                valor={borrador.pago}
                onChange={cambiarBorrador("pago")}
                opciones={[["", "Todos"], ...Object.entries(PAGOS)]}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#f0cfe3] px-6 py-4">
            <button
              type="button"
              onClick={() => setBorrador(porDefecto())}
              className="cursor-pointer text-base font-semibold text-[#b5368f] hover:underline"
            >
              Restablecer filtros
            </button>
            <button
              type="button"
              onClick={aplicar}
              disabled={!borradorValido}
              className="h-12 cursor-pointer rounded-lg bg-[#b5368f] px-6 text-base font-semibold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Panel de descarga (solo ADMIN), con la misma animación que el de filtros */}
      {esAdmin && (
        <div
          inert={!descarga}
          aria-hidden={!descarga}
          className={`fixed inset-0 z-[60] flex items-end justify-center transition-all duration-300 sm:items-center sm:p-6 ${
            descarga ? "visible bg-black/40" : "invisible bg-black/0"
          }`}
          onClick={cerrarDescarga}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Descargar ventas"
            onClick={(e) => e.stopPropagation()}
            className={`flex max-h-[90vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl transition-all duration-300 ease-out sm:max-w-md sm:rounded-3xl ${
              descarga
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-full opacity-0 sm:translate-y-4 sm:scale-95"
            }`}
          >
            <div className="flex items-start gap-3 border-b border-[#f0cfe3] px-6 py-5">
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-bold text-[#1f1218]">Descargar ventas</h3>
                <p className="text-base font-medium text-[#9c2d7b]">
                  {filtradas.length} {filtradas.length === 1 ? "venta" : "ventas"} según los filtros actuales
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarDescarga}
                aria-label="Cerrar"
                className="cursor-pointer rounded-full p-2 text-[#1f1218] hover:bg-[#f7e3f1] hover:text-[#b5368f]"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-6 py-6">
              <button
                type="button"
                onClick={exportar}
                disabled={exportando || filtradas.length === 0}
                className="flex h-24 w-full cursor-pointer items-center justify-center gap-4 rounded-2xl bg-[#b5368f] px-6 text-xl font-bold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet size={32} />
                {exportando ? "Descargando..." : "Descargar en Excel"}
              </button>

              {/* Bloqueado por ahora */}
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex h-24 w-full cursor-not-allowed flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-300 bg-gray-100 px-6 text-xl font-bold text-gray-400"
              >
                <span className="flex items-center gap-4">
                  <FileText size={32} />
                  Descargar en PDF
                </span>
                <span className="text-sm font-semibold">Próximamente</span>
              </button>

              {errorDescarga && <p className="text-base font-medium text-[#b5368f]">{errorDescarga}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Ventana de anulación: la propietaria anula; la recepcionista envía la solicitud.
          Siempre montada para poder animarla, igual que los otros paneles */}
      <div
        inert={!dialogo}
        aria-hidden={!dialogo}
        className={`fixed inset-0 z-[60] flex items-end justify-center transition-all duration-300 sm:items-center sm:p-6 ${
          dialogo ? "visible bg-black/40" : "invisible bg-black/0"
        }`}
        onClick={cerrarAnulacion}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={esAdmin ? "Anular venta" : "Solicitar anulación"}
          onClick={(e) => e.stopPropagation()}
          className={`flex max-h-[90vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl transition-all duration-300 ease-out sm:max-w-md sm:rounded-3xl ${
            dialogo
              ? "translate-y-0 opacity-100 sm:scale-100"
              : "translate-y-full opacity-0 sm:translate-y-4 sm:scale-95"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-[#f0cfe3] px-6 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f7e3f1] text-[#b5368f]">
              <Ban size={22} />
            </span>
            <h3 className="text-2xl font-bold text-[#1f1218]">{esAdmin ? "Anular venta" : "Solicitar anulación"}</h3>
            <button
              type="button"
              onClick={cerrarAnulacion}
              disabled={enviandoAnulacion}
              aria-label="Cerrar"
              className="ml-auto cursor-pointer rounded-full p-2 text-[#1f1218] hover:bg-[#f7e3f1] hover:text-[#b5368f] disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <p className="text-base text-[#1f1218]">
              Venta con folio <span className="font-bold text-[#b5368f]">{anulando?.folio ?? "—"}</span>
              {anulando && <> · {clp(anulando.monto_total)}</>}
            </p>

            <p className="text-base text-[#9c2d7b]">
              {esAdmin
                ? "La venta quedará anulada y se devolverá el stock de los productos. Esta acción no se puede deshacer."
                : "La propietaria revisará tu solicitud. La venta sigue confirmada hasta que ella la apruebe."}
            </p>

            <div>
              <label htmlFor="motivo-anulacion" className={etiqueta}>
                Motivo
              </label>
              <textarea
                id="motivo-anulacion"
                ref={motivoRef}
                rows={3}
                maxLength={MOTIVO_MAXIMO}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: La clienta se arrepintió del servicio"
                className="w-full cursor-text resize-none rounded-lg border border-[#e6b8d4] bg-white px-3 py-2 text-base text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30"
              />
              <div className="flex justify-between gap-3 text-sm font-medium text-[#9c2d7b]">
                <span>{!motivoValido && `Escribe al menos ${MOTIVO_MINIMO} letras.`}</span>
                <span>
                  {motivo.length}/{MOTIVO_MAXIMO}
                </span>
              </div>
            </div>

            {errorMotivo && <p className="text-base font-medium text-[#b5368f]">{errorMotivo}</p>}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#f0cfe3] px-6 py-4">
            <button
              type="button"
              onClick={cerrarAnulacion}
              disabled={enviandoAnulacion}
              className="h-12 cursor-pointer rounded-lg border border-gray-300 bg-white px-5 text-base font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={confirmarAnulacion}
              disabled={enviandoAnulacion || !motivoValido}
              className="h-12 cursor-pointer rounded-lg bg-[#b5368f] px-6 text-base font-semibold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviandoAnulacion
                ? esAdmin
                  ? "Anulando..."
                  : "Enviando..."
                : esAdmin
                  ? "Sí, anular venta"
                  : "Enviar solicitud"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}