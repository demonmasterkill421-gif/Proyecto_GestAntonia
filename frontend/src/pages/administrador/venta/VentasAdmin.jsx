import { useEffect, useState } from "react";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { useDatos } from "../../../hooks/useDatos";
import { obtenerAllVentas, obtenerServiciosVenta } from "../../../api/ventas.api";
import { ESPECIALISTAS } from "../../../data/catalogo";
import { SUCURSALES, useSucursalId } from "../../../hooks/useSucursal";

const clp = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

// Definidas fuera del componente para que useDatos las reconozca como estables.
const cargarVentas = () => obtenerAllVentas();
const cargarServicios = () => obtenerServiciosVenta();

const fechaLocal = (fecha) => new Date(fecha).toLocaleDateString("sv-SE"); // aaaa-mm-dd
const hoy = () => new Date().toLocaleDateString("sv-SE");
const inicioMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("sv-SE");
};

// Lista de días entre dos fechas (máximo los últimos 31, para que el gráfico se lea bien)
function diasDelRango(desde, hasta) {
  const dias = [];
  const fin = new Date(`${hasta}T00:00:00`);
  for (let d = new Date(`${desde}T00:00:00`); d <= fin && dias.length < 400; d.setDate(d.getDate() + 1)) {
    dias.push(d.toLocaleDateString("sv-SE"));
  }
  return dias.slice(-31);
}

const tarjeta = "rounded-2xl border border-[#f0cfe3] bg-white p-5 shadow-md shadow-[#b5368f]/10";
const campo = "h-11 w-full rounded-lg border border-[#e6b8d4] bg-white px-3 text-base";
const degradado = "bg-gradient-to-r from-[#d61f9a] to-[#a8238f]";

