import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, History, Pencil } from "lucide-react";
import { ModalEditarProducto } from "./ModalEditarProducto";
import { ModalHistorial } from "./ModalHistorial";

const pesos = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

// Etiqueta de estado
function Estado({ bajo }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-base font-semibold ${
        bajo ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {bajo ? "Stock bajo" : "Disponible"}
    </span>
  );
}

// Etiqueta del tipo de producto
function Tipo({ tipo }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-[#fbeef6] px-2.5 py-0.5 text-sm font-semibold uppercase text-[#9c2d7b]">
      {tipo}
    </span>
  );
}

// Stock con una barrita que compara contra el mínimo
function Stock({ registro }) {
  const { cantidad, stock_minimo, bajo_minimo } = registro;
  // La barra se llena al doble del mínimo (o 10 si no hay mínimo)
  const tope = Math.max(stock_minimo * 2, 10);
  const porcentaje = Math.min(100, Math.round((cantidad / tope) * 100));
  return (
    <div className="min-w-[6.5rem]">
      <p className="text-base">
        <span className={`font-bold ${bajo_minimo ? "text-amber-700" : "text-[#1f1218]"}`}>{cantidad}</span>
        <span className="text-sm text-gray-500"> / mín. {stock_minimo}</span>
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#f7e3f1]">
        <div
          className={`h-full rounded-full ${bajo_minimo ? "bg-amber-500" : "bg-[#b5368f]"}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

// Convierte "2026-11-20" en una fecha local (sin desfase de zona horaria)
function leerFecha(texto) {
  const [anio, mes, dia] = texto.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

// Cuántos días pasaron desde esa fecha hasta hoy
function diasDesde(texto) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((hoy - leerFecha(texto)) / (1000 * 60 * 60 * 24));
}

function textoHace(dias) {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

function Movimiento({ valor, fecha }) {
  if (valor == null) return <span className="text-gray-500">Sin movimientos</span>;
  const entrada = valor > 0;
  const Icono = entrada ? ArrowUpRight : ArrowDownRight;
  return (
    <div>
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap font-medium ${
          entrada ? "text-emerald-700" : "text-amber-700"
        }`}
      >
        <Icono size={18} />
        {entrada ? `Entrada +${valor}` : `Salida ${valor}`}
      </span>
      {fecha && (
        <p className="whitespace-nowrap text-sm text-gray-500">
          {leerFecha(fecha).toLocaleDateString("es-CL")} · {textoHace(diasDesde(fecha))}
        </p>
      )}
    </div>
  );
}

