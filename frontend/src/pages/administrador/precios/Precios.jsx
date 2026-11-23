import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { BadgeDollarSign, RotateCcw, Save, Search } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { guardarPrecio, obtenerPrecios } from "../../../api/precios.api";

// Precios de servicios y productos: un precio base y, si hace falta, un precio distinto por local
// (por ejemplo, en el Mall todo es más caro). Un local sin precio propio usa el precio base.

const soloNumeros = (texto) => texto.replace(/\D/g, "").slice(0, 8);

const FILTROS = [
  { valor: "TODOS", texto: "Todo" },
  { valor: "SERVICIO", texto: "Servicios" },
  { valor: "PRODUCTO", texto: "Productos" },
];

const mensajeError = (err) => {
  const d = err?.response?.data;
  if (!d) return "No hay conexión con el servidor.";
  const t = d.detail ?? Object.values(d)[0];
  return Array.isArray(t) ? t.join(" ") : typeof t === "object" ? Object.values(t).flat().join(" ") : String(t);
};

// Lo que se está escribiendo en una fila (todo como texto, para no perder el foco al escribir)
const borradorDe = (item) => ({
  base: String(item.precio_base),
  locales: Object.fromEntries(Object.entries(item.precios).map(([id, p]) => [id, p == null ? "" : String(p)])),
});

