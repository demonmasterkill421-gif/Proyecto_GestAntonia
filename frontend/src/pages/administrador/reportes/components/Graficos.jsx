import { ChartNoAxesColumnIncreasing, Scissors } from 'lucide-react';
import { formatoCLP } from '../services/reportesApi.js';

export function GraficoGanancias({ data }) {
  const max = Math.max(1, ...data.map((d) => d.ganancias));
  return (
    <section className="report-panel chart-panel" aria-labelledby="ganancias-heading">
      <div className="chart-heading">
        <div className="chart-heading-icon" aria-hidden="true">
          <ChartNoAxesColumnIncreasing size={23} strokeWidth={2.3} />
        </div>
        <div className="chart-heading-copy">
          <h2 id="ganancias-heading" >Ganancias por día</h2>
          <p className="panel-description">Total diario del período seleccionado</p>
        </div>
      </div>
      {data.length ? (
        <div className="bar-chart" role="img" aria-label="Gráfico de barras con ganancias por cada día">
          {data.map((dia) => {
            const altura = Math.max(7, Math.round((dia.ganancias / max) * 100));
            return (
              <div className="bar-slot" key={dia.fecha} title={`${dia.fecha}: ${formatoCLP(dia.ganancias)}`}>
                <div className="bar-track">
                  <div className="bar-total" style={{ height: `${altura}%` }}>
                    <div className="bar-highlight" />
                    <div className="bar-light" />
                  </div>
                </div>
                <span className="bar-tick">{Number(dia.fecha.slice(-2))}</span>
              </div>
            );
          })}
        </div>
      ) : <div className="panel-empty">No hay servicios o ventas registradas para ese período.</div>}
    </section>
  );
}

export function GraficoServicios({ data }) {
  return (
    <section className="report-panel service-panel" aria-labelledby="servicios-heading">
      <div className="chart-heading">
        <div className="chart-heading-icon" aria-hidden="true">
          <Scissors size={23} strokeWidth={2.3} />
        </div>
        <div className="chart-heading-copy">
          <h2 id="servicios-heading" >Servicios realizados</h2>
          <p className="panel-description">Distribución de los servicios más solicitados</p>
        </div>
      </div>
      {data.length ? (
        <div className="services-list">
          {data.map((servicio) => (
            <div className="service-item" key={servicio.nombre}>
              <span className="service-title">{servicio.nombre}</span>
              <div className="service-track">
                <span  style={{ width: `${servicio.porcentaje}%` }} />
              </div>
              <span className="service-percent">{servicio.porcentaje}%</span>
            </div>
          ))}
        </div>
      ) : <div className="panel-empty">No hay servicios o ventas registradas para ese período.</div>}
    </section>
  );
}
