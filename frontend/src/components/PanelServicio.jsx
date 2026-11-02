import { useState } from "react";
import { ESPECIALISTAS, SERVICIOS } from "../data/catalogo";

const clp = (n) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

const MONTO_MAXIMO = 1000000;
const NOMBRE_MAXIMO = 40;

export function PanelServicio({ servicios, setServicios }) {
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState("");
  const [elegidas, setElegidas] = useState([]); // ids de las especialistas elegidas
  const [nombreOtro, setNombreOtro] = useState("");
  const [monto, setMonto] = useState("");
  const [errores, setErrores] = useState({});
  const disponibles = ESPECIALISTAS.filter((e) => e.presente);

  const servicioElegido = SERVICIOS.find((s) => s.id === Number(elegido));
  const esOtro = Boolean(servicioElegido?.precioVariable);

  const limpiar = () => {
    setElegido("");
    setElegidas([]);
    setNombreOtro("");
    setMonto("");
    setErrores({});
  };

  const cerrar = () => {
    limpiar();
    setAbierto(false);
  };

  const cambiarEspecialista = (indice, valor) => {
    setElegidas(elegidas.map((id, i) => (i === indice ? valor : id)));
  };

  const agregarSelector = () => {
    if (elegidas.length >= disponibles.length) {
      setErrores({ ...errores, especialista: "No hay más especialistas presentes" });
      return;
    }
    setErrores({ ...errores, especialista: undefined });
    setElegidas([...elegidas, ""]);
  };

  const quitarSelector = (indice) => {
    setElegidas(elegidas.filter((_, i) => i !== indice));
  };

  const guardar = () => {
    const nuevos = {};
    if (!elegido) nuevos.servicio = "Selecciona un servicio";
    if (elegidas.length === 0) {
      nuevos.especialista = "Agrega al menos una especialista";
    } else if (elegidas.some((id) => !id)) {
      nuevos.especialista = "Selecciona todas las especialistas o quita las que sobran";
    }
    if (esOtro && nombreOtro.trim().length < 2) nuevos.nombre = "Escribe el nombre del servicio";
    if (esOtro && !(Number(monto) > 0)) nuevos.monto = "Ingresa un monto mayor a 0";
    else if (esOtro && Number(monto) > MONTO_MAXIMO) nuevos.monto = `El monto máximo es ${clp(MONTO_MAXIMO)}`;
    if (!esOtro && servicioElegido && servicios.some((s) => s.id === servicioElegido.id)) {
      nuevos.servicio = "Ese servicio ya está agregado";
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    const trabajadoras = elegidas
      .map((id) => ESPECIALISTAS.find((e) => e.id === Number(id)))
      .filter(Boolean);
    if (!servicioElegido || trabajadoras.length === 0) return;

    setServicios([
      ...servicios,
      {
        ...servicioElegido,
        uid: `${Date.now()}-${Math.random()}`,
        nombre: esOtro ? nombreOtro.trim() : servicioElegido.nombre,
        precio: esOtro ? Number(monto) : servicioElegido.precio,
        especialistas: trabajadoras.map((t) => ({ id: t.id, nombre: t.nombre })),
      },
    ]);
    cerrar();
  };

  const selector = (hayError) =>
    `h-12 w-full cursor-pointer rounded-lg border bg-white px-3 text-lg ${
      hayError ? "border-red-500" : "border-gray-200"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="h-14 w-full cursor-pointer rounded-lg bg-[#b5368f] text-lg font-semibold text-white hover:bg-[#9c2d7b]"
        >
          Agregar servicio +
        </button>
      )}

      <div
        inert={!abierto}
        className={`grid transition-all duration-300 ease-in-out ${
          abierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-5 rounded-2xl bg-white/60 p-5">
            <div>
              <label className="mb-1 block text-base font-medium text-[#1f1218]">Servicio *</label>
              <select
                value={elegido}
                onChange={(e) => {
                  setElegido(e.target.value);
                  setErrores({});
                }}
                className={selector(errores.servicio)}
              >
                <option value="">Selecciona un servicio</option>
                {SERVICIOS.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
              {errores.servicio && <p className="mt-1 text-base text-red-600">{errores.servicio}</p>}
            </div>

            {esOtro && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-base font-medium text-[#1f1218]">
                    Nombre del servicio *
                  </label>
                  <input
                    type="text"
                    maxLength={NOMBRE_MAXIMO}
                    value={nombreOtro}
                    onChange={(e) => setNombreOtro(e.target.value)}
                    placeholder="Ej: Corte especial"
                    className={`${selector(errores.nombre)} cursor-text`}
                  />
                  {errores.nombre && <p className="mt-1 text-base text-red-600">{errores.nombre}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-base font-medium text-[#1f1218]">Monto (CLP) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={String(MONTO_MAXIMO).length}
                      value={monto}
                      onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))}
                      placeholder="Ej: 12000"
                      className={`${selector(errores.monto)} cursor-text pl-7`}
                    />
                  </div>
                  {errores.monto && <p className="mt-1 text-base text-red-600">{errores.monto}</p>}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {elegidas.map((id, i) => (
                <div key={i}>
                  <label className="mb-1 block text-base font-medium text-[#1f1218]">
                    {elegidas.length === 1 ? "Especialista *" : `Especialista ${i + 1} *`}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={id}
                      onChange={(e) => cambiarEspecialista(i, e.target.value)}
                      className={selector(errores.especialista && !id)}
                    >
                      <option value="">Seleccionar un especialista</option>
                      {disponibles
                        .filter((e) => !elegidas.some((otra, j) => j !== i && Number(otra) === e.id))
                        .map((e) => (
                          <option key={e.id} value={e.id}>{e.nombre}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => quitarSelector(i)}
                      className="h-12 w-12 shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-white text-lg text-gray-600 hover:bg-gray-50"
                      aria-label="Quitar especialista"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {errores.especialista && <p className="text-base text-red-600">{errores.especialista}</p>}
              <button
                type="button"
                onClick={agregarSelector}
                className="h-11 cursor-pointer rounded-lg border border-[#b5368f] bg-white text-base font-semibold text-[#b5368f] hover:bg-[#fbeef6]"
              >
                + Agregar especialista
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={guardar}
                className="h-12 cursor-pointer rounded-lg bg-[#b5368f] text-base font-semibold text-white hover:bg-[#9c2d7b]"
              >
                Guardar servicio
              </button>
              <button
                type="button"
                onClick={cerrar}
                className="h-12 cursor-pointer rounded-lg border border-gray-300 bg-white text-base font-semibold text-gray-700 hover:bg-gray-50"
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