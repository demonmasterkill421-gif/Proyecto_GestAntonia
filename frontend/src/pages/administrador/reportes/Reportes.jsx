import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import IndicadorCard from './components/IndicadorCard.jsx';
import { GraficoGanancias, GraficoServicios } from './components/Graficos.jsx';
import TablaTrabajadores from './components/TablaTrabajadores.jsx';
import { BRANCHES, DEMO_RANGE } from './data/demoReportes.js';
import { exportarReporteCSV, formatoCLP, formatoFecha, obtenerReporteDemo } from './services/reportesApi.js';

export default function Reportes({ selectedSucursal, mostrarAviso }) {
  const [desde, setDesde] = useState(DEMO_RANGE.start);
  const [hasta, setHasta] = useState(DEMO_RANGE.end);
  const [aplicado, setAplicado] = useState({ desde: DEMO_RANGE.start, hasta: DEMO_RANGE.end, sucursal: selectedSucursal });
  const [reporte, setReporte] = useState(null);

  useEffect(() => { setAplicado((f) => ({ ...f, sucursal: selectedSucursal })); }, [selectedSucursal]);
  useEffect(() => { let active = true; obtenerReporteDemo(aplicado).then((value) => { if (active) setReporte(value); }); return () => { active = false; }; }, [aplicado]);

  function aplicarFiltros(event) {
    event.preventDefault();
    if (!desde || !hasta || desde > hasta) { mostrarAviso('Selecciona un período válido: la fecha inicial no puede superar la final.'); return; }
    setAplicado({ desde, hasta, sucursal: selectedSucursal });
    mostrarAviso('Filtros aplicados a los datos de demostración.');
  }

  function exportar() {
    if (!reporte) return;
    exportarReporteCSV(reporte);
    mostrarAviso('Reporte de demostración exportado como CSV.');
  }

  return (
    <section className="reports-page" aria-label="Reportes de gestión">
      <div className="reports-intro">
          <div>
            <h1>Panel de control</h1>
          </div>
        <button type="button" className="export-button" onClick={exportar} disabled={!reporte}>
          <Download size={14}/><span>Exportar reporte</span>
        </button>
      </div>

      <form className="filters-card" onSubmit={aplicarFiltros}>
        <div className="field-date">
          <label>Período</label>
          <div className="date-fields">
            <label className="date-entry"><span className="sr-only">Fecha inicial</span><input aria-label="Fecha inicial" type="date" min={DEMO_RANGE.start} max={DEMO_RANGE.end} value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <span className="dates-separator">–</span>
            <label className="date-entry"><span className="sr-only">Fecha final</span><input aria-label="Fecha final" type="date" min={DEMO_RANGE.start} max={DEMO_RANGE.end} value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          </div>
        </div>
        <div className="field-branch">
          <label>Sucursal seleccionada en el encabezado</label>
          <div className="report-branch-readonly" aria-label="Sucursal del reporte">
            {BRANCHES.find((b) => b.id === selectedSucursal)?.name ?? 'Mall Plaza Calama'}
          </div>
        </div>
        <button className="apply-button" type="submit">Aplicar filtros</button>
        <div className="applied-period" aria-live="polite">{formatoFecha(aplicado.desde)} – {formatoFecha(aplicado.hasta)}</div>
      </form>

      {!reporte ? <p className="loading-report">Cargando datos de demostración…</p> : (
        <>
          <div className="stats-grid">
            <IndicadorCard titulo="Ganancias del período" valor={formatoCLP(reporte.indicadores.ganancias)} detalle={reporte.hayDatos ? `+${reporte.indicadores.variacionGanancias}% vs. período anterior` : 'Sin datos para este período'} tono="positive" />
            <IndicadorCard titulo="Servicios realizados" valor={reporte.indicadores.servicios} detalle={reporte.hayDatos ? `+${reporte.indicadores.variacionServicios} servicios` : 'Sin datos para este período'} tono="accent" />
            <IndicadorCard titulo="Trabajadores activos" valor={reporte.indicadores.trabajadoresActivos} detalle={`${reporte.indicadores.sucursales} ${reporte.indicadores.sucursales === 1 ? 'sucursal' : 'sucursales'}`} />
            <IndicadorCard titulo="Asistencia promedio" valor={`${reporte.indicadores.asistencia}%`} detalle={reporte.hayDatos ? `+${reporte.indicadores.variacionAsistencia}% respecto al mes anterior` : 'Sin datos para este período'} tono="positive" />
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
