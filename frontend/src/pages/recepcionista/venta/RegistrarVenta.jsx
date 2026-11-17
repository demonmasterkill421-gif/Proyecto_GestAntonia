import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, User, ShoppingBag, Droplets, CreditCard, ChevronDown, ClipboardCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Sidebar } from "../../../components/Sidebar";
import { PanelServicio } from "../../../components/PanelServicio";
import { PanelItems } from "../../../components/PanelItems";
import { SeccionPlegable } from "../../../components/SeccionPlegable";
import { useTitulo } from "../../../hooks/useTitulo";
import { registrarVenta } from "../../../api/ventas.api";

const clp = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

const METODOS_PAGO = [
  { valor: "EFECTIVO", etiqueta: "Efectivo" },
  { valor: "DEBITO", etiqueta: "Débito" },
  { valor: "CREDITO", etiqueta: "Crédito" },
  { valor: "TRANSFER", etiqueta: "Transferencia" },
];

const DESCRIPCION_MAXIMA = 200;

// "1 servicio" / "3 servicios"
const contar = (n, singular, plural) => (n > 0 ? `${n} ${n === 1 ? singular : plural}` : "");

const primerMensaje = (valor) => {
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) return valor.map(primerMensaje).find(Boolean) ?? "";
  if (valor && typeof valor === "object") return Object.values(valor).map(primerMensaje).find(Boolean) ?? "";
  return "";
};

