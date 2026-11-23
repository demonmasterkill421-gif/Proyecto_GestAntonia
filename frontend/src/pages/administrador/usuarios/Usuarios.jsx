import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, EyeOff, Pencil, Plus, Power, UserCog, X } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { useAuth } from "../../../auth/AuthContext";
import { obtenerLocalesGestion } from "../../../api/locales.api";
import {
  activarUsuario,
  crearUsuario,
  desactivarUsuario,
  editarUsuario,
  erroresDe,
  listarUsuarios,
  rolesDisponibles,
} from "../../../api/gestionUsuarios.api";

// Usuarios del sistema que no son especialistas: recepcionistas y administradoras (y otros roles a futuro).
// Las especialistas se gestionan en Especialistas porque llevan servicios y comisiones.

const VACIO = { nombre: "", apellido: "", email: "", rol: "", local: "", clave: "" };
const campo =
  "h-12 w-full rounded-lg border border-[#e6b8d4] bg-white px-3 text-base text-[#1f1218] focus:border-[#b5368f] focus:outline-none focus:ring-2 focus:ring-[#b5368f]/30";
const etiqueta = "mb-1 block text-sm font-semibold text-[#1f1218]";

function FormUsuario({ inicial, roles, locales, onCerrar, onGuardado }) {
  const editando = Boolean(inicial?.id);
  const [datos, setDatos] = useState(
    editando
      ? { nombre: inicial.nombre, apellido: inicial.apellido, email: inicial.email, rol: inicial.rol,
          local: inicial.local ?? "", clave: "" }
      : { ...VACIO, rol: roles.find((r) => r.valor === "RECEP")?.valor ?? roles[0]?.valor ?? "" }
  );
  const [errores, setErrores] = useState({});
  const [verClave, setVerClave] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const rolElegido = roles.find((r) => r.valor === datos.rol);
  const cambiar = (nombre) => (e) => {
    setDatos({ ...datos, [nombre]: e.target.value });
    setErrores({ ...errores, [nombre]: undefined, general: undefined });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    const envio = { nombre: datos.nombre.trim(), apellido: datos.apellido.trim(), email: datos.email.trim(),
                    rol: datos.rol, local: datos.local === "" ? null : Number(datos.local) };
    if (datos.clave) envio.clave = datos.clave;
    try {
      const { data } = editando ? await editarUsuario(inicial.id, envio) : await crearUsuario(envio);
      toast.success(editando ? `Se guardaron los cambios de ${data.nombre}` : `Cuenta de ${data.nombre} creada`);
      onGuardado();
    } catch (err) {
      setErrores(erroresDe(err, true));
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    const alPresionar = (e) => e.key === "Escape" && !guardando && onCerrar();
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [guardando, onCerrar]);

  const error = (nombre) => errores[nombre] && <p className="mt-1 text-sm font-medium text-red-700">{errores[nombre]}</p>;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={() => !guardando && onCerrar()}>
      <form
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-usuario"
        className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
      >
        <div className="flex items-center gap-3 border-b border-[#f0cfe3] px-6 py-5">
          <h2 id="titulo-usuario" className="text-2xl font-bold text-[#1f1218]">
            {editando ? `Editar a ${inicial.nombre}` : "Nuevo usuario"}
          </h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="ml-auto cursor-pointer rounded-full p-2 hover:bg-[#f7e3f1]">
            <X size={24} />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <div>
            <label htmlFor="u-nombre" className={etiqueta}>Nombre *</label>
            <input id="u-nombre" required value={datos.nombre} onChange={cambiar("nombre")} className={campo} autoFocus />
            {error("nombre")}
          </div>
          <div>
            <label htmlFor="u-apellido" className={etiqueta}>Apellido</label>
            <input id="u-apellido" value={datos.apellido} onChange={cambiar("apellido")} className={campo} />
            {error("apellido")}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="u-email" className={etiqueta}>Correo (con este inicia sesión) *</label>
            <input id="u-email" type="email" required value={datos.email} onChange={cambiar("email")} className={campo} autoComplete="off" />
            {error("email")}
          </div>
          <div>
            <label htmlFor="u-rol" className={etiqueta}>Rol *</label>
            <select id="u-rol" value={datos.rol} onChange={cambiar("rol")} className={campo}>
              {roles.map((r) => <option key={r.valor} value={r.valor}>{r.nombre}</option>)}
            </select>
            {error("rol")}
          </div>
          <div>
            <label htmlFor="u-local" className={etiqueta}>Local {rolElegido?.necesita_local ? "*" : "(opcional)"}</label>
            <select id="u-local" value={datos.local} onChange={cambiar("local")} className={campo} required={rolElegido?.necesita_local}>
              <option value="">{rolElegido?.necesita_local ? "Elige un local" : "Todos (sin local fijo)"}</option>
              {locales.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}{l.estado === "INACTIVO" ? " (inactivo)" : ""}</option>
              ))}
            </select>
            {error("local")}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="u-clave" className={etiqueta}>
              {editando ? "Contraseña nueva (déjala vacía para no cambiarla)" : "Contraseña *"}
            </label>
            <div className="relative">
              <input id="u-clave" type={verClave ? "text" : "password"} value={datos.clave} onChange={cambiar("clave")}
                required={!editando} autoComplete="new-password" placeholder="Mínimo 10 caracteres" className={`${campo} pr-12`} />
              <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#b5368f]">
                {verClave ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {error("clave")}
            <p className="mt-1 text-xs text-gray-500">Entrégale la contraseña en persona; no la envíes por chat ni correo.</p>
          </div>
          {errores.general && <p role="alert" className="text-base font-medium text-red-700 sm:col-span-2">{errores.general}</p>}
        </div>

        <div className="flex justify-end gap-3 border-t border-[#f0cfe3] px-6 py-4">
          <button type="button" onClick={onCerrar} disabled={guardando}
            className="h-12 cursor-pointer rounded-lg border border-gray-300 bg-white px-5 font-semibold text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="h-12 cursor-pointer rounded-lg bg-[#b5368f] px-6 font-semibold text-white hover:bg-[#9c2d7b] disabled:opacity-50">
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function Usuarios() {
  useTitulo("Usuarios");
  const { usuario: yo } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [locales, setLocales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [formulario, setFormulario] = useState(null); // null cerrado · {} nuevo · usuario a editar
  const [ocupado, setOcupado] = useState(null);

  const cargar = () =>
    listarUsuarios()
      .then(({ data }) => { setUsuarios(data); setError(""); })
      .catch((err) => setError(erroresDe(err)))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
    rolesDisponibles().then(({ data }) => setRoles(data)).catch(() => setRoles([]));
    obtenerLocalesGestion().then(({ data }) => setLocales(data)).catch(() => setLocales([]));
  }, []);

  const cambiarEstado = async (u) => {
    setOcupado(u.id);
    try {
      if (u.activo) await desactivarUsuario(u.id);
      else await activarUsuario(u.id);
      toast.success(u.activo ? `${u.nombre} ya no puede iniciar sesión` : `${u.nombre} puede volver a iniciar sesión`);
      await cargar();
    } catch (err) {
      toast.error(erroresDe(err));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Sidebar mostrarSelectorSucursal={false}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-[#1f1218] sm:text-4xl">
            <UserCog className="text-[#b5368f]" size={32} /> Usuarios
          </h1>
          <p className="mt-1 text-base text-gray-600">
            Recepcionistas y administradoras. Las especialistas se crean en{" "}
            <Link to="/especialistas" className="font-semibold text-[#b5368f] underline">Especialistas</Link>{" "}
            (llevan servicios y comisiones).
          </p>
        </div>
        <button type="button" onClick={() => setFormulario({})} disabled={roles.length === 0}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-[#b5368f] px-5 text-lg font-semibold text-white hover:bg-[#9c2d7b] disabled:opacity-50">
          <Plus size={20} /> Nuevo usuario
        </button>
      </div>

      {error && <p role="alert" className="my-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</p>}
      {cargando ? (
        <p className="mt-4 text-gray-600">Cargando usuarios…</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-[#f7e3f1] text-[#1f1218]">
              <tr>
                {["Nombre", "Rol", "Local", "Estado", "Acciones"].map((t) => <th key={t} className="px-4 py-3 font-semibold">{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className={`border-t border-gray-200 ${u.activo ? "" : "bg-gray-50 text-gray-500"}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium">{u.nombre} {u.apellido}</span>
                    {u.id === yo?.id && <span className="ml-2 rounded bg-[#f7e3f1] px-2 py-0.5 text-xs text-[#9c2d7b]">Tú</span>}
                    <span className="block text-sm text-gray-500">{u.email}</span>
                  </td>
                  <td className="px-4 py-3">{u.rol_nombre}</td>
                  <td className="px-4 py-3">{u.local_nombre ?? "Todos"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${u.activo ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setFormulario(u)}
                        className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 hover:bg-[#f7e3f1]">
                        <Pencil size={16} /> Editar
                      </button>
                      {u.id !== yo?.id && (
                        <button type="button" onClick={() => cambiarEstado(u)} disabled={ocupado === u.id}
                          className="flex min-h-11 cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-3 hover:bg-[#f7e3f1] disabled:opacity-60">
                          <Power size={16} /> {u.activo ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && <tr><td colSpan="5" className="px-4 py-6 text-center text-gray-500">No hay usuarios.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {formulario && (
        <FormUsuario
          inicial={formulario}
          roles={roles}
          locales={locales}
          onCerrar={() => setFormulario(null)}
          onGuardado={() => { setFormulario(null); cargar(); }}
        />
      )}
    </Sidebar>
  );
}
