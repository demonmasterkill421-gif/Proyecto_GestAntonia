import { Store, CalendarDays, UserCheck, Clock } from "lucide-react";

const pesos = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export function TarjetaSucursal({ sucursal, onVerAgenda, onVerAsistencia }) {
  const { nombre, reservasHoy, presentes, especialistas, ventasHoy, cantidadVentas, proxima } = sucursal;

  return (
    <article className="overflow-hidden rounded-2xl border border-[#ecd3e6] bg-white shadow-sm">
      <div className="p-5">
        <h2 className="flex items-center gap-3 text-2xl font-bold text-[#1f1218]">
          <Store size={28} className="text-[#b5368f]" />
          {nombre}
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#fbf3f8] p-4">
            <p className="text-3xl font-bold text-[#1f1218]">{reservasHoy}</p>
            <p className="mt-1 text-gray-600">Reservas hoy</p>
          </div>
          <div className="rounded-xl bg-[#fbf3f8] p-4">
            <p className="text-3xl font-bold text-[#1f1218]">
              {presentes} de {especialistas}
            </p>
            <p className="mt-1 text-gray-600">Especialistas presentes</p>
          </div>

          {/* Ventas del día: ocupa las dos columnas */}
          <div className="col-span-2 rounded-xl bg-[#fbf3f8] p-4">
            <p className="text-3xl font-bold text-[#b5368f]">{pesos(ventasHoy)}</p>
            <p className="mt-1 text-gray-600">
              Ventas del día · {cantidadVentas} {cantidadVentas === 1 ? "venta" : "ventas"}
            </p>
          </div>
        </div>

        <p className="mt-5 flex items-center gap-2 text-gray-600">
          <Clock size={18} />
          Próxima hora: {proxima.hora} · {proxima.especialista}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 p-4">
        <button
          type="button"
          onClick={onVerAgenda}
          className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#b5368f] font-semibold text-white transition hover:bg-[#9d2d7c] active:scale-95"
        >
          <CalendarDays size={18} />
          Ver agenda
        </button>
        <button
          type="button"
          onClick={onVerAsistencia}
          className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#ecd3e6] font-semibold text-[#b5368f] transition hover:bg-[#f7e3f1] active:scale-95"
        >
          <UserCheck size={18} />
          Asistencia
        </button>
      </div>
    </article>
  );
}