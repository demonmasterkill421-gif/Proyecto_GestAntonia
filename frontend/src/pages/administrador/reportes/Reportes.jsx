import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import IndicadorCard from './components/IndicadorCard.jsx';
import { GraficoGanancias, GraficoServicios } from './components/Graficos.jsx';
import TablaTrabajadores from './components/TablaTrabajadores.jsx';
import { exportarReporteCSV, formatoCLP, formatoFecha, obtenerReporte } from './services/reportesApi.js';

function fechaISOLocal(fecha) {
  const year = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${mes}-${dia}`;
}

function rangoInicial() {
  const hoy = new Date();
  return {
    desde: fechaISOLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta: fechaISOLocal(hoy),
  };
}

export default function Reportes({ selectedSucursal, mostrarAviso }) {
  const [rango] = useState(rangoInicial);
  const [desde, setDesde] = useState(rango.desde);
  const [hasta, setHasta] = useState(rango.hasta);
  const [aplicado, setAplicado] = useState({ desde: rango.desde, hasta: rango.hasta, sucursal: selectedSucursal });
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setAplicado((actual) => ({ ...actual, sucursal: selectedSucursal }));
  }, [selectedSucursal]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');
    setReporte(null);
    obtenerReporte(aplicado)
      .then((datos) => { if (activo) setReporte(datos); })
      .catch((err) => {
        if (activo) setError(err.response?.data?.detail || 'No se pudo consultar el reporte en Django. Verifica que esté encendido.');
      })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [aplicado]);

  function aplicarFiltros(event) {
    event.preventDefault();
    if (!desde || !hasta || desde > hasta) {
      mostrarAviso('Selecciona un período válido: la fecha inicial no puede superar la final.');
      return;
    }
    const diferencia = Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000);
    if (diferencia > 92) {
      mostrarAviso('Selecciona un período de hasta 93 días.');
      return;
    }
    setAplicado({ desde, hasta, sucursal: selectedSucursal });
  }

  function exportar() {
    if (!reporte) return;
    exportarReporteCSV(reporte);
    mostrarAviso('Reporte consultado desde Django exportado como CSV.');
  }

  const indicadores = reporte?.indicadores;
  return (
    <section className="reports-page" aria-label="Panel de control">
      <div className="reports-intro">
        <div><h1>Panel de control</h1></div>
        <button type="button" className="export-button" onClick={exportar} disabled={!reporte}>
          <Download size={14}/><span>Exportar reporte</span>
        </button>
      </div>

      <form className="filters-card" onSubmit={aplicarFiltros}>
        <div className="field-date">
          <label>Período</label>
          <div className="date-fields">
            <label className="date-entry"><span className="sr-only">Fecha inicial</span><input aria-label="Fecha inicial" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <span className="dates-separator">–</span>
            <label className="date-entry"><span className="sr-only">Fecha final</span><input aria-label="Fecha final" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          </div>
        </div>
        <div className="field-branch">
          <label>Sucursal seleccionada en el encabezado</label>
          <div className="report-branch-readonly" aria-label="Sucursal del reporte">
            {reporte?.sucursal?.name || `Local #${selectedSucursal}`}
          </div>
        </div>
        <button className="apply-button" type="submit">Aplicar filtros</button>
        <div className="applied-period" aria-live="polite">{formatoFecha(aplicado.desde)} – {formatoFecha(aplicado.hasta)}</div>
      </form>

      {cargando && <p className="loading-report">Consultando PostgreSQL mediante Django…</p>}
      {!cargando && error && <p role="alert" className="loading-report">{error}</p>}
      {!cargando && !error && reporte && (
        <>
          <div className="stats-grid">
            <IndicadorCard
              titulo="Ganancias del período"
              valor={formatoCLP(indicadores.ganancias)}
              detalle={indicadores.variacionGanancias === null
                ? 'Ingresos de ventas confirmadas' : `${indicadores.variacionGanancias}% vs. período anterior`}
              tono="positive"
            />
            <IndicadorCard
              titulo="Servicios realizados"
              valor={indicadores.servicios}
              detalle={indicadores.variacionServicios === null
                ? 'Servicios de ventas confirmadas' : `${indicadores.variacionServicios >= 0 ? '+' : ''}${indicadores.variacionServicios} servicios`}
              tono="accent"
            />
            <IndicadorCard
              titulo="Trabajadores activos"
              valor={indicadores.trabajadoresActivos}
              detalle={`${indicadores.sucursales} ${indicadores.sucursales === 1 ? 'sucursal' : 'sucursales'}`}
            />
            <IndicadorCard
              titulo="Asistencia promedio"
              valor={indicadores.asistencia === null ? '—' : `${indicadores.asistencia}%`}
              detalle={indicadores.asistencia === null
                ? 'Pendiente definir jornadas programadas' : 'Asistencia registrada'}
            />
          </div>
          <div className="charts-grid">
            <GraficoGanancias data={reporte.gananciasDiarias}/>
            <GraficoServicios data={reporte.serviciosPorTipo}/>
          </div>
          <TablaTrabajadores trabajadores={reporte.trabajadores} />
        </>
      )}
    </section>
  );
}
