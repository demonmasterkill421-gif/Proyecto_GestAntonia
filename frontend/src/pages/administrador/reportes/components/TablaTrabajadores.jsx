import { formatoCLP } from '../services/reportesApi.js';
export default function TablaTrabajadores({ trabajadores }) {
  return (
    <section className="workers-section" aria-labelledby="workers-heading">
      <h2 id="workers-heading">Reporte de trabajadores</h2>
      <div className="workers-box">
        <div className="table-responsive">
          <table className="workers-table">
            <thead>
              <tr><th>Trabajador</th><th>Servicios</th><th>Ventas</th><th>Asistencia</th><th>Horas trabajadas</th><th>Comisión</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {trabajadores.length ? trabajadores.map((w) => (
                <tr key={w.nombre}>
                  <td className="worker-name">{w.nombre}</td>
                  <td>{w.servicios}</td>
                  <td>{formatoCLP(w.ventas)}</td>
                  <td>{w.asistencia}%</td>
                  <td>{w.horas} h</td>
                  <td>{formatoCLP(w.comision)}</td>
                  <td><span className="worker-status">{w.estado}</span></td>
                </tr>
              )) : <tr><td colSpan="7" className="empty-row">No hay datos de demostración para la selección actual.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
