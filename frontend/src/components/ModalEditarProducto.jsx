import { useEffect, useRef, useState } from "react";

export function ModalEditarProducto({ registro, onCerrar }) {
  const ventana = useRef(null);

  // Datos que se muestran en el formulario.
  const [datos, setDatos] = useState({
    nombre: registro.producto,
    marca: registro.marca || "",
    tipo: registro.tipo,
    precio: registro.precio,
    cantidad: registro.cantidad,
    stock_minimo: registro.stock_minimo,
    descripcion: registro.descripcion || "",
  });

  // Abre la ventana cuando aparece este componente.
  useEffect(() => {
    const modal = ventana.current;
    modal.showModal();
  }, []);

  // Actualiza solamente el campo que estamos escribiendo.
  function cambiarCampo(evento) {
    const nombre = evento.target.name;
    const valor = evento.target.value;

    setDatos({
      ...datos,
      [nombre]: valor,
    });
  }

  function cerrarVentana() {
    ventana.current.close();
  }

  // Estilo compartido por los campos.
  const estilo =
    "mt-2 w-full rounded-lg border border-gray-300 px-3 py-2";

  return (
    <dialog
      ref={ventana}
      onClose={onCerrar}
      aria-labelledby="titulo-editar"
      className="fixed inset-0 m-auto max-h-[90vh] w-11/12 max-w-2xl overflow-y-auto rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="bg-[#fbeef6] p-6">
        <h2
          id="titulo-editar"
          className="text-2xl font-bold text-[#682653]"
        >
          Editar producto
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Información del producto en el inventario.
        </p>
      </div>

      <div className="space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label>
            Nombre del producto
            <input
              name="nombre"
              value={datos.nombre}
              onChange={cambiarCampo}
              maxLength={100}
              className={estilo}
            />
          </label>

          <label>
            Marca
            <input
              name="marca"
              value={datos.marca}
              onChange={cambiarCampo}
              maxLength={100}
              className={estilo}
            />
          </label>

          <label>
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

          <label>
            Local
            <input
              value={registro.local}
              readOnly
              className={`${estilo} bg-gray-100`}
            />
          </label>

          {/* El precio aparece solamente para insumos. */}
          {datos.tipo === "VENTA" && (
            <label>
              Precio (CLP)
              <input
                type="number"
                name="precio"
                value={datos.precio}
                onChange={cambiarCampo}
                min="0"
                step="1"
                className={estilo}
              />
            </label>
          )}

          <label>
            Stock actual
            <input
                type="number"
                name="cantidad"
                value={datos.cantidad}
                onChange={cambiarCampo}
                readOnly={datos.tipo !== "INSUMO"}
                min="0"
                max="10000"
                step="1"
                className={estilo}
            />
          </label>

          <label>
            Stock mínimo
            <input
              type="number"
              name="stock_minimo"
              value={datos.stock_minimo}
              onChange={cambiarCampo}
              min="0"
              max="10000"
              step="1"
              className={estilo}
            />
          </label>
        </div>

        <label className="block">
          Descripción
          <textarea
            name="descripcion"
            value={datos.descripcion}
            onChange={cambiarCampo}
            rows={3}
            className={estilo}
          />
        </label>

        <p className="text-sm text-gray-500">
          Vista previa: los cambios todavía no se guardan.
        </p>

        <div className="flex justify-end gap-3 border-t pt-5">
          <button
            type="button"
            onClick={cerrarVentana}
            className="rounded-lg border border-[#b5368f] px-5 py-2 font-semibold text-[#b5368f]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg bg-[#b5368f] px-5 py-2 font-semibold text-white opacity-50"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </dialog>
  );
}