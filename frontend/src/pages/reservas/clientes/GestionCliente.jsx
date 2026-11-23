// Corregir o eliminar los datos de una clienta (ley 21.719: derechos de rectificación y supresión · Edson).
// Recepción y administración corrigen nombre y teléfono. Solo la administradora elimina los datos:
// se borran nombre, teléfono y observación, y sus reservas pasadas quedan sin datos personales.
import { useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import { useAuth } from "../../../auth/AuthContext";
import { editarCliente, eliminarDatosCliente } from "../../../api/reservas.api";

const CAMPO =
  "w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 focus:border-[#b5368f] focus:outline-none";

// La API responde { campo: ["mensaje"] } o { detail: "mensaje" }
const primerMensaje = (valor) => (Array.isArray(valor) ? valor[0] : valor);
const mensajeDe = (error) =>
  primerMensaje(error.response?.data?.detail) || "No se pudo guardar. Revise su conexión e intente de nuevo.";

export function GestionCliente({ cliente, onActualizada, onEliminada }) {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "ADMIN";

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(cliente.nombre);
  const [telefono, setTelefono] = useState(cliente.telefono);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  const abrirEdicion = () => {
    setNombre(cliente.nombre);
    setTelefono(cliente.telefono);
    setErrores({});
    setEditando(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    try {
      const { data } = await editarCliente(cliente.id, { nombre, telefono });
      toast.success("Datos de la clienta actualizados");
      setEditando(false);
      onActualizada(data);
    } catch (error) {
      if (error.response?.status === 400 && (error.response.data?.nombre || error.response.data?.telefono)) {
        setErrores(error.response.data);
      } else {
        toast.error(mensajeDe(error));
      }
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    setGuardando(true);
    try {
      await eliminarDatosCliente(cliente.id);
      toast.success("Se eliminaron los datos de la clienta");
      setConfirmar(false);
      onEliminada();
    } catch (error) {
      toast.error(mensajeDe(error));
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mb-4">
      {editando ? (
        <form onSubmit={guardar} noValidate className="rounded-lg border border-gray-200 bg-white p-4">
          <h4 className="mb-3 font-semibold text-[#1f1218]">Corregir datos de la clienta</h4>
          <div className="mb-3">
            <label htmlFor="editar-nombre" className="mb-1 block text-sm font-medium text-gray-700">Nombre completo</label>
            <input id="editar-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
            {errores.nombre && <p className="mt-1 text-sm text-red-700">{primerMensaje(errores.nombre)}</p>}
          </div>
          <div className="mb-4">
            <label htmlFor="editar-telefono" className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
            <input id="editar-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={CAMPO} />
            {errores.telefono && <p className="mt-1 text-sm text-red-700">{primerMensaje(errores.telefono)}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={guardando}
              className="min-h-[44px] rounded-lg bg-[#b5368f] px-5 font-medium text-white hover:bg-[#9c2d7b] disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-5 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={abrirEdicion}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#b5368f] bg-white px-4 font-medium text-[#b5368f] hover:bg-[#f7e3f1]"
          >
            <Pencil size={18} aria-hidden="true" /> Corregir datos
          </button>
          {esAdmin && (
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-red-300 bg-white px-4 font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 size={18} aria-hidden="true" /> Eliminar sus datos
            </button>
          )}
        </div>
      )}

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"
             aria-labelledby="titulo-eliminar">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 id="titulo-eliminar" className="mb-3 text-xl font-bold text-[#1f1218]">
              ¿Eliminar los datos de {cliente.nombre}?
            </h2>
            <p className="mb-2 text-gray-700">
              Úselo solo si la clienta lo pidió (ley 21.719). Se borrarán su nombre, su teléfono y la observación.
            </p>
            <p className="mb-5 text-gray-700">
              Sus reservas pasadas se conservan sin datos personales. <strong>No se puede deshacer.</strong>
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmar(false)}
                className="min-h-[44px] rounded-lg border border-gray-300 px-5 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminar}
                disabled={guardando}
                className="min-h-[44px] rounded-lg bg-red-700 px-5 font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {guardando ? "Eliminando…" : "Sí, eliminar datos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
