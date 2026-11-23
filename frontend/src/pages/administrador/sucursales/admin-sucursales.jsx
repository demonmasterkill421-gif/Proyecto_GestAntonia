import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { cargarSucursales, guardarSucursalId } from "../../../hooks/useSucursal";
import { crearLocal, editarLocal, obtenerLocalesGestion } from "../../../api/locales.api";
import { erroresDe } from "../../../api/gestionUsuarios.api";
import { TarjetaSucursal } from "../../../components/TarjetaSucursal";

const campo =
  "w-full rounded-lg border border-[#e6b8d4] bg-white px-3 text-base text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30";
const etiqueta = "mb-1 block text-sm font-semibold text-[#1f1218]";

// Crear o editar un local. Los locales no se borran: se dejan Inactivos (conservan ventas y asistencias).
function FormLocal({ inicial, onCerrar, onGuardado }) {
  const editando = Boolean(inicial?.id);
  const [datos, setDatos] = useState({
    nombre: inicial?.nombre ?? "",
    ubicacion: inicial?.ubicacion ?? "",
    descripcion: inicial?.descripcion ?? "",
    estado: inicial?.estado ?? "ACTIVO",
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const cambiar = (nombre) => (e) => {
    setDatos({ ...datos, [nombre]: e.target.value });
    setErrores({ ...errores, [nombre]: undefined, general: undefined });
  };

  useEffect(() => {
    const alPresionar = (e) => e.key === "Escape" && !guardando && onCerrar();
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [guardando, onCerrar]);

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    try {
      const { data } = editando ? await editarLocal(inicial.id, datos) : await crearLocal(datos);
      toast.success(editando ? `Se guardó «${data.nombre}»` : `Local «${data.nombre}» creado`);
      onGuardado();
    } catch (err) {
      setErrores(erroresDe(err, true));
    } finally {
      setGuardando(false);
    }
  };

  const error = (nombre) => errores[nombre] && <p className="mt-1 text-sm font-medium text-red-700">{errores[nombre]}</p>;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={() => !guardando && onCerrar()}>
      <form onSubmit={guardar} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="titulo-local"
        className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-[#f0cfe3] px-6 py-5">
          <h2 id="titulo-local" className="text-2xl font-bold text-[#1f1218]">{editando ? "Editar local" : "Nuevo local"}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto cursor-pointer rounded-full p-2 hover:bg-[#f7e3f1]">
            <X size={24} />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto px-6 py-5">
          <div>
            <label htmlFor="l-nombre" className={etiqueta}>Nombre *</label>
            <input id="l-nombre" required autoFocus maxLength={80} value={datos.nombre} onChange={cambiar("nombre")}
              placeholder="Ej.: Local Centro 3" className={`${campo} h-12`} />
            {error("nombre")}
          </div>
          <div>
            <label htmlFor="l-ubicacion" className={etiqueta}>Ubicación *</label>
            <input id="l-ubicacion" required maxLength={150} value={datos.ubicacion} onChange={cambiar("ubicacion")}
              placeholder="Ej.: Sotomayor 1234, Calama" className={`${campo} h-12`} />
            {error("ubicacion")}
          </div>
          <div>
            <label htmlFor="l-descripcion" className={etiqueta}>Descripción</label>
            <textarea id="l-descripcion" rows={3} value={datos.descripcion} onChange={cambiar("descripcion")} className={`${campo} py-2`} />
            {error("descripcion")}
          </div>
          {editando && (
            <div>
              <label htmlFor="l-estado" className={etiqueta}>Estado</label>
              <select id="l-estado" value={datos.estado} onChange={cambiar("estado")} className={`${campo} h-12`}>
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo (cerrado; se conservan sus ventas y asistencias)</option>
              </select>
              {error("estado")}
            </div>
          )}
          {errores.general && <p role="alert" className="text-base font-medium text-red-700">{errores.general}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-[#f0cfe3] px-6 py-4">
          <button type="button" onClick={onCerrar} disabled={guardando}
            className="h-12 cursor-pointer rounded-lg border border-gray-300 bg-white px-5 font-semibold text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="h-12 cursor-pointer rounded-lg bg-[#b5368f] px-6 font-semibold text-white hover:bg-[#9c2d7b] disabled:opacity-50">
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear local"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AdminSucursales() {
  useTitulo("Sucursales");
  const navigate = useNavigate();

  // A3: los locales vienen de la base de datos (API), no de datos de ejemplo
  const [locales, setLocales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [formulario, setFormulario] = useState(null); // null cerrado · {} nuevo · local a editar

  const cargar = useCallback(() => {
    return obtenerLocalesGestion()
      .then(({ data }) => {
        setLocales(data);
        setError("");
      })
      .catch(() => setError("No se pudieron cargar los locales."))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Deja elegido ese local (avisa al selector del encabezado) y va a la pantalla pedida
  const ir = (id, ruta) => {
    guardarSucursalId(id);
    navigate(ruta);
  };

  return (
    <Sidebar>
      {/* Los márgenes negativos anulan el espacio del contenedor para que el rosa llegue hasta los bordes */}
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-[#f7e3f1] p-4 sm:-m-8 sm:min-h-[calc(100vh-5rem)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-bold text-[#a8238f] sm:text-4xl">Selector de sucursal</h1>
          <button type="button" onClick={() => setFormulario({})}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-[#b5368f] px-5 text-lg font-semibold text-white hover:bg-[#9c2d7b]">
            <Plus size={20} /> Nuevo local
          </button>
        </div>

        {cargando && <p className="text-lg text-gray-700">Cargando locales…</p>}
        {error && <p className="text-lg font-medium text-red-600">{error}</p>}
        {!cargando && !error && locales.length === 0 && (
          <p className="text-lg text-gray-700">Aún no hay locales registrados. Crea el primero con «Nuevo local».</p>
        )}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {locales.map((s) => (
            <TarjetaSucursal
              key={s.id}
              sucursal={s}
              onVerVentas={() => ir(s.id, "/admin/ventas")}
              onVerAsistencia={() => ir(s.id, "/admin/asistencia")}
              onVerReporte={() => ir(s.id, "/admin/reportes")}
              onEditar={() => setFormulario(s)}
            />
          ))}
        </div>
      </div>

      {formulario && (
        <FormLocal
          inicial={formulario}
          onCerrar={() => setFormulario(null)}
          onGuardado={() => {
            setFormulario(null);
            cargar();
            cargarSucursales(); // el selector del encabezado y los filtros muestran el local nuevo
          }}
        />
      )}
    </Sidebar>
  );
}
