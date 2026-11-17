export function ResumenInventario({ resumen }) {
  const tarjetas = [
    ["Productos registrados", resumen.total_productos, "Productos distintos en inventario"],
    ["Stock total", resumen.stock_total, "Unidades en todas las sucursales"],
    ["Stock bajo", resumen.stock_bajo, "Registros que requieren reposición"],
  ];
  return <section aria-label="Resumen general" className="grid gap-4 sm:grid-cols-3">{tarjetas.map(([titulo, valor, detalle]) => (
    <div key={titulo} className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm text-gray-600">{titulo}</h2>
      <p className="mt-2 text-3xl font-bold text-[#b5368f]">{valor}</p>
      <p className="mt-2 text-xs text-gray-500">{detalle}</p>
    </div>
  ))}</section>;
}
