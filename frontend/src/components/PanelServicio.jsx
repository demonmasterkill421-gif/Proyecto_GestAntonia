import { useState } from "react";
import { Pencil, Plus, Sparkles } from "lucide-react";
import { ESPECIALISTAS } from "../data/catalogo";
import { useDatos } from "../hooks/useDatos";
import { obtenerServiciosVenta } from "../api/ventas.api";

const clp = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

const MONTO_MAXIMO = 100000;
const NOMBRE_MAXIMO = 100;

// Servicio libre (nombre y monto a mano). Aún no existe en la base de datos.
const OTRO = { id: "otro", nombre: "Otro", precio: 0, precioVariable: true };

export function PanelServicio({ servicios, setServicios }) {
  const { datos: serviciosApi, cargando, error } = useDatos(obtenerServiciosVenta, { cadaMs: 60000 });

  const [abierto, setAbierto] = useState(false);
  const [editandoUid, setEditandoUid] = useState(null); // uid del servicio que se está editando
  const [elegido, setElegido] = useState("");
  const [nombreOtro, setNombreOtro] = useState("");
  const [montoOtro, setMontoOtro] = useState("");
  const [especialista, setEspecialista] = useState("");
  const [errores, setErrores] = useState({});

  const presentes = ESPECIALISTAS.filter((e) => e.presente);
  const catalogo = [...serviciosApi, OTRO];
  const servicioElegido = catalogo.find((s) => String(s.id) === String(elegido));
  const esOtro = servicioElegido?.precioVariable;

  const limpiar = () => {
    setEditandoUid(null);
    setElegido("");
    setNombreOtro("");
    setMontoOtro("");
    setEspecialista("");
    setErrores({});
  };

  const cerrar = () => {
    limpiar();
    setAbierto(false);
  };

  // Carga un servicio de la lista en el formulario para modificarlo.
  const editar = (s) => {
    setEditandoUid(s.uid);
    setElegido(String(s.id));
    setNombreOtro(s.precioVariable ? s.nombre : "");
    setMontoOtro(s.precioVariable ? String(s.precio) : "");
    setEspecialista(String(s.especialistas[0].id));
    setErrores({});
    setAbierto(true);
  };

  const quitar = (uid) => {
    setServicios(servicios.filter((x) => x.uid !== uid));
    if (uid === editandoUid) cerrar(); // si se borra el que se estaba editando, se cierra el formulario
  };

  const guardar = () => {
    const nuevos = {};
    if (!servicioElegido) nuevos.servicio = "Selecciona un servicio";
    if (esOtro && !nombreOtro.trim()) nuevos.nombre = "Escribe el nombre del servicio";
    if (esOtro && !(Number(montoOtro) > 0)) nuevos.monto = "Escribe un monto mayor a 0";
    if (esOtro && Number(montoOtro) > MONTO_MAXIMO) nuevos.monto = `El monto máximo es ${clp(MONTO_MAXIMO)}`;
    if (!especialista) nuevos.especialista = "Selecciona una especialista";
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    const persona = presentes.find((e) => String(e.id) === String(especialista));
    const nuevo = {
      ...servicioElegido,
      nombre: esOtro ? nombreOtro.trim() : servicioElegido.nombre,
      precio: esOtro ? Number(montoOtro) : Number(servicioElegido.precio),
      especialistas: [{ id: persona.id, nombre: persona.nombre, porcentaje: 100 }],
    };

    if (editandoUid) {
      // Edición: reemplaza el servicio en su misma posición, conservando su uid.
      setServicios(servicios.map((x) => (x.uid === editandoUid ? { ...nuevo, uid: x.uid } : x)));
    } else {
      setServicios([...servicios, { ...nuevo, uid: `${Date.now()}-${Math.random()}` }]);
    }
    cerrar();
  };

  const campo = (hayError) =>
    `h-12 w-full rounded-lg border bg-white px-3 text-lg text-[#1f1218] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30 ${
      hayError ? "border-red-500" : "border-[#e6b8d4] focus:border-[#b5368f]"
    }`;

  const etiqueta = "mb-1 block text-base font-semibold text-[#9c2d7b]";

  return (
    <div className="flex flex-col gap-4">
      <ul className={servicios.length > 0 ? "flex flex-col gap-2" : "hidden"}>
        {servicios.map((s) => (
          <li
            key={s.uid}
            className={`flex items-center justify-between gap-3 rounded-xl border-l-4 border-[#b5368f] bg-white px-4 py-3 shadow-sm shadow-[#b5368f]/10 ${
              editandoUid === s.uid ? "ring-2 ring-[#b5368f]" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f7e3f1] text-[#b5368f]">
                <Sparkles size={20} />
              </span>
              <div>
                <p className="text-lg font-bold text-[#b5368f]">{s.nombre}</p>
                <p className="text-base text-gray-600">{s.especialistas.map((e) => e.nombre).join(", ")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-[#9c2d7b]">{clp(s.precio)}</span>
              <button
                type="button"
                onClick={() => editar(s)}
                className="cursor-pointer rounded-full p-2 text-[#b5368f] hover:bg-[#fbeef6]"
                aria-label="Editar servicio"
                title="Editar"
              >
                <Pencil size={20} />
              </button>
              <button
                type="button"
                onClick={() => quitar(s.uid)}
                className="cursor-pointer rounded-full px-2 py-1 text-lg text-gray-500 hover:bg-red-50 hover:text-red-600"
                aria-label="Quitar servicio"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#b5368f] text-lg font-semibold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b]"
        >
          <Plus size={22} />
          Agregar servicio
        </button>
      )}

      <div
        inert={!abierto}
        className={`grid transition-all duration-300 ease-in-out ${
          abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-5 rounded-2xl border border-[#e6b8d4] bg-white p-5 shadow-sm shadow-[#b5368f]/10">
            <p className="flex items-center gap-2 text-lg font-bold text-[#b5368f]">
              <Sparkles size={20} />
              {editandoUid ? "Editando servicio" : "Nuevo servicio"}
            </p>

            <div>
              <label className={etiqueta}>Servicio *</label>
              <select
                value={elegido}
                onChange={(e) => {
                  setElegido(e.target.value);
                  setErrores({});
                }}
                className={`${campo(errores.servicio)} cursor-pointer`}
              >
                <option value="">
                  {cargando ? "Cargando servicios..." : "Selecciona un servicio"}
                </option>
                {catalogo.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.precioVariable ? s.nombre : `${s.nombre} - ${clp(s.precio)}`}
                  </option>
                ))}
              </select>
              {error && <p className="mt-1 text-base text-[#b5368f]">{error}</p>}
              {errores.servicio && <p className="mt-1 text-base text-red-600">{errores.servicio}</p>}
            </div>

            {esOtro && (
              <>
                <div>
                  <label className={etiqueta}>Nombre del servicio *</label>
                  <input
                    type="text"
                    maxLength={NOMBRE_MAXIMO}
                    value={nombreOtro}
                    onChange={(e) => setNombreOtro(e.target.value)}
                    className={`${campo(errores.nombre)} cursor-text`}
                  />
                  {errores.nombre && <p className="mt-1 text-base text-red-600">{errores.nombre}</p>}
                </div>
                <div>
                  <label className={etiqueta}>Monto (CLP) *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={montoOtro}
                    onChange={(e) => setMontoOtro(e.target.value.replace(/\D/g, ""))}
                    className={`${campo(errores.monto)} cursor-text`}
                  />
                  {errores.monto && <p className="mt-1 text-base text-red-600">{errores.monto}</p>}
                </div>
              </>
            )}

            <div>
              <label className={etiqueta}>Especialista *</label>
              <select
                value={especialista}
                onChange={(e) => setEspecialista(e.target.value)}
                className={`${campo(errores.especialista)} cursor-pointer`}
              >
                <option value="">Selecciona una especialista</option>
                {presentes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              {errores.especialista && <p className="mt-1 text-base text-red-600">{errores.especialista}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={guardar}
                className="h-12 cursor-pointer rounded-lg bg-[#b5368f] text-base font-semibold text-white shadow-md shadow-[#b5368f]/30 hover:bg-[#9c2d7b]"
              >
                {editandoUid ? "Guardar cambios" : "Guardar servicio"}
              </button>
              <button
                type="button"
                onClick={cerrar}
                className="h-12 cursor-pointer rounded-lg border border-[#b5368f] bg-white text-base font-semibold text-[#b5368f] hover:bg-[#fbeef6]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}