function BotonEditar({ registro, onClick, completo = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Editar ${registro.producto} en ${registro.local}`}
      className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#b5368f] bg-white px-4 text-base font-semibold text-[#b5368f] hover:bg-[#f7e3f1] ${
        completo ? "w-full" : ""
      }`}
    >
      <Pencil size={18} />
      Editar
    </button>
  );
}
function BotonHistorial({ registro, onClick, completo = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ver historial de ${registro.producto} en ${registro.local}`}
      className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-base font-semibold text-[#9c2d7b] hover:bg-[#f7e3f1] ${
        completo ? "w-full border border-[#e6b8d4]" : ""
      }`}
    >
      <History size={18} />
      Historial
    </button>
  );
}
export function TablaInventario({ registros, onActualizado }) {
  const [productoEditar, setProductoEditar] = useState(null);
  const [productoHistorial, setProductoHistorial] = useState(null);

  const modal = productoEditar && (
    <ModalEditarProducto
      key={productoEditar.id}
      registro={productoEditar}
      onCerrar={() => setProductoEditar(null)}
      onGuardado={onActualizado}
    />
  );

  if (!registros.length) {
    return <p className="py-2 text-base font-medium text-[#9c2d7b]">No hay registros para estos filtros.</p>;
  }

  return (
    <>
      {/* Celular: tarjetas */}
      <ul className="flex flex-col gap-3 md:hidden">
        {registros.map((registro) => (
          <li
            key={registro.id}
            className={`rounded-2xl border bg-white p-4 shadow-sm shadow-[#b5368f]/10 ${
              registro.bajo_minimo ? "border-amber-300" : "border-[#e6b8d4]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold text-[#b5368f]">{registro.producto}</p>
                <p className="text-base text-[#9c2d7b]">{registro.local}</p>
              </div>
              <Estado bajo={registro.bajo_minimo} />
            </div>

            {registro.descripcion && <p className="mt-2 text-sm text-gray-500">{registro.descripcion}</p>}

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f7e3f1] pt-3 text-base">
              <div>
                <p className="text-[#9c2d7b]">Stock</p>
                <Stock registro={registro} />
              </div>
              <div>
                <p className="text-[#9c2d7b]">Precio</p>
                <p className="font-semibold text-[#1f1218]">{pesos.format(registro.precio)}</p>
              </div>
              <div>
                <p className="text-[#9c2d7b]">Marca</p>
                <p className="text-[#1f1218]">{registro.marca || "Sin marca"}</p>
              </div>
              <div>
                <p className="text-[#9c2d7b]">Tipo</p>
                <Tipo tipo={registro.tipo} />
              </div>
              <div>
                <p className="text-[#9c2d7b]">Últ. movimiento</p>
                <Movimiento valor={registro.ultimo_movimiento} fecha={registro.ultimo_movimiento_fecha} />
              </div>
            </div>

              <div className="grid grid-cols-2 gap-2">
                <BotonHistorial registro={registro} onClick={() => setProductoHistorial(registro)} completo />
                <BotonEditar registro={registro} onClick={() => setProductoEditar(registro)} completo />
              </div>
          </li>
        ))}
      </ul>

      {/* Pantallas medianas y grandes: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[62rem] text-left text-base text-[#1f1218]">
          <caption className="sr-only">Existencias de productos por local</caption>
          <thead>
            <tr className="border-b border-[#e6b8d4] text-base text-[#9c2d7b]">
              {["Producto", "Marca", "Tipo", "Local", "Precio", "Stock", "Estado", "Últ. movimiento", ""].map((titulo, i) => (
                <th key={i} scope="col" className="py-2 pr-3 font-semibold">
                  {titulo || <span className="sr-only">Acciones</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registros.map((registro) => (
              <tr key={registro.id} className="border-b border-[#f7e3f1] align-top hover:bg-[#fbeef6]">
                <td className="py-3 pr-3">
                  <p className="font-bold text-[#b5368f]">{registro.producto}</p>
                  <p className="mt-0.5 max-w-xs text-sm text-gray-500">
                    {registro.descripcion || "Sin descripción"}
                  </p>
                </td>
                <td className="py-3 pr-3">{registro.marca || "Sin marca"}</td>
                <td className="py-3 pr-3">
                  <Tipo tipo={registro.tipo} />
                </td>
                <td className="py-3 pr-3">{registro.local}</td>
                <td className="whitespace-nowrap py-3 pr-3 font-semibold">{pesos.format(registro.precio)}</td>
                <td className="py-3 pr-3">
                  <Stock registro={registro} />
                </td>
                <td className="py-3 pr-3">
                  <Estado bajo={registro.bajo_minimo} />
                </td>
                <td className="py-3 pr-3">
                  <Movimiento valor={registro.ultimo_movimiento}  fecha={registro.ultimo_movimiento_fecha}/>
                </td>
                <td className="py-3 text-right">
                   <div className="flex justify-end gap-1">
                     <BotonHistorial registro={registro} onClick={() => setProductoHistorial(registro)} />
                     <BotonEditar registro={registro} onClick={() => setProductoEditar(registro)} />
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal}
      {productoHistorial && (
          <ModalHistorial
              key={productoHistorial.id}
              registro={productoHistorial}
              onCerrar={() => setProductoHistorial(null)}
          />
      )}
    </>
  );
}
