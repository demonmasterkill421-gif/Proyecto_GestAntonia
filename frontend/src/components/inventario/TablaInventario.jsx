const pesos = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

export function TablaInventario({ registros }) {
  if (!registros.length) return <p className="rounded-xl bg-white p-8 text-center text-gray-600">No hay registros para estos filtros. Puedes cargar productos y existencias desde el administrador de Django.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Existencias de productos por local</caption>
        <thead className="bg-[#fbeef6] text-[#682653]"><tr>
          {["Producto", "Marca", "Tipo", "Local", "Precio", "Stock", "Mínimo", "Estado"].map((titulo) =>
            <th key={titulo} scope="col" className="px-5 py-4">{titulo}</th>)}
        </tr></thead>
        <tbody>{registros.map((registro) => (
          <tr key={registro.id} className="border-t border-gray-100">
            <td className="px-5 py-4">
            <p className="font-medium">{registro.producto}</p>

            <p className="mt-1 max-w-xs text-sm text-gray-500">
                {registro.descripcion || "Sin descripción"}
            </p>
            </td>

            <td className="px-5 py-4">
                {registro.marca || "Sin marca"}
            </td>
            <td className="px-5 py-4">{registro.tipo}</td>
            <td className="px-5 py-4">{registro.local}</td>
            <td className="whitespace-nowrap px-5 py-4">{pesos.format(registro.precio)}</td>
            <td className="px-5 py-4 font-semibold">{registro.cantidad}</td>
            <td className="px-5 py-4">{registro.stock_minimo}</td>
            <td className="px-5 py-4"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${registro.bajo_minimo ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
              {registro.bajo_minimo ? "Stock bajo" : "Disponible"}
            </span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
