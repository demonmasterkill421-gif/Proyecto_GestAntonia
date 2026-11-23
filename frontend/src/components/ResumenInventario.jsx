import { AlertTriangle, Boxes, Layers } from "lucide-react";

// Tres tarjetas con los totales del inventario (mismos colores que Ventas)
export function ResumenInventario({ resumen }) {
  const hayBajo = resumen.stock_bajo > 0;

  const tarjetas = [
    {
      titulo: "Productos registrados",
      valor: resumen.total_productos,
      detalle: "Productos distintos en inventario",
      Icono: Layers,
    },
    {
      titulo: "Stock total",
      valor: resumen.stock_total,
      detalle: "Unidades en todas las sucursales",
      Icono: Boxes,
    },
    {
      titulo: "Stock bajo",
      valor: resumen.stock_bajo,
      detalle: hayBajo ? "Registros que requieren reposición" : "Todo sobre el mínimo",
      Icono: AlertTriangle,
      alerta: hayBajo,
    },
  ];

  return (
    <section aria-label="Resumen general" className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      {tarjetas.map(({ titulo, valor, detalle, Icono, alerta }) => (
        <div
          key={titulo}
          className={`flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm shadow-[#b5368f]/10 ${
            alerta ? "border-amber-300" : "border-[#e6b8d4]"
          }`}
        >
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              alerta ? "bg-amber-100 text-amber-700" : "bg-[#fbeef6] text-[#b5368f]"
            }`}
          >
            <Icono size={22} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#9c2d7b]">{titulo}</h3>
            <p className={`text-2xl font-bold ${alerta ? "text-amber-700" : "text-[#1f1218]"}`}>{valor}</p>
            <p className="text-sm text-gray-500">{detalle}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
