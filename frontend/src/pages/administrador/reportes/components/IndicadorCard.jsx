export default function IndicadorCard({ titulo, valor, detalle, tono = 'muted' }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{titulo}</p>
      <strong className="stat-value">{valor}</strong>
      {detalle && <p className={`stat-note ${tono}`}>{detalle}</p>}
    </article>
  );
}
