import { useState } from "react";
import { Sidebar } from "../../../components/Sidebar";
import { PanelServicio } from "../../../components/PanelServicio";
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

export function RegistrarVenta() {
  useTitulo("Registrar venta");
  const [servicios, setServicios] = useState([]);
  const [descripcion, setDescripcion] = useState("");
  const [tipoDescuento, setTipoDescuento] = useState("%"); // "%" o "CLP"
  const [valorDescuento, setValorDescuento] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

  const subtotal = servicios.reduce((suma, s) => suma + s.precio, 0);
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

  const cambiarTipo = (tipo) => {
    setTipoDescuento(tipo);
    setValorDescuento("");
  };

  const reiniciar = () => {
    setServicios([]);
    setDescripcion("");
    setTipoDescuento("%");
    setValorDescuento("");
    setMetodoPago("");
  };

  const confirmar = async () => {
    if (!listo || enviando) return;
    setEnviando(true);
    setErrorEnvio("");

    // El backend recibe el descuento solo en porcentaje (0 a 100).
    const porcentaje =
      tipoDescuento === "%" ? valor : Number(((valor / subtotal) * 100).toFixed(2));

    const datos = {
      detalles: servicios.map((s) => ({
        item: s.id,
        cantidad: 1,
        trabajador: s.especialistas[0].id,
      })),
      metodo_pago: metodoPago,
      descuento: porcentaje,
      descripcion: descripcion.trim(),
    };

    try {
      await registrarVenta(datos);
      reiniciar();
      setMensaje(`Venta registrada correctamente por ${clp(total)}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => setMensaje(""), 5000);
    } catch (err) {
      console.log("Error al registrar:", err.response?.data);
      setErrorEnvio(
        "No se pudo registrar la venta: " + JSON.stringify(err.response?.data ?? "sin conexión con el servidor"),
      );
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

  return (
    <Sidebar>
      <h1 className="mb-6 text-3xl font-bold text-[#1f1218]">Registrar venta</h1>

      {mensaje && (
        <p className="mb-6 rounded-2xl border border-green-200 bg-green-100 px-5 py-4 text-lg font-medium text-green-800">
          {mensaje}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <SeccionPlegable
            numero={1}
            titulo="Servicio"
            detalle={servicios.length > 0 ? `${servicios.length} agregado(s)` : ""}
            abiertaInicial
          >
            <PanelServicio servicios={servicios} setServicios={setServicios} />
          </SeccionPlegable>

          <SeccionPlegable numero={2} titulo="Productos">
            <p className="text-base text-gray-500">Próximamente.</p>
          </SeccionPlegable>

          <SeccionPlegable numero={3} titulo="Insumos">
            <p className="text-base text-gray-500">Próximamente.</p>
          </SeccionPlegable>

          <SeccionPlegable numero={4} titulo="Método de pago" detalle={metodoElegido?.etiqueta ?? ""}>
            <div className="flex flex-col gap-5">
              <div>
                <label className="mb-1 block text-base font-medium text-[#1f1218]">Método de pago *</label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="h-12 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-lg"
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
                <label className="mb-1 block text-base font-medium text-[#1f1218]">
                  Descripción de la venta (opcional)
                </label>
                <textarea
                  rows={3}
                  maxLength={DESCRIPCION_MAXIMA}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: Clienta frecuente, pidió diseño especial"
                  className="w-full cursor-text resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-lg"
                />
                <p className="text-right text-sm text-gray-500">
                  {descripcion.length}/{DESCRIPCION_MAXIMA}
                </p>
              </div>
            </div>
          </SeccionPlegable>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:-m-2 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:p-2">
          <aside className={tarjeta}>
            <h2 className="text-2xl font-bold text-[#1f1218]">Resumen de la venta</h2>

            <ul className="mt-4 flex flex-col gap-3">
              {servicios.length === 0 && (
                <li className="text-base text-gray-500">Aún no has agregado nada.</li>
              )}
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
            </ul>

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
            {errorEnvio && (
              <p className="mb-4 text-base font-medium text-[#b5368f]">{errorEnvio}</p>
            )}

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
                onClick={confirmar}
                disabled={!listo || enviando}
                className="h-14 cursor-pointer rounded-lg bg-[#b5368f] text-lg font-semibold text-white hover:bg-[#9c2d7b] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#b5368f]"
              >
                {enviando ? "Registrando..." : "Confirmar venta"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </Sidebar>
  );
}