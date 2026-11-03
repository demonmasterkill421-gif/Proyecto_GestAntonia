import { useState } from "react";
import { useDatos } from "../hooks/useDatos";
import { obtenerAllVentas } from "../api/ventas.api";

const clp = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

const formatoFecha = (iso) =>
  new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

const ETIQUETA_PAGO = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFER: "Transferencia",
};

const ETIQUETA_ESTADO = {
  CONFIRMADA: "Confirmada",
  ANULADA: "Anulada",
  BORRADOR: "En registro",
};

// Definida fuera del componente para que useDatos la reconozca como estable.
const cargarVentas = () => obtenerAllVentas();

const tarjeta = "rounded-3xl border border-[#e6b8d4] bg-[#f7e3f1] p-6 shadow-lg shadow-[#b5368f]/15";

// rol: "ADMIN" ve todos los locales y puede filtrar; "RECEP" ve solo su local (lo decide el backend).
export function TablaVentas({ rol }) {
  const { datos: ventas, cargando, error } = useDatos(cargarVentas, { cadaMs: 30000 });
  const [local, setLocal] = useState("");

  const esAdmin = rol === "ADMIN";
  const locales = [...new Set(ventas.map((v) => v.local_nombre))].filter(Boolean);
  const visibles = ventas.filter((v) => !esAdmin || !local || v.local_nombre === local);

  // Las ventas anuladas no suman al total.
  const confirmadas = visibles.filter((v) => v.estado === "CONFIRMADA");
  const totalVendido = confirmadas.reduce((suma, v) => suma + v.monto_total, 0);
  const cantidad = confirmadas.length;
  const ticketPromedio = cantidad > 0 ? Math.round(totalVendido / cantidad) : 0;

  const resumen = [
    { titulo: "Total vendido", valor: clp(totalVendido) },
    { titulo: "Ventas", valor: cantidad },
    { titulo: "Ticket promedio", valor: clp(ticketPromedio) },
  ];

  return (
    <div className="flex flex-col gap-6">
      {esAdmin && (
        <div className="max-w-xs">
          <label className="mb-1 block text-base font-medium text-[#1f1218]">Local</label>
          <select
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="h-12 w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-lg"
          >
            <option value="">Todos los locales</option>
            {locales.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {resumen.map((r) => (
          <div key={r.titulo} className={tarjeta}>
            <p className="text-base text-gray-600">{r.titulo}</p>
            <p className="mt-1 text-3xl font-bold text-[#1f1218]">{r.valor}</p>
          </div>
        ))}
      </div>

      <section className={tarjeta}>
        <h2 className="mb-4 text-2xl font-bold text-[#1f1218]">Ventas</h2>

        {cargando && <p className="text-base text-gray-500">Cargando ventas...</p>}
        {error && <p className="text-base font-medium text-[#b5368f]">{error}</p>}
        {!cargando && !error && visibles.length === 0 && (
          <p className="text-base text-gray-500">Aún no hay ventas registradas.</p>
        )}

        {visibles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-base text-[#1f1218]">
              <thead>
                <tr className="border-b border-[#ecc7de] text-gray-600">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  {esAdmin && <th className="py-2 pr-3 font-medium">Local</th>}
                  <th className="py-2 pr-3 font-medium">Folio</th>
                  <th className="py-2 pr-3 font-medium">Pago</th>
                  <th className="py-2 pr-3 font-medium">Estado</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((v) => (
                  <tr key={v.id} className="border-b border-[#ecc7de]/60 last:border-0">
                    <td className="py-3 pr-3">{formatoFecha(v.fecha)}</td>
                    {esAdmin && <td className="py-3 pr-3">{v.local_nombre}</td>}
                    <td className="py-3 pr-3">{v.folio ?? "-"}</td>
                    <td className="py-3 pr-3">{ETIQUETA_PAGO[v.metodo_pago] ?? v.metodo_pago}</td>
                    <td
                      className={`py-3 pr-3 ${v.estado === "ANULADA" ? "font-medium text-[#b5368f]" : ""}`}
                    >
                      {ETIQUETA_ESTADO[v.estado] ?? v.estado}
                    </td>
                    <td className="py-3 text-right font-semibold">{clp(v.monto_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}