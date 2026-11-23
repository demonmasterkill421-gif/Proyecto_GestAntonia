import { Fragment, useState } from 'react';
import { ChevronRight, UsersRound } from 'lucide-react';
import { formatoCLP } from '../services/reportesApi.js';

const CLASE_ESTADO = { Inactiva: 'is-inactive', 'En otro local': 'is-other' };

// Desglose de la comisión: cuánto hizo en cada servicio y con qué %
function DetalleComision({ detalle }) {
  if (!detalle?.length) {
    return <p className="commission-note">Sin servicios registrados en el período.</p>;
  }
  const hayBase = detalle.some((d) => !d.porServicio);
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Servicio / producto</th>
            <th className="num">Cantidad</th>
            <th className="num">Ventas</th>
            <th className="num">% comisión</th>
            <th className="num">Comisión</th>
          </tr>
        </thead>
        <tbody>
          {detalle.map((d) => (
            <tr key={`${d.servicio}-${d.porcentaje}`}>
              <td>{d.servicio}</td>
              <td className="num">{d.cantidad}</td>
              <td className="num">{formatoCLP(d.ventas)}</td>
              <td className="num">
                {d.porcentajeTexto}
                {!d.porServicio && <span className="base-flag" title="Ese servicio no tiene un % propio: se usó su comisión base">base</span>}
              </td>
              <td className="num">{formatoCLP(d.comision)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hayBase && (
        <p className="commission-note">
          «base»: ese servicio no tiene un % propio para esta trabajadora y se usó su comisión base.
          Se configura en Especialistas → Editar.
        </p>
      )}
    </>
  );
}

export default function TablaTrabajadores({ trabajadores }) {
  const [abierta, setAbierta] = useState(null);

  return (
    <section className="workers-section" aria-labelledby="workers-heading">
      <div className="workers-heading">
        <div className="workers-heading-icon" aria-hidden="true">
          <UsersRound size={21} strokeWidth={2.2} />
        </div>
        <h2 id="workers-heading">Reporte de trabajadores</h2>
      </div>
      <div className="workers-box">
        <div className="table-responsive">
          <table className="workers-table">
            <thead >
              <tr>
                <th >Trabajador</th>
                <th >Servicios</th>
                <th >Ventas</th>
                <th >Asistencia</th>
                <th >Horas trabajadas</th>
                <th >Comisión</th>
                <th >Estado</th>
              </tr>
            </thead>
            <tbody>
              {trabajadores.length ? trabajadores.map((w) => (
                <Fragment key={w.id ?? w.nombre}>
                  <tr>
                    <td className="worker-name">
                      <button
                        type="button"
                        className="worker-toggle"
                        aria-expanded={abierta === w.id}
                        onClick={() => setAbierta(abierta === w.id ? null : w.id)}
                        title="Ver la comisión por servicio"
                      >
                        <ChevronRight size={16} />
                        {w.nombre}
                      </button>
                    </td>
                    <td >{w.servicios}</td>
                    <td >{formatoCLP(w.ventas)}</td>
                    <td >{w.asistencia === null ? '—' : `${w.asistencia}%`}</td>
                    <td >{w.horas} h</td>
                    <td >{formatoCLP(w.comision)}</td>
                    <td ><span className={`worker-status ${CLASE_ESTADO[w.estado] ?? ''}`}>{w.estado}</span></td>
                  </tr>
                  {abierta === w.id && (
                    <tr className="commission-detail">
                      <td colSpan="7">
                        <DetalleComision detalle={w.detalleComision} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )) : <tr><td colSpan="7" className="empty-row">No hay trabajadores registrados para la selección actual.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
