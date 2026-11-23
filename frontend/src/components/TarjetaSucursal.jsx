import { Store, Receipt, UserCheck, ChartColumn, Pencil } from "lucide-react";

// A3: la tarjeta muestra solo el nombre del local y tres accesos reales.
// Las cifras de ejemplo se quitaron hasta que exista una API que las entregue.
export function TarjetaSucursal({ sucursal, onVerVentas, onVerAsistencia, onVerReporte, onEditar }) {
  const { nombre, ubicacion, estado } = sucursal;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#ecd3e6] bg-white shadow-lg shadow-[#b5368f]/15">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <h2 className="flex min-w-0 flex-1 items-center gap-3 text-2xl font-bold text-[#1f1218]">
            <Store size={28} className="shrink-0 text-[#b5368f]" />
            {nombre}
          </h2>
          {onEditar && (
            <button type="button" onClick={onEditar} aria-label={`Editar ${nombre}`} title="Editar local"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#ecd3e6] text-[#b5368f] hover:bg-[#f7e3f1]">
              <Pencil size={18} />
            </button>
          )}
        </div>
        {(ubicacion || estado === "INACTIVO") && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            {ubicacion}
            {estado === "INACTIVO" && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">Inactivo</span>}
          </p>
        )}
      </div>

      <div className="grid gap-3 border-t border-gray-100 p-4">
        <button
          type="button"
          onClick={onVerVentas}
          className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#b5368f] font-semibold text-white transition hover:bg-[#9d2d7c] active:scale-95"
        >
          <Receipt size={18} />
          Ver ventas
        </button>
        <button
          type="button"
          onClick={onVerAsistencia}
          className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ecd3e6] font-semibold text-[#b5368f] transition hover:bg-[#f7e3f1] active:scale-95"
        >
          <UserCheck size={18} />
          Ver asistencia
        </button>
        <button
          type="button"
          onClick={onVerReporte}
          className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ecd3e6] font-semibold text-[#b5368f] transition hover:bg-[#f7e3f1] active:scale-95"
        >
          <ChartColumn size={18} />
          Ver reporte
        </button>
      </div>
    </article>
  );
}