import { useEffect, useState } from "react";
import { Sidebar } from "../../../components/Sidebar";
import { BuscadorInventario } from "../../../components/inventario/BuscadorInventario";
import { TablaInventario } from "../../../components/inventario/TablaInventario";
import { ResumenInventario } from "../../../components/inventario/ResumenInventario";
import { obtenerInventario, obtenerLocales } from "../../../api/inventario.api";
import { Link } from "react-router-dom";

// Se monta solo cuando la sesión de administración está verificada.
export function Inventario() {
  const [filtros, setFiltros] = useState({ busqueda: "", local: "", bajo_minimo: false });
  const [registros, setRegistros] = useState([]);
  const [resumen, setResumen] = useState({ total_productos: 0, stock_total: 0, stock_bajo: 0 });
  const [locales, setLocales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  const cambiarFiltros = (nuevos) => {
    setCargando(true);
    setError("");
    setFiltros(nuevos);
  };

  const reintentar = () => {
    setCargando(true);
    setError("");
    setIntento((valor) => valor + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    // Espera breve para no enviar una consulta por cada tecla.
    const timer = setTimeout(async () => {
      try {
        const params = { busqueda: filtros.busqueda, bajo_minimo: filtros.bajo_minimo };
        if (filtros.local) params.local = filtros.local;
        const [inventario, sucursales] = await Promise.all([
          obtenerInventario(params, controller.signal), obtenerLocales(controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setRegistros(inventario.data.registros);
          setResumen(inventario.data.resumen);
          setLocales(sucursales.data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err.response?.status === 401
            ? "Tu sesión expiró. Cierra sesión e ingresa nuevamente."
            : "No se pudo cargar el inventario. Revisa que Django esté iniciado e intenta nuevamente.");
        }
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filtros, intento]);

  return <Sidebar mostrarSelectorSucursal={false}>
    <div className="mx-auto max-w-7xl space-y-6">
<div className="flex flex-wrap items-center justify-between gap-4">
  <div><p className="text-sm font-semibold uppercase tracking-widest text-[#b5368f]">Administración</p>
    <h1 className="mt-2 text-3xl font-bold text-[#1f1218]">Inventario</h1>
    <p className="mt-2 text-gray-600">Consulta productos, insumos y existencias por local.</p>
  </div>
<Link
  to="/admin/inventario/registrar"
  className="inline-block rounded-lg bg-[#b5368f] px-5 py-3 font-semibold text-white transition hover:bg-[#922b73]"
>
  + Registrar producto
</Link>
</div>
      <BuscadorInventario filtros={filtros} onChange={cambiarFiltros} locales={locales} />
      <div aria-live="polite" aria-busy={cargando}>
        {cargando ? <p className="py-8 text-gray-600">Cargando inventario…</p> : error ?
          <div role="alert" className="rounded-xl bg-red-50 p-5 text-red-800"><p>{error}</p>
            <button onClick={reintentar} className="mt-3 rounded-lg border px-4 py-2">Reintentar</button></div> :
          <div className="space-y-6"><ResumenInventario resumen={resumen} /><TablaInventario registros={registros} /></div>}
      </div>
    </div>
  </Sidebar>;
}
