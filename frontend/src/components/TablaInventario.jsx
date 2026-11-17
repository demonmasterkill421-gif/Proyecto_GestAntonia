import { useState } from "react";
import { ModalEditarProducto } from "./ModalEditarProducto";


const pesos = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});

export function TablaInventario({ registros }) {
const [productoEditar, setProductoEditar] = useState(null);
  if (!registros.length) {
    return (
      <p className="rounded-xl bg-white p-8 text-center text-gray-600">
        No hay registros para estos filtros.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Existencias de productos por local
        </caption>

        <thead className="bg-[#fbeef6] text-[#682653]">
          <tr>
            {[
              "Producto",
              "Marca",
              "Tipo",
              "Local",
              "Precio",
              "Stock",
              "Mínimo",
              "Estado",
              "Últ. movimiento",
              "Acciones",
            ].map((titulo) => (
              <th
                key={titulo}
                scope="col"
                className="px-5 py-4"
              >
                {titulo}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {registros.map((registro) => (
            <tr
              key={registro.id}
              className="border-t border-gray-100"
            >
              <td className="px-5 py-4">
                <p className="font-medium">
                  {registro.producto}
                </p>

                <p className="mt-1 max-w-xs text-sm text-gray-500">
                  {registro.descripcion || "Sin descripción"}
                </p>
              </td>

              <td className="px-5 py-4">
                {registro.marca || "Sin marca"}
              </td>

              <td className="px-5 py-4">
                {registro.tipo}
              </td>

              <td className="px-5 py-4">
                {registro.local}
              </td>

              <td className="whitespace-nowrap px-5 py-4">
                {pesos.format(registro.precio)}
              </td>

              <td className="px-5 py-4 font-semibold">
                {registro.cantidad}
              </td>

              <td className="px-5 py-4">
                {registro.stock_minimo}
              </td>

              <td className="px-5 py-4">
                <span
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                    registro.bajo_minimo
                      ? "bg-amber-100 text-amber-900"
                      : "bg-emerald-100 text-emerald-900"
                  }`}
                >
                  {registro.bajo_minimo
                    ? "Stock bajo"
                    : "Disponible"}
                </span>
              </td>

              <td className="whitespace-nowrap px-5 py-4">
                {registro.ultimo_movimiento == null ? (
                  <span className="text-gray-500">
                    Sin movimientos
                  </span>
                ) : (
                  <span
                    className={
                      registro.ultimo_movimiento > 0
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }
                  >
                    {registro.ultimo_movimiento > 0
                      ? `Entrada +${registro.ultimo_movimiento}`
                      : `Salida ${registro.ultimo_movimiento}`}
                  </span>
                )}
              </td>

              <td className="px-5 py-4">
                <button
                   type="button"
                   onClick={() => setProductoEditar(registro)}
                   aria-label={`Editar ${registro.producto} en ${registro.local}`}
                   className="rounded-lg px-3 py-2 font-semibold text-[#b5368f] transition hover:bg-[#fbeef6] hover:text-[#922b73]"
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {productoEditar && (
        <ModalEditarProducto
          key={productoEditar.id}
          registro={productoEditar}
          onCerrar={() => setProductoEditar(null)}
        />
      )}
    </div>
  );
}