export function VentasAdmin() {
  useTitulo("Reportes");
  const { datos: ventas, cargando, error } = useDatos(cargarVentas, { cadaMs: 30000 });
  const { datos: servicios } = useDatos(cargarServicios, { cadaMs: 60000 });

  const sucursalId = useSucursalId();
  const [borrador, setBorrador] = useState(() => ({
    desde: inicioMes(),
    hasta: hoy(),
    local: String(sucursalId),
  }));
  const [filtros, setFiltros] = useState(borrador);

  // Cuando se cambia la sucursal en el encabezado, el reporte la sigue
  useEffect(() => {
    const local = String(sucursalId);
    setBorrador((b) => ({ ...b, local }));
    setFiltros((f) => ({ ...f, local }));
  }, [sucursalId]);

  const rangoValido = filtros.desde <= filtros.hasta;
  const nombreServicio = Object.fromEntries(servicios.map((s) => [s.id, s.nombre]));

  // Solo ventas confirmadas, dentro del período y de la sucursal elegida
  const ventasFiltradas = ventas.filter(
    (v) =>
      rangoValido &&
      v.estado === "CONFIRMADA" &&
      (!filtros.local || String(v.local) === filtros.local) &&
      fechaLocal(v.fecha) >= filtros.desde &&
      fechaLocal(v.fecha) <= filtros.hasta,
  );

  const ganancias = ventasFiltradas.reduce((suma, v) => suma + v.monto_total, 0);
  const cantidadVentas = ventasFiltradas.length;
  const ticketPromedio = cantidadVentas > 0 ? Math.round(ganancias / cantidadVentas) : 0;

  // Solo cuentan las líneas que son servicios (los productos no están en la lista de servicios)
  const lineasServicio = ventasFiltradas
    .flatMap((v) => v.detalles)
    .filter((d) => nombreServicio[d.item]);
  const serviciosRealizados = lineasServicio.reduce((suma, d) => suma + d.cantidad, 0);

  // Ganancias por día
  const dias = rangoValido ? diasDelRango(filtros.desde, filtros.hasta) : [];
  const gananciaPorDia = Object.fromEntries(dias.map((d) => [d, 0]));
  ventasFiltradas.forEach((v) => {
    const dia = fechaLocal(v.fecha);
    if (dia in gananciaPorDia) gananciaPorDia[dia] += v.monto_total;
  });
  const maximoDia = Math.max(...Object.values(gananciaPorDia), 1);

  // Servicios más solicitados
  const conteo = {};
  lineasServicio.forEach((d) => {
    const nombre = nombreServicio[d.item];
    conteo[nombre] = (conteo[nombre] ?? 0) + d.cantidad;
  });
  const topServicios = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Reporte por trabajadora
  const porTrabajadora = {};
  lineasServicio.forEach((d) => {
    if (!d.trabajador) return;
    const actual = porTrabajadora[d.trabajador] ?? { servicios: 0, ventas: 0 };
    actual.servicios += d.cantidad;
    actual.ventas += d.subtotal;
    porTrabajadora[d.trabajador] = actual;
  });
  const filasTrabajadoras = Object.entries(porTrabajadora)
    .map(([id, datos]) => ({
      id,
      nombre: ESPECIALISTAS.find((e) => String(e.id) === id)?.nombre ?? `Trabajadora #${id}`,
      ...datos,
    }))
    .sort((a, b) => b.ventas - a.ventas);

  const resumen = [
    { titulo: "Ganancias del período", valor: clp(ganancias), destacada: true },
    { titulo: "Servicios realizados", valor: serviciosRealizados },
    { titulo: "Ventas realizadas", valor: cantidadVentas },
    { titulo: "Ticket promedio", valor: clp(ticketPromedio) },
  ];

  return (
    <Sidebar>
      <h1 className="text-3xl font-bold text-[#a8238f]">Reportes</h1>
      <p className="mb-6 text-base text-gray-600">Resumen del negocio para apoyar la toma de decisiones.</p>

      {error && <p className="mb-4 text-base font-medium text-[#b5368f]">{error}</p>}

      {/* Filtros */}
      <section className={`${tarjeta} mb-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="sm:w-44">
            <label className="mb-1 block text-sm font-semibold text-[#a8238f]">Desde</label>
            <input
              type="date"
              value={borrador.desde}
              onChange={(e) => setBorrador({ ...borrador, desde: e.target.value })}
              className={campo}
            />
          </div>
          <div className="sm:w-44">
            <label className="mb-1 block text-sm font-semibold text-[#a8238f]">Hasta</label>
            <input
              type="date"
              value={borrador.hasta}
              onChange={(e) => setBorrador({ ...borrador, hasta: e.target.value })}
              className={campo}
            />
          </div>
          <div className="sm:w-56">
            <label className="mb-1 block text-sm font-semibold text-[#a8238f]">Sucursal</label>
            <select
              value={borrador.local}
              onChange={(e) => setBorrador({ ...borrador, local: e.target.value })}
              className={`${campo} cursor-pointer`}
            >
              <option value="">Todas las sucursales</option>
              {SUCURSALES.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setFiltros(borrador)}
            className={`h-11 cursor-pointer rounded-lg px-6 text-base font-semibold text-white shadow-md shadow-[#d61f9a]/30 hover:brightness-110 ${degradado}`}
          >
            Aplicar filtros
          </button>
        </div>
        {!rangoValido && (
          <p className="mt-3 text-base font-medium text-[#b5368f]">
            La fecha «Desde» no puede ser posterior a «Hasta».
          </p>
        )}
      </section>

      {/* Tarjetas de resumen */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {resumen.map((r) =>
          r.destacada ? (
            <div key={r.titulo} className={`rounded-2xl p-5 text-white shadow-lg shadow-[#d61f9a]/30 ${degradado}`}>
              <p className="text-sm font-medium text-white/85">{r.titulo}</p>
              <p className="mt-1 text-3xl font-bold">{r.valor}</p>
            </div>
          ) : (
            <div key={r.titulo} className={`${tarjeta} border-t-4 border-t-[#d61f9a]`}>
              <p className="text-sm font-medium text-gray-600">{r.titulo}</p>
              <p className="mt-1 text-3xl font-bold text-[#b5368f]">{r.valor}</p>
            </div>
          ),
        )}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Ganancias por día */}
        <section className={tarjeta}>
          <h2 className="text-xl font-bold text-[#a8238f]">Ganancias por día</h2>
          <p className="mb-4 text-sm text-gray-600">Total diario del período seleccionado</p>

          {cargando && <p className="text-base text-gray-500">Cargando...</p>}
          {!cargando && dias.length === 0 && <p className="text-base text-gray-500">Sin datos para este período.</p>}

          {dias.length > 0 && (
            <div className="overflow-x-auto">
              <div className="flex h-48 items-end gap-2" style={{ minWidth: `${dias.length * 28}px` }}>
                {dias.map((dia) => (
                  <div key={dia} className="flex h-full flex-1 flex-col items-center gap-1">
                    <div
                      className="relative w-full flex-1 overflow-hidden rounded-md bg-[#fbe4f2]"
                      title={`${dia}: ${clp(gananciaPorDia[dia])}`}
                    >
                      <div
                        className="absolute bottom-0 w-full rounded-md bg-gradient-to-t from-[#a8238f] to-[#d61f9a]"
                        style={{ height: `${(gananciaPorDia[dia] / maximoDia) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[#a8238f]">{Number(dia.slice(8))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Servicios más solicitados */}
        <section className={tarjeta}>
          <h2 className="text-xl font-bold text-[#a8238f]">Servicios realizados</h2>
          <p className="mb-4 text-sm text-gray-600">Distribución de servicios más solicitados</p>

          {topServicios.length === 0 && <p className="text-base text-gray-500">Sin datos para este período.</p>}

          <ul className="flex flex-col gap-4">
            {topServicios.map(([nombre, cantidad]) => {
              const porcentaje = Math.round((cantidad / serviciosRealizados) * 100);
              return (
                <li key={nombre} className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-1">
                  <span className="truncate text-base font-semibold text-[#1f1218]">{nombre}</span>
                  <span className="text-right text-base font-bold text-[#b5368f]">{porcentaje}%</span>
                  <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-[#fbe4f2]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#d61f9a] to-[#a8238f]"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Reporte de trabajadoras */}
      <h2 className="mb-3 text-xl font-bold text-[#a8238f]">Reporte de trabajadoras</h2>
      <section className={`${tarjeta} overflow-x-auto`}>
        <table className="w-full min-w-[42rem] text-left text-base text-[#1f1218]">
          <thead>
            <tr className="border-b border-[#f0cfe3] text-sm text-[#a8238f]">
              <th className="py-2 pr-3 font-semibold">Trabajadora</th>
              <th className="py-2 pr-3 font-semibold">Servicios</th>
              <th className="py-2 pr-3 font-semibold">Ventas</th>
              <th className="py-2 pr-3 font-semibold">Asistencia</th>
              <th className="py-2 pr-3 font-semibold">Horas trabajadas</th>
              <th className="py-2 pr-3 font-semibold">Comisión</th>
              <th className="py-2 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filasTrabajadoras.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-gray-500">
                  Sin datos para este período.
                </td>
              </tr>
            )}
            {filasTrabajadoras.map((f) => (
              <tr key={f.id} className="border-b border-[#f7e3f1] last:border-0">
                <td className="py-3 pr-3 font-bold text-[#b5368f]">{f.nombre}</td>
                <td className="py-3 pr-3 font-medium">{f.servicios}</td>
                <td className="py-3 pr-3 font-bold">{clp(f.ventas)}</td>
                <td className="py-3 pr-3 text-gray-400">—</td>
                <td className="py-3 pr-3 text-gray-400">—</td>
                <td className="py-3 pr-3 text-gray-400">—</td>
                <td className="py-3 text-gray-400">—</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-gray-500">
          Asistencia, horas, comisión y estado se completarán cuando estén listos esos módulos.
        </p>
      </section>
    </Sidebar>
  );
}