function FilaPrecio({ item, locales, onGuardado }) {
  const [borrador, setBorrador] = useState(() => borradorDe(item));
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setBorrador(borradorDe(item)), [item]);

  const original = borradorDe(item);
  const cambiado = JSON.stringify(original) !== JSON.stringify(borrador);
  const baseValida = borrador.base !== "";

  const guardar = async () => {
    if (!cambiado || !baseValida || guardando) return;
    setGuardando(true);
    try {
      const precios = Object.fromEntries(
        Object.entries(borrador.locales).map(([id, texto]) => [id, texto === "" ? null : Number(texto)])
      );
      const actualizado = await guardarPrecio(item.id, { precio_base: Number(borrador.base), precios });
      onGuardado(actualizado);
      toast.success(`Precios de «${item.nombre}» guardados`);
    } catch (err) {
      toast.error(`No se pudo guardar: ${mensajeError(err)}`);
    } finally {
      setGuardando(false);
    }
  };

  const campo = (valor, alCambiar, placeholder, etiqueta, destacado) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[#9c2d7b] lg:sr-only">{etiqueta}</span>
      <span className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`${etiqueta} de ${item.nombre}`}
          value={valor}
          placeholder={placeholder}
          onChange={(e) => alCambiar(soloNumeros(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && guardar()}
          className={`h-11 w-full rounded-lg border bg-white pl-7 pr-2 text-base text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30 ${
            destacado ? "border-[#b5368f] font-semibold" : "border-[#e6b8d4]"
          }`}
        />
      </span>
    </label>
  );

  return (
    <li className="grid gap-3 rounded-2xl border border-[#e6b8d4] bg-white p-4 shadow-sm lg:grid-cols-[minmax(12rem,1.4fr)_repeat(var(--columnas),minmax(7rem,1fr))_10rem] lg:items-center lg:rounded-none lg:border-0 lg:border-b lg:p-3 lg:shadow-none"
      style={{ "--columnas": locales.length + 1 }}>
      <div className="min-w-0">
        <p className="font-semibold text-[#1f1218]">
          {item.nombre}
          {!item.activo && <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Inactivo</span>}
        </p>
        <p className="text-sm text-gray-500">{item.tipo}</p>
      </div>
      {campo(borrador.base, (v) => setBorrador({ ...borrador, base: v }), "Precio", "Precio base", false)}
      {locales.map((l) => {
        const id = String(l.id);
        const texto = borrador.locales[id] ?? "";
        return (
          <div key={id}>
            {campo(texto, (v) => setBorrador({ ...borrador, locales: { ...borrador.locales, [id]: v } }),
              `${borrador.base || "—"} (base)`, l.nombre, texto !== "")}
          </div>
        );
      })}
      <div className="flex gap-2 lg:justify-end">
        <button
          type="button"
          onClick={() => setBorrador(original)}
          disabled={!cambiado || guardando}
          title="Deshacer cambios"
          aria-label={`Deshacer cambios de ${item.nombre}`}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-default disabled:opacity-30"
        >
          <RotateCcw size={18} />
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={!cambiado || !baseValida || guardando}
          className="flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#b5368f] px-4 font-semibold text-white hover:bg-[#9c2d7b] disabled:cursor-default disabled:opacity-30 lg:flex-none"
        >
          <Save size={18} /> {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </li>
  );
}

export function Precios() {
  useTitulo("Precios");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("TODOS");

  useEffect(() => {
    obtenerPrecios()
      .then(setDatos)
      .catch((err) => setError(mensajeError(err)));
  }, []);

  const visibles = useMemo(() => {
    if (!datos) return [];
    const texto = busqueda.trim().toLowerCase();
    return datos.items.filter(
      (i) => (filtro === "TODOS" || i.clase === filtro) && (!texto || i.nombre.toLowerCase().includes(texto))
    );
  }, [datos, busqueda, filtro]);

  const actualizar = (item) =>
    setDatos((actual) => ({ ...actual, items: actual.items.map((i) => (i.id === item.id ? item : i)) }));

  return (
    <Sidebar mostrarSelectorSucursal={false}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-[#1f1218]">
            <BadgeDollarSign className="text-[#b5368f]" size={30} /> Precios
          </h1>
          <p className="mt-1 text-base text-gray-600">
            Cada servicio y producto tiene un precio base. Si un local cobra distinto (por ejemplo, el Mall),
            escribe su precio en la columna de ese local; si la dejas vacía, ese local usa el precio base.
            Los cambios rigen para las ventas nuevas: las ya registradas no cambian.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <span className="sr-only">Buscar</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar servicio o producto"
              className="h-12 w-full rounded-lg border border-[#e6b8d4] bg-white pl-10 pr-3 text-base focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30"
            />
          </label>
          <div className="flex overflow-hidden rounded-lg border border-[#e6b8d4] bg-white" role="group" aria-label="Mostrar">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltro(f.valor)}
                aria-pressed={filtro === f.valor}
                className={`h-12 cursor-pointer px-4 text-base font-semibold ${
                  filtro === f.valor ? "bg-[#b5368f] text-white" : "text-[#b5368f] hover:bg-[#fbeef6]"
                }`}
              >
                {f.texto}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
        {!datos && !error && <p role="status" className="text-gray-600">Cargando precios…</p>}

        {datos && (
          <div className="lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[#e6b8d4] lg:bg-white">
            <div
              className="hidden bg-[#b5368f] px-3 py-3 text-sm font-semibold text-white lg:grid lg:grid-cols-[minmax(12rem,1.4fr)_repeat(var(--columnas),minmax(7rem,1fr))_10rem] lg:gap-3"
              style={{ "--columnas": datos.locales.length + 1 }}
              aria-hidden="true"
            >
              <span>Servicio o producto</span>
              <span>Precio base</span>
              {datos.locales.map((l) => <span key={l.id}>{l.nombre}</span>)}
              <span />
            </div>
            <ul className="flex flex-col gap-3 lg:gap-0">
              {visibles.map((item) => (
                <FilaPrecio key={item.id} item={item} locales={datos.locales} onGuardado={actualizar} />
              ))}
              {visibles.length === 0 && <li className="p-6 text-center text-gray-500">No hay resultados.</li>}
            </ul>
          </div>
        )}
        <p className="text-sm text-gray-500">
          Los insumos no aparecen aquí porque no se cobran en la venta.
        </p>
      </div>
    </Sidebar>
  );
}
