
import {
  Database,
  CalendarCheck2,
  UsersRound,
  ChartNoAxesColumnIncreasing
} from 'lucide-react';


// Los íconos son únicamente decorativos: los indicadores mantienen los datos originales.

const iconos = {
  'Ganancias del período': Database,
  'Servicios realizados': CalendarCheck2,
  'Trabajadores activos': UsersRound,
  'Asistencia promedio': ChartNoAxesColumnIncreasing,
};


export default function IndicadorCard({ titulo, valor, detalle, tono = 'muted' }) {
  const Icono = iconos[titulo] || ChartNoAxesColumnIncreasing;
  const colorNota = tono === 'positive' ? 'positive' : tono === 'accent' ? 'accent' : 'muted';

  return (
    <article className="stat-card">
      <div className="stat-icon" aria-hidden="true">
        <Icono size={27} strokeWidth={2.1} />
      </div>
      <div className="stat-copy">
        <p className="stat-label">{titulo}</p>
        <strong className="stat-value">{valor}</strong>
        {detalle && <p className={`stat-note ${colorNota}`}>{detalle}</p>}
      </div>
    </article>
  );
}
