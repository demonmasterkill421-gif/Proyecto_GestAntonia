import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Plus } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { BuscadorInventario } from "../../../components/BuscadorInventario";
import { TablaInventario } from "../../../components/TablaInventario";
import { ResumenInventario } from "../../../components/ResumenInventario";
import { obtenerInventario, obtenerLocales } from "../../../api/inventario.api";
import { useTitulo } from "../../../hooks/useTitulo";

// Se monta solo cuando la sesión de administración está verificada.
export function Inventario() {
  useTitulo("Inventario");

  const [filtros, setFiltros] = useState({ busqueda: "", local: "", bajo_minimo: false });
  const [registros, setRegistros] = useState([]);
  const [resumen, setResumen] = useState({ total_productos: 0, stock_total: 0, stock_bajo: 0 });
  const [locales, setLocales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargadoUnaVez, setCargadoUnaVez] = useState(false); // para no "parpadear" al escribir
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
          obtenerInventario(params, controller.signal),
          obtenerLocales(controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setRegistros(inventario.data.registros);
          setResumen(inventario.data.resumen);
          setLocales(sucursales.data);
          setCargadoUnaVez(true);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.response?.status === 401
              ? "Tu sesión expiró. Cierra sesión e ingresa nuevamente."
              : "No se pudo cargar el inventario. Revisa que Django esté iniciado e intenta nuevamente.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filtros, intento]);

  return (
    <Sidebar mostrarSelectorSucursal={false}>
      {/* Título: mismo formato que la página de Ventas */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#a8238f]">Inventario</h1>
          <p className="text-base text-gray-600">Productos e insumos de todos los locales.</p>
        </div>

        <Link
          to="/admin/inventario/registrar"
          className="flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-[#d61f9a] to-[#a8238f] px-5 text-base font-semibold text-white shadow-md shadow-[#d61f9a]/30 hover:brightness-110"
        >
          <Plus size={20} />
          Registrar producto
        </Link>
      </div>

      <section className="flex min-h-[calc(100vh-12rem)] flex-col rounded-3xl border border-[#e6b8d4] bg-[#f7e3f1] shadow-lg shadow-[#b5368f]/15">
        {/* Encabezado */}
        <div className="flex items-center gap-3 p-4 sm:gap-4 sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#b5368f] text-white shadow-md shadow-[#b5368f]/30">
            <Package size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-[#1f1218] sm:text-2xl">Listado de inventario</h2>
            <p className="text-base font-medium text-[#9c2d7b]">
              {registros.length} {registros.length === 1 ? "registro" : "registros"}
              {cargando && cargadoUnaVez && " · actualizando…"}
            </p>
          </div>
        </div>

        {/* Tarjetas de resumen */}
        <div className="px-4 pb-4 sm:px-6">
          <ResumenInventario resumen={resumen} />
        </div>

        {/* Buscador + atajos de local + stock bajo */}
        <BuscadorInventario filtros={filtros} onChange={cambiarFiltros} locales={locales} />

        {/* Listado */}
        <div className="flex flex-1 px-4 pb-6 sm:px-6" aria-live="polite" aria-busy={cargando}>
          <div className="w-full md:rounded-2xl md:border md:border-[#e6b8d4] md:bg-white md:p-5 md:shadow-sm md:shadow-[#b5368f]/10">
            {error ? (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-base text-red-800">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={reintentar}
                  className="mt-3 h-11 cursor-pointer rounded-lg border border-[#b5368f] bg-white px-4 text-base font-semibold text-[#b5368f] hover:bg-[#fbeef6]"
                >
                  Reintentar
                </button>
              </div>
            ) : cargando && !cargadoUnaVez ? (
              <p className="py-2 text-base font-medium text-[#9c2d7b]">Cargando inventario…</p>
            ) : (
              <div className={`transition-opacity ${cargando ? "opacity-60" : "opacity-100"}`}>
                <TablaInventario registros={registros} onActualizado={reintentar} />
              </div>
            )}
          </div>
        </div>
      </section>
    </Sidebar>
  );
}
