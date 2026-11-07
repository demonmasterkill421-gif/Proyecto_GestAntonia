import { useState } from "react";
import { Droplets, Minus, Plus, ShoppingBag } from "lucide-react";
import { useDatos } from "../hooks/useDatos";
import { obtenerProductosVenta } from "../api/ventas.api";

const clp = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

// tipo: "VENTA" (productos que se cobran) o "INSUMO" (se consumen, no se cobran)
export function PanelItems({ tipo, items, setItems }) {
  const esInsumo = tipo === "INSUMO";
  const nombreTipo = esInsumo ? "insumo" : "producto";
  const Icono = esInsumo ? Droplets : ShoppingBag;
  const { datos, cargando, error } = useDatos(obtenerProductosVenta, { cadaMs: 60000 });

  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [aviso, setAviso] = useState("");

  const disponibles = (datos ?? []).filter((p) => p.tipo === tipo);
  const productoElegido = disponibles.find((p) => String(p.id) === String(elegido));

  const limpiar = () => {
    setElegido("");
    setCantidad(1);
    setAviso("");
  };

  const cerrar = () => {
    limpiar();
    setAbierto(false);
  };

  const guardar = () => {
    if (!productoElegido) {
      setAviso(`Selecciona un ${nombreTipo}`);
      return;
    }
    const existente = items.find((x) => x.id === productoElegido.id);
    const nuevaCantidad = (existente?.cantidad ?? 0) + cantidad;
    if (productoElegido.stock != null && nuevaCantidad > productoElegido.stock) {
      setAviso(
        `Stock insuficiente: hay ${productoElegido.stock}` +
          (existente ? ` y ya agregaste ${existente.cantidad}` : ""),
      );
      return;
    }
    if (existente) {
      setItems(items.map((x) => (x.id === productoElegido.id ? { ...x, cantidad: nuevaCantidad } : x)));
    } else {
      setItems([
        ...items,
        {
          id: productoElegido.id,
          nombre: productoElegido.nombre,
          precio: productoElegido.precio,
          stock: productoElegido.stock,
          cantidad,
        },
      ]);
    }
    cerrar();
  };

  const cambiarCantidad = (id, delta) => {
    setItems(
      items.map((x) =>
        x.id === id ? { ...x, cantidad: Math.max(1, Math.min(x.stock ?? Infinity, x.cantidad + delta)) } : x,
      ),
    );
  };

  const quitar = (id) => setItems(items.filter((x) => x.id !== id));

  const botonCantidad =
    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#e6b8d4] bg-white text-[#b5368f] hover:bg-[#fbeef6] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white";

  const campo =
    "h-12 w-full cursor-pointer rounded-lg border border-[#e6b8d4] bg-white px-3 text-lg text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30";

  const etiqueta = "mb-1 block text-base font-semibold text-[#9c2d7b]";

  return (
    <div className="flex flex-col gap-4">
      <ul className={items.length > 0 ? "flex flex-col gap-2" : "hidden"}>
        {items.map((x) => (
          <li
            key={x.id}
            className="flex flex-col gap-3 rounded-xl border-l-4 border-[#b5368f] bg-white px-4 py-3 shadow-sm shadow-[#b5368f]/10 sm:flex-row sm:items-center sm:justify-between"
          >
            {/* Ícono, nombre y precio unitario */}
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f7e3f1] text-[#b5368f]">
                <Icono size={20} />
              </span>
              <div className="min-w-0">
                <p className="break-words text-lg font-bold text-[#b5368f]">{x.nombre}</p>
                <p className="text-base font-medium text-[#9c2d7b]">{esInsumo ? "Sin costo" : `${clp(x.precio)} c/u`}</p>
              </div>
            </div>

            {/* Cantidad, total y quitar: en el celular van en una segunda línea */}
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(x.id, -1)}
                  disabled={x.cantidad <= 1}
                  className={botonCantidad}
                  aria-label="Restar uno"
                >
                  <Minus size={18} />
                </button>
                <span className="w-6 text-center text-lg font-bold text-[#9c2d7b]">{x.cantidad}</span>
                <button
                  type="button"
                  onClick={() => cambiarCantidad(x.id, 1)}
                  disabled={x.stock != null && x.cantidad >= x.stock}
                  className={botonCantidad}
                  aria-label="Sumar uno"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!esInsumo && (
                  <span className="text-right text-lg font-bold text-[#9c2d7b] sm:w-24">
                    {clp(x.precio * x.cantidad)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => quitar(x.id)}
                  className="cursor-pointer rounded-full px-2 py-1 text-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                  aria-label="Quitar"
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#b5368f] text-lg font-semibold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b]"
        >
          <Plus size={22} />
          Agregar {nombreTipo}
        </button>
      )}

      <div
        inert={!abierto}
        className={`grid transition-all duration-300 ease-in-out ${
          abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-5 rounded-2xl border border-[#e6b8d4] bg-white p-5 shadow-sm shadow-[#b5368f]/10">
            <p className="flex items-center gap-2 text-lg font-bold text-[#b5368f]">
              <Icono size={20} />
              Nuevo {nombreTipo}
            </p>

            <div>
              <label className={etiqueta}>{esInsumo ? "Insumo" : "Producto"} *</label>
              <select
                value={elegido}
                onChange={(e) => {
                  setElegido(e.target.value);
                  setCantidad(1);
                  setAviso("");
                }}
                className={campo}
              >
                <option value="">{cargando ? "Cargando..." : `Selecciona un ${nombreTipo}`}</option>
                {disponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {esInsumo ? p.nombre : `${p.nombre} - ${clp(p.precio)}`}
                  </option>
                ))}
              </select>
              {productoElegido && productoElegido.stock != null && (
                <p className="mt-1 text-base font-medium text-[#b5368f]">
                  Stock disponible: {productoElegido.stock}
                </p>
              )}
              {error && <p className="mt-1 text-base text-[#b5368f]">{error}</p>}
            </div>

            <div>
              <label className={etiqueta}>Cantidad *</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  disabled={cantidad <= 1}
                  className={botonCantidad}
                  aria-label="Restar uno"
                >
                  <Minus size={18} />
                </button>
                <span className="w-8 text-center text-lg font-bold text-[#9c2d7b]">{cantidad}</span>
                <button
                  type="button"
                  onClick={() => setCantidad(cantidad + 1)}
                  disabled={productoElegido?.stock != null && cantidad >= productoElegido.stock}
                  className={botonCantidad}
                  aria-label="Sumar uno"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {aviso && <p className="text-base font-medium text-red-600">{aviso}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={guardar}
                className="h-12 cursor-pointer rounded-lg bg-[#b5368f] text-base font-semibold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b]"
              >
                Guardar {nombreTipo}
              </button>
              <button
                type="button"
                onClick={cerrar}
                className="h-12 cursor-pointer rounded-lg border border-[#b5368f] bg-white text-base font-semibold text-[#b5368f] hover:bg-[#fbeef6]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}