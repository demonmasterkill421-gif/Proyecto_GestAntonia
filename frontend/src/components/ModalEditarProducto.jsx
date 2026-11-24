import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ajustarStock, editarInventario } from "../api/inventario.api";

// Saca un mensaje legible de la respuesta de error de Django.
function mensajeDeError(err) {
  const datos = err.response?.data;
  if (!datos) return "No se pudo conectar con el servidor. Intenta nuevamente.";
  if (datos.detail) return datos.detail;
  const [campo, mensajes] = Object.entries(datos)[0] ?? [];
  if (campo) return `${campo}: ${Array.isArray(mensajes) ? mensajes[0] : mensajes}`;
  return "No se pudieron guardar los cambios.";
}
// Motivos que la dueña puede elegir: cambian si se suma o se resta stock.
// (Venta, Uso en servicio, Anulación y Registro inicial los pone el sistema solo.)
function motivosDelAjuste(cantidad) {
  if (cantidad > 0) {
    return [["COMPRA", "Compra / reposición"], ["CORRECCION", "Corrección de conteo"]];
  }
  return [["DANADO", "Producto dañado o vencido"], ["CORRECCION", "Corrección de conteo"]];
}
export function ModalEditarProducto({ registro, onCerrar, onGuardado }) {
  const ventana = useRef(null);

  // Datos que se muestran en el formulario.
  const [datos, setDatos] = useState({
    nombre: registro.producto,
    marca: registro.marca || "",
    tipo: registro.tipo,
    precio: registro.precio,
    stock_minimo: registro.stock_minimo,
    descripcion: registro.descripcion || "",
    activo: registro.activo ?? true,
  });
  // Unidades a sumar (reponer) o restar (descontar). 0 = no cambia el stock.
  const [ajuste, setAjuste] = useState("");
    // Motivo del ajuste: obligatorio si se cambia el stock
  const [motivoAjuste, setMotivoAjuste] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Abre la ventana cuando aparece este componente.
  useEffect(() => {
    const modal = ventana.current;
    modal.showModal();
  }, []);

  // Actualiza solamente el campo que estamos escribiendo.
  function cambiarCampo(evento) {
    const { name, value, type, checked } = evento.target;
    setDatos({
      ...datos,
      [name]: type === "checkbox" ? checked : value,
    });
  }

  function cerrarVentana() {
    ventana.current.close();
  }

  // Solo se envían los campos que cambiaron.
  function camposModificados() {
    const originales = {
      nombre: registro.producto,
      marca: registro.marca || "",
      tipo: registro.tipo,
      precio: registro.precio,
      stock_minimo: registro.stock_minimo,
      descripcion: registro.descripcion || "",
      activo: registro.activo ?? true,
    };
    const cambios = {};
    for (const campo of Object.keys(originales)) {
      let valor = datos[campo];
      if (campo === "precio" || campo === "stock_minimo") valor = Number(valor);
      if (campo === "nombre" || campo === "marca") valor = valor.trim();
      if (valor !== originales[campo]) cambios[campo] = valor;
    }
    return cambios;
  }

  async function guardar(evento) {
    evento.preventDefault();
    setError("");

    const cambios = camposModificados();
    const cantidad = ajuste === "" ? 0 : Number(ajuste);

    if (!Number.isInteger(cantidad)) {
      setError("La cantidad a reponer debe ser un número entero.");
      return;
    }
    if (registro.cantidad + cantidad < 0) {
      setError(`No puedes descontar ${-cantidad}: solo hay ${registro.cantidad} en stock.`);
      return;
    }
        // El motivo tiene que ser uno de los que corresponden a sumar o a restar
    const motivoValido = motivosDelAjuste(cantidad).some(([codigo]) => codigo === motivoAjuste);
    if (cantidad !== 0 && !motivoValido) {
      setError("Elige el motivo del ajuste de stock.");
      return;
    }
    if (!Object.keys(cambios).length && cantidad === 0) {
      cerrarVentana();
      return;
    }

    setGuardando(true);
    try {
      if (Object.keys(cambios).length) await editarInventario(registro.id, cambios);
      if (cantidad !== 0) await ajustarStock(registro.id, cantidad, motivoAjuste);
      cerrarVentana();
      onGuardado?.();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  // Estilo compartido por los campos.
  const estilo =
    "mt-2 h-12 w-full rounded-lg border border-[#e6b8d4] bg-white px-3 text-base font-normal text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30";
  // Etiquetas en el mismo tono que los filtros de Ventas
  const etiqueta = "block text-base font-semibold text-[#9c2d7b]";

  const cantidadAjuste = Number(ajuste) || 0;
  const motivosPosibles = motivosDelAjuste(cantidadAjuste);
  return (
    <dialog
      ref={ventana}
      onClose={onCerrar}
      aria-labelledby="titulo-editar"
      className="fixed inset-0 m-auto max-h-[90vh] w-11/12 max-w-2xl overflow-y-auto rounded-3xl bg-white p-0 text-[#1f1218] shadow-2xl backdrop:bg-black/40"
    >
      <div className="sticky top-0 z-10 border-b border-[#f0cfe3] bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <h2 id="titulo-editar" className="text-2xl font-bold text-[#1f1218]">
            Editar producto
          </h2>
          <button
            type="button"
            onClick={cerrarVentana}
            disabled={guardando}
            aria-label="Cerrar"
            className="ml-auto cursor-pointer rounded-full p-2 text-[#1f1218] hover:bg-[#f7e3f1] hover:text-[#b5368f]"
          >
            <X size={24} />
          </button>
        </div>

        <p className="mt-1 text-base text-[#9c2d7b]">
          Los datos del producto se aplican en todos los locales. El stock y
          el stock mínimo son solo de {registro.local}.
        </p>
      </div>

      <form onSubmit={guardar} className="space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className={etiqueta}>
            Nombre del producto
            <input
              name="nombre"
              value={datos.nombre}
              onChange={cambiarCampo}
              maxLength={100}
              required
              className={estilo}
            />
          </label>

          <label className={etiqueta}>
            Marca
            <input
              name="marca"
              value={datos.marca}
              onChange={cambiarCampo}
              maxLength={100}
              className={estilo}
            />
          </label>

          <label className={etiqueta}>
            Tipo
            <select
              name="tipo"
              value={datos.tipo}
              onChange={cambiarCampo}
              className={estilo}
            >
              <option value="INSUMO">INSUMO</option>
              <option value="VENTA">VENTA</option>
            </select>
          </label>

          <label className={etiqueta}>
            Local
            <input
              value={registro.local}
              readOnly
              className={`${estilo} !bg-[#fbeef6] text-[#9c2d7b]`}
            />
          </label>

          {/* El precio aparece solamente para productos de venta. */}
          {datos.tipo === "VENTA" && (
            <label className={etiqueta}>
              Precio (CLP)
              <input
                type="number"
                name="precio"
                value={datos.precio}
                onChange={cambiarCampo}
                min="0"
                step="1"
                required
                className={estilo}
              />
            </label>
          )}

          <label className={etiqueta}>
            Stock mínimo
            <input
              type="number"
              name="stock_minimo"
              value={datos.stock_minimo}
              onChange={cambiarCampo}
              min="0"
              max="10000"
              step="1"
              required
              className={estilo}
            />
          </label>
        </div>

        {/* Reponer stock: no se escribe la cantidad final, sino cuántas
            unidades entran o salen, para que quede el movimiento. */}
        <fieldset className="rounded-2xl border border-[#e6b8d4] bg-[#fbeef6] p-4">
          <legend className="rounded-full bg-[#b5368f] px-3 py-0.5 text-base font-semibold text-white">
            Reponer stock
          </legend>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className={etiqueta}>
              Stock actual
              <input
                value={registro.cantidad}
                readOnly
                className={`${estilo} !bg-[#fbeef6] text-[#9c2d7b]`}
              />
            </label>

            <label className={etiqueta}>
              Unidades a sumar
              <input
                type="number"
                value={ajuste}
                onChange={(e) => setAjuste(e.target.value)}
                min={-registro.cantidad}
                max="10000"
                step="1"
                placeholder="Ej.: 10"
                className={estilo}
              />
            </label>
          </div>

          <p className="mt-3 text-base text-[#9c2d7b]">
            Usa un número negativo para descontar (por ejemplo, un producto
            dañado).
            {cantidadAjuste !== 0 && (
              <> Quedarán <strong>{registro.cantidad + cantidadAjuste}</strong> unidades.</>
            )}
          </p>
                    {/* Motivo: solo aparece cuando se escribe una cantidad */}
          {cantidadAjuste !== 0 && (
            <div role="radiogroup" aria-label="Motivo del ajuste" className="mt-4">
              <p className={etiqueta}>Motivo del ajuste</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {motivosPosibles.map(([codigo, texto]) => {
                  const activo = motivoAjuste === codigo;
                  return (
                    <button
                      key={codigo}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => setMotivoAjuste(codigo)}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-base font-semibold ${
                        activo
                          ? "border-[#b5368f] bg-[#b5368f] text-white"
                          : "border-[#e6b8d4] bg-white text-[#b5368f] hover:bg-[#f7e3f1]"
                      }`}
                    >
                      {texto}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </fieldset>

        <label className={etiqueta}>
          Descripción
          <textarea
            name="descripcion"
            value={datos.descripcion}
            onChange={cambiarCampo}
            rows={3}
            className={`${estilo} h-auto py-2`}
          />
        </label>

        <label className="flex items-center gap-2 text-base font-semibold text-[#9c2d7b]">
          <input
            type="checkbox"
            name="activo"
            checked={datos.activo}
            onChange={cambiarCampo}
            className="h-5 w-5 accent-[#b5368f]"
          />
          Producto activo
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-800">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-[#f0cfe3] pt-5">
          <button
            type="button"
            onClick={cerrarVentana}
            disabled={guardando}
            className="h-11 cursor-pointer rounded-lg border border-[#b5368f] bg-white px-5 text-base font-semibold text-[#b5368f] hover:bg-[#f7e3f1] disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={guardando}
            className="h-11 cursor-pointer rounded-lg bg-[#b5368f] px-5 text-base font-semibold text-white shadow-md shadow-[#b5368f]/30 transition hover:bg-[#9c2d7b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
