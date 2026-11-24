import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, History, X } from "lucide-react";
import { obtenerMovimientos } from "../api/inventario.api";

// Texto y color de cada motivo (dentro de la paleta del sistema)
const MOTIVOS = {
  // Automáticos
  REGISTRO: { texto: "Registro inicial", clase: "bg-emerald-100 text-emerald-700" },
  VENTA: { texto: "Venta", clase: "bg-sky-100 text-sky-800" },
  USO_SERVICIO: { texto: "Uso en servicio", clase: "bg-violet-100 text-violet-700" },
  ANULACION: { texto: "Anulación de venta", clase: "bg-amber-100 text-amber-800" },
  // Los elige la dueña al ajustar
  COMPRA: { texto: "Compra / reposición", clase: "bg-emerald-100 text-emerald-700" },
  DANADO: { texto: "Producto dañado o vencido", clase: "bg-red-100 text-red-700" },
  CORRECCION: { texto: "Corrección de conteo", clase: "bg-gray-100 text-gray-700" },
};

function leerFecha(texto) {
  const [anio, mes, dia] = texto.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

function textoHace(texto) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy - leerFecha(texto)) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

function Motivo({ codigo, cantidad }) {
  // Movimientos antiguos (sin motivo guardado): solo Entrada o Salida
  const info = MOTIVOS[codigo] ?? {
    texto: cantidad > 0 ? "Entrada" : "Salida",
    clase: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${info.clase}`}>
      {info.texto}
    </span>
  );
}

function Cantidad({ valor }) {
  const entrada = valor > 0;
  const Icono = entrada ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${
        entrada ? "text-emerald-700" : "text-amber-700"
      }`}
    >
      <Icono size={18} />
      {entrada ? `+${valor}` : valor}
    </span>
  );
}

const pastilla = (activo) =>
  `cursor-pointer rounded-full border px-4 py-1.5 text-base font-semibold ${
    activo
      ? "border-[#b5368f] bg-[#b5368f] text-white"
      : "border-[#e6b8d4] bg-white text-[#b5368f] hover:bg-[#fbeef6]"
  }`;

export function ModalHistorial({ registro, onCerrar }) {
  const ventana = useRef(null);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => {
    ventana.current.showModal();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    obtenerMovimientos(registro.id, controller.signal)
      .then((respuesta) => setMovimientos(respuesta.data.movimientos))
      .catch(() => {
        if (!controller.signal.aborted) setError("No se pudo cargar el historial.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [registro.id]);

  const entradas = movimientos.filter((m) => m.cantidad > 0).reduce((t, m) => t + m.cantidad, 0);
  const salidas = movimientos.filter((m) => m.cantidad < 0).reduce((t, m) => t + m.cantidad, 0);
  const visibles = movimientos.filter((m) =>
    filtro === "entradas" ? m.cantidad > 0 : filtro === "salidas" ? m.cantidad < 0 : true,
  );

  return (
    <dialog
      ref={ventana}
      onClose={onCerrar}
      aria-labelledby="titulo-historial"
      className="fixed inset-0 m-auto max-h-[90vh] w-11/12 max-w-3xl overflow-y-auto rounded-3xl bg-white p-0 text-[#1f1218] shadow-2xl backdrop:bg-black/40"
    >
      {/* Encabezado */}
      <div className="sticky top-0 z-10 border-b border-[#f0cfe3] bg-white px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#b5368f] text-white">
            <History size={20} />
          </span>
          <div className="min-w-0">
            <h2 id="titulo-historial" className="text-2xl font-bold text-[#1f1218]">
              Historial de movimientos
            </h2>
            <p className="text-base text-[#9c2d7b]">
              {registro.producto} · {registro.local}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ventana.current.close()}
            aria-label="Cerrar"
            className="ml-auto cursor-pointer self-start rounded-full p-2 text-[#1f1218] hover:bg-[#f7e3f1] hover:text-[#b5368f]"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-6">
        {/* Totales */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-[#e6b8d4] p-3">
            <p className="text-sm font-semibold text-[#9c2d7b]">Entradas</p>
            <p className="text-2xl font-bold text-emerald-700">+{entradas}</p>
          </div>
          <div className="rounded-2xl border border-[#e6b8d4] p-3">
            <p className="text-sm font-semibold text-[#9c2d7b]">Salidas</p>
            <p className="text-2xl font-bold text-amber-700">{salidas}</p>
          </div>
          <div className="rounded-2xl border border-[#e6b8d4] bg-[#fbeef6] p-3">
            <p className="text-sm font-semibold text-[#9c2d7b]">Stock actual</p>
            <p className="text-2xl font-bold">{registro.cantidad}</p>
          </div>
        </div>

        {/* Filtro */}
        <div role="group" aria-label="Filtrar movimientos" className="flex flex-wrap gap-2">
          {[
            ["todos", "Todos"],
            ["entradas", "Entradas"],
            ["salidas", "Salidas"],
          ].map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
              className={pastilla(filtro === id)}
            >
              {texto}
            </button>
          ))}
        </div>

        {/* Lista */}
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-800">{error}</p>
        ) : cargando ? (
          <p className="text-base font-medium text-[#9c2d7b]">Cargando historial…</p>
        ) : visibles.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-[#e6b8d4] p-6 text-center text-base text-[#9c2d7b]">
            No hay movimientos para mostrar.
          </p>
        ) : (
          <table className="w-full text-left text-base">
            <caption className="sr-only">Movimientos de stock</caption>
            <thead>
              <tr className="border-b border-[#e6b8d4] text-[#9c2d7b]">
                <th scope="col" className="py-2 pr-3 font-semibold">Fecha</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Movimiento</th>
                <th scope="col" className="hidden py-2 pr-3 font-semibold sm:table-cell">Motivo</th>
                <th scope="col" className="whitespace-nowrap py-2 text-right font-semibold">Quedó en</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((m) => (
                <tr key={m.id} className="border-b border-[#f7e3f1] hover:bg-[#fbeef6]">
                  <td className="py-3 pr-3">
                    <p className="whitespace-nowrap">{leerFecha(m.fecha).toLocaleDateString("es-CL")}</p>
                    <p className="text-sm text-gray-500">{textoHace(m.fecha)}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <Cantidad valor={m.cantidad} />
                    {/* En celular el motivo va debajo del movimiento */}
                    <div className="mt-1 sm:hidden"><Motivo codigo={m.motivo} cantidad={m.cantidad} /></div>
                  </td>
                  <td className="hidden py-3 pr-3 sm:table-cell"><Motivo codigo={m.motivo} cantidad={m.cantidad} /></td>
                  <td className="py-3 text-right font-bold">{m.stock_resultante}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </dialog>
  );
}
