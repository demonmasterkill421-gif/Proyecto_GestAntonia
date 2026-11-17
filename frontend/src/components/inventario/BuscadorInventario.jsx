export function BuscadorInventario({ filtros, onChange, locales }) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-gray-200 bg-white p-5">
      <label className="min-w-56 flex-1 text-sm font-medium text-gray-700">
        Buscar producto
        <input type="search" value={filtros.busqueda} maxLength={100}
          onChange={(e) => onChange({ ...filtros, busqueda: e.target.value })}
          placeholder="Ej.: esmalte, algodón…"
          className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2" />
      </label>
      <label className="text-sm font-medium text-gray-700">
        Local
        <select value={filtros.local} onChange={(e) => onChange({ ...filtros, local: e.target.value })}
          className="mt-2 block rounded-lg border border-gray-300 bg-white px-3 py-2">
          <option value="">Todos los locales</option>
          {locales.map((local) => <option key={local.id} value={local.id}>{local.nombre}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 py-2 text-sm text-gray-700">
        <input type="checkbox" checked={filtros.bajo_minimo}
          onChange={(e) => onChange({ ...filtros, bajo_minimo: e.target.checked })} />
        Solo stock bajo
      </label>
      <button type="button" onClick={() => onChange({ busqueda: "", local: "", bajo_minimo: false })}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Limpiar filtros</button>
    </div>
  );
}