export function RegistrarVenta() {
  useTitulo("Registrar venta");
  const navigate = useNavigate();
  const [servicios, setServicios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [descripcion, setDescripcion] = useState("");
  const [tipoDescuento, setTipoDescuento] = useState("%"); // % o CLP
  const [valorDescuento, setValorDescuento] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState(true);
  const [confirmando, setConfirmando] = useState(false); // Visualizar panel de confirmar ventas
  const botonVolver = useRef(null);


  const subtotal =
    servicios.reduce((suma, s) => suma + s.precio, 0) +
    productos.reduce((suma, p) => suma + p.precio * p.cantidad, 0);
  const valor = Number(valorDescuento) || 0;

  let errorDescuento = "";
  if (tipoDescuento === "%" && valor > 100) errorDescuento = "El descuento no puede pasar de 100%";
  if (tipoDescuento === "CLP" && valor > subtotal) errorDescuento = "El descuento no puede ser mayor al subtotal";

  const descuento = errorDescuento
    ? 0
    : tipoDescuento === "%"
      ? Math.round((subtotal * valor) / 100)
      : valor;
  const total = subtotal - descuento;

  const pendientes = [];
  if (servicios.length === 0) pendientes.push("Agrega al menos un servicio");
  if (servicios.some((s) => s.precioVariable)) pendientes.push("El servicio «Otro» aún no se puede registrar");
  if (errorDescuento) pendientes.push("Corrige el descuento");
  if (!metodoPago) pendientes.push("Selecciona un método de pago");
  const listo = pendientes.length === 0;

  const metodoElegido = METODOS_PAGO.find((m) => m.valor === metodoPago);
  const hayItems = servicios.length > 0 || productos.length > 0 || insumos.length > 0;
  const totalItems = servicios.length + productos.length + insumos.length;

  const cambiarTipo = (tipo) => {
    setTipoDescuento(tipo);
    setValorDescuento("");
  };

  const reiniciar = () => {
    setServicios([]);
    setProductos([]);
    setInsumos([]);
    setDescripcion("");
    setTipoDescuento("%");
    setValorDescuento("");
    setMetodoPago("");
  };

  //Ventana de confirmación
  const abrirConfirmacion = () => {
    if (!listo || enviando) return;
    setConfirmando(true);
  };

  const cerrarConfirmacion = () => {
    if (enviando) return; // mientras se registra, no se puede cerrar
    setConfirmando(false);
  };

  // Ventana abierta: Escape la cierra, la página de atrás no se desplaza
  // y el foco queda en "Volver" (así un Enter sin querer no registra la venta)
  useEffect(() => {
    if (!confirmando) return;
    const tecla = (e) => {
      if (e.key === "Escape" && !enviando) setConfirmando(false);
    };
    document.addEventListener("keydown", tecla);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = setTimeout(() => botonVolver.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = anterior;
      clearTimeout(id);
    };
  }, [confirmando, enviando]);

  const confirmar = async () => { //Confirma la venta y 
    if (!listo || enviando) return;
    setEnviando(true);

    // El backend recibe el descuento solo en porcentaje (0 a 100).
    const porcentaje =
      tipoDescuento === "%" ? valor : Number(((valor / subtotal) * 100).toFixed(2));

    const datos = {
      detalles: [
        ...servicios.map((s) => ({
          item: s.id,
          cantidad: 1,
          trabajador: s.especialistas[0].id,
        })),
        ...productos.map((p) => ({ item: p.id, cantidad: p.cantidad })),
        ...insumos.map((i) => ({ item: i.id, cantidad: i.cantidad })),
      ],
      metodo_pago: metodoPago,
      descuento: porcentaje,
      descripcion: descripcion.trim(),
    };

    try {
      await registrarVenta(datos);
      setConfirmando(false);
      reiniciar();
      toast.success(`Venta registrada por ${clp(total)}`);
      navigate("/recepcionista/ventas");
    } catch (err) {
      console.log("Error al registrar:", err.response?.data);
      setConfirmando(false);
      const motivo = err.response ? primerMensaje(err.response.data) : "sin conexión con el servidor";
      toast.error(motivo ? `No se pudo registrar la venta: ${motivo}` : "No se pudo registrar la venta");
    } finally {
      setEnviando(false);
    }
  };

  const botonTipo = (tipo) =>
    `h-12 w-14 cursor-pointer text-lg font-semibold ${
      tipoDescuento === tipo ? "bg-[#b5368f] text-white" : "bg-white text-[#b5368f] hover:bg-[#fbeef6]"
    }`;

  const tarjeta =
    "rounded-3xl border border-[#e6b8d4] bg-[#f7e3f1] p-6 shadow-lg shadow-[#b5368f]/15";

  const etiqueta = "mb-1 block text-base font-semibold text-[#9c2d7b]";

  const campo =
    "w-full rounded-lg border border-[#e6b8d4] bg-white px-3 text-lg text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30";

  return (
    <Sidebar>
      {/* Título con botón para volver a la lista de ventas */}
      <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-4">
        <Link
          to="/recepcionista/ventas"
          aria-label="Volver a ventas"
          title="Volver a ventas"
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[#b5368f] bg-white px-3 text-base font-semibold text-[#b5368f] hover:bg-[#fbeef6] sm:px-4"
        >
          <ArrowLeft size={22} />
          <span className="hidden sm:inline">Volver a ventas</span>
        </Link>
        <h1 className="text-3xl font-bold text-[#1f1218]">Registrar venta</h1>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <SeccionPlegable
            icono={User}
            titulo="Servicio"
            detalle={contar(servicios.length, "servicio", "servicios")}
            abiertaInicial
          >
            <PanelServicio servicios={servicios} setServicios={setServicios} />
          </SeccionPlegable>

          <SeccionPlegable
            icono={ShoppingBag}
            titulo="Productos"
            detalle={contar(productos.length, "producto", "productos")}
          >
            <PanelItems tipo="VENTA" items={productos} setItems={setProductos} />
          </SeccionPlegable>

          <SeccionPlegable
            icono={Droplets}
            titulo="Insumos"
            detalle={contar(insumos.length, "insumo", "insumos")}
          >
            <PanelItems tipo="INSUMO" items={insumos} setItems={setInsumos} />
          </SeccionPlegable>

          <SeccionPlegable icono={CreditCard} titulo="Método de pago" detalle={metodoElegido?.etiqueta ?? ""}>
            <div className="flex flex-col gap-5 rounded-2xl border border-[#e6b8d4] bg-white p-5 shadow-sm shadow-[#b5368f]/10">
              <p className="flex items-center gap-2 text-lg font-bold text-[#b5368f]">
                <CreditCard size={20} />
                Pago de la venta
              </p>

              <div>
                <label className={etiqueta}>Método de pago *</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className={`${campo} h-12 cursor-pointer`}
                >
                  <option value="">Selecciona un método de pago</option>
                  {METODOS_PAGO.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.etiqueta}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={etiqueta}>Descripción de la venta (opcional)</label>
                <textarea
                  rows={3}
                  maxLength={DESCRIPCION_MAXIMA}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: Clienta frecuente, pidió diseño especial"
                  className={`${campo} cursor-text resize-none py-2`}
                />
                <p className="text-right text-sm font-medium text-[#9c2d7b]">
                  {descripcion.length}/{DESCRIPCION_MAXIMA}
                </p>
              </div>
            </div>
          </SeccionPlegable>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:-m-2 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:p-2">
          <aside className={tarjeta}>
            <button
              type="button"
              onClick={() => setResumenAbierto(!resumenAbierto)}
              aria-expanded={resumenAbierto}
              className="flex w-full cursor-pointer items-center gap-3 text-left"
            >
              <h2 className="flex-1 text-2xl font-bold text-[#1f1218]">Resumen de la venta</h2>
              {!resumenAbierto && hayItems && (
                <span className="text-base font-medium text-[#b5368f]">{contar(totalItems, "ítem", "ítems")}</span>
              )}
              <ChevronDown
                size={24}
                className={`shrink-0 text-[#b5368f] transition-transform duration-300 ${
                  resumenAbierto ? "rotate-180" : ""
                }`}
              />
            </button>

            <div
              inert={!resumenAbierto}
              className={`grid transition-all duration-300 ease-in-out ${
                resumenAbierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <ul className="mt-4 flex flex-col gap-3">
                  {!hayItems && <li className="text-base text-gray-500">Aún no has agregado nada.</li>}

                  {servicios.map((s) => (
                    <li key={s.uid} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[#b5368f]">{s.nombre}</p>
                        <p className="text-base text-gray-600">
                          {s.especialistas.map((e) => e.nombre).join(", ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg text-[#1f1218]">{clp(s.precio)}</span>
                        <button
                          type="button"
                          onClick={() => setServicios(servicios.filter((x) => x.uid !== s.uid))}
                          className="cursor-pointer text-lg text-gray-500 hover:text-red-600"
                          aria-label="Quitar"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}

                  {productos.map((p) => (
                    <li key={`p-${p.id}`} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[#b5368f]">{p.nombre}</p>
                        <p className="text-base text-gray-600">Producto · x{p.cantidad}</p>
                      </div>
                      <span className="text-lg text-[#1f1218]">{clp(p.precio * p.cantidad)}</span>
                    </li>
                  ))}

                  {insumos.map((i) => (
                    <li key={`i-${i.id}`} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[#b5368f]">{i.nombre}</p>
                        <p className="text-base text-gray-600">Insumo · x{i.cantidad}</p>
                      </div>
                      <span className="text-base text-gray-500">Sin costo</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-1 border-t border-[#ecc7de] pt-4 text-lg text-[#1f1218]">
              <p className="flex justify-between">
                <span>Subtotal</span>
                <span>{clp(subtotal)}</span>
              </p>
              <p className="flex justify-between">
                <span>
                  Descuento{tipoDescuento === "%" && valor > 0 && !errorDescuento ? ` (${valor}%)` : ""}
                </span>
                <span>{descuento > 0 ? `- ${clp(descuento)}` : clp(0)}</span>
              </p>
              {metodoElegido && (
                <p className="flex justify-between">
                  <span>Pago</span>
                  <span>{metodoElegido.etiqueta}</span>
                </p>
              )}
              <p className="mt-2 flex justify-between text-3xl font-bold">
                <span>Total</span>
                <span>{clp(total)}</span>
              </p>
            </div>
          </aside>

          <section className={tarjeta}>
            <label className="mb-1 block text-base font-medium text-[#1f1218]">Descuento</label>
            <div className="flex gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={tipoDescuento === "%" ? 3 : 7}
                value={valorDescuento}
                onChange={(e) => setValorDescuento(e.target.value.replace(/\D/g, ""))}
                placeholder={tipoDescuento === "%" ? "Ej: 10" : "Ej: 5000"}
                className={`h-12 w-full cursor-text rounded-lg border bg-white px-3 text-lg ${
                  errorDescuento ? "border-[#b5368f]" : "border-gray-200"
                }`}
              />
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-gray-200">
                <button type="button" onClick={() => cambiarTipo("%")} className={botonTipo("%")}>
                  %
                </button>
                <button type="button" onClick={() => cambiarTipo("CLP")} className={botonTipo("CLP")}>
                  $
                </button>
              </div>
            </div>
            {errorDescuento && (
              <p className="mt-1 text-base font-medium text-[#b5368f]">{errorDescuento}</p>
            )}
          </section>

          <section className={tarjeta}>
            {listo ? (
              <p className="mb-4 text-base font-medium text-green-700">Todo listo para confirmar</p>
            ) : (
              <ul className="mb-4 flex flex-col gap-1">
                {pendientes.map((p) => (
                  <li key={p} className="text-base font-medium text-[#b5368f]">
                    • {p}
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={reiniciar}
                className="h-14 cursor-pointer rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={abrirConfirmacion}
                disabled={!listo || enviando}
                className="h-14 cursor-pointer rounded-lg bg-[#b5368f] text-lg font-semibold text-white hover:bg-[#9c2d7b] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#b5368f]"
              >
                Confirmar venta
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Ventana emergente: ¿Confirmar la venta? (siempre montada para poder animarla) */}
      <div
        inert={!confirmando}
        onClick={cerrarConfirmacion}
        className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200 ${
          confirmando ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-confirmar"
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl transition-all duration-300 ease-out ${
            confirmando ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-95 opacity-0"
          }`}
        >
          <div className="flex flex-col items-center text-center">
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#d61f9a] to-[#a8238f] text-white shadow-lg shadow-[#b5368f]/30 transition-transform duration-500 delay-100 ease-out ${
                confirmando ? "scale-100" : "scale-50"
              }`}
            >
              <ClipboardCheck size={32} />
            </span>

            <h2 id="titulo-confirmar" className="mt-4 text-2xl font-bold text-[#1f1218]">
              ¿Confirmar la venta?
            </h2>
            <p className="mt-1 text-base text-gray-600">
              Revisa los datos. Una vez registrada, la venta no se puede modificar.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-1 rounded-2xl bg-[#fbeef6] p-4 text-lg text-[#1f1218]">
            <p className="flex justify-between">
              <span>Ítems</span>
              <span>{totalItems}</span>
            </p>
            {metodoElegido && (
              <p className="flex justify-between">
                <span>Pago</span>
                <span>{metodoElegido.etiqueta}</span>
              </p>
            )}
            {descuento > 0 && (
              <p className="flex justify-between">
                <span>Descuento</span>
                <span>- {clp(descuento)}</span>
              </p>
            )}
            <p className="mt-1 flex justify-between border-t border-[#ecc7de] pt-2 text-2xl font-bold text-[#b5368f]">
              <span>Total</span>
              <span>{clp(total)}</span>
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              ref={botonVolver}
              type="button"
              onClick={cerrarConfirmacion}
              disabled={enviando}
              className="h-12 cursor-pointer rounded-lg border border-[#b5368f] bg-white text-lg font-semibold text-[#b5368f] hover:bg-[#fbeef6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={enviando}
              className="h-12 cursor-pointer rounded-lg bg-[#b5368f] text-lg font-semibold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? "Registrando..." : "Sí, confirmar"}
            </button>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}