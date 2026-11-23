// Agregar o editar una recepcionista (solo la administradora · Edson).
// Las reglas (correo único, clave segura, local obligatorio) las valida la API con RecepcionistaForm.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { listarLocales } from "../../../api/locales.api";
import { crearRecepcionista, editarRecepcionista, obtenerRecepcionista } from "../../../api/reservas.api";
import { mensajeGeneral, textoError } from "../especialistas/utilidades";

const VACIO = { nombre: "", apellido: "", email: "", local: "", clave: "" };
const ESTILO_CAMPO =
  "min-h-11 w-full rounded-lg border bg-white px-3 text-lg focus:border-[#b5368f] focus:outline-none";

function Campo({ id, etiqueta, error, ayuda, children }) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block font-semibold text-[#1f1218]">{etiqueta}</label>
      {children}
      {ayuda && <p className="mt-1 text-sm text-gray-500">{ayuda}</p>}
      {error && <p className="mt-1 text-sm text-red-700">{textoError(error)}</p>}
    </div>
  );
}

export function FormRecepcionista() {
  const { id } = useParams();
  const esNueva = !id;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  useTitulo(esNueva ? "Nueva recepcionista" : "Editar recepcionista");

  const [datos, setDatos] = useState({ ...VACIO, local: params.get("local") ?? "" });
  const [locales, setLocales] = useState([]);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [cargando, setCargando] = useState(!esNueva);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listarLocales().then(({ data }) => setLocales(data)).catch(() => setLocales([]));
  }, []);

  useEffect(() => {
    if (esNueva) return;
    obtenerRecepcionista(id)
      .then(({ data }) =>
        setDatos({
          nombre: data.nombre ?? "",
          apellido: data.apellido ?? "",
          email: data.email ?? "",
          local: data.local ? String(data.local) : "",
          clave: "",
        }),
      )
      .catch((e) => setErrorGeneral(mensajeGeneral(e)))
      .finally(() => setCargando(false));
  }, [id, esNueva]);

  const cambiar = (campo) => (ev) => setDatos({ ...datos, [campo]: ev.target.value });
  const borde = (campo) => (errores[campo] ? "border-red-400" : "border-gray-300");

  const guardar = async (ev) => {
    ev.preventDefault();
    setGuardando(true);
    setErrores({});
    setErrorGeneral("");
    const envio = { ...datos, local: datos.local ? Number(datos.local) : null };
    if (!esNueva) delete envio.clave; // la clave solo se pide al crear
    try {
      const { data } = esNueva ? await crearRecepcionista(envio) : await editarRecepcionista(id, envio);
      const nombre = `${data.nombre} ${data.apellido}`;
      navigate("/recepcionistas", {
        state: { mensaje: esNueva ? `Recepcionista ${nombre} agregada.` : `Datos de ${nombre} actualizados.` },
      });
    } catch (e) {
      if (e.response?.status === 400 && e.response.data && typeof e.response.data === "object") {
        setErrores(e.response.data);
        if (e.response.data.detail) setErrorGeneral(textoError(e.response.data.detail));
      } else {
        setErrorGeneral(mensajeGeneral(e));
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Sidebar>
      <p className="text-gray-600">
        <Link to="/recepcionistas" className="text-[#b5368f] hover:underline">Recepcionistas</Link> ›{" "}
        {esNueva ? "Nueva recepcionista" : "Editar recepcionista"}
      </p>
      <h1 className="mb-6 mt-1 text-4xl font-bold text-[#1f1218]">
        {esNueva ? "Nueva recepcionista" : `Editar a ${datos.nombre} ${datos.apellido}`.trim()}
      </h1>

      {errorGeneral && (
        <p role="alert" className="mb-4 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {errorGeneral}
        </p>
      )}

      {cargando ? (
        <p className="text-gray-600">Cargando datos…</p>
      ) : (
        <form onSubmit={guardar} noValidate className="max-w-2xl rounded-xl border border-gray-200 bg-white p-6">
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Campo id="nombre" etiqueta="Nombre" error={errores.nombre}>
              <input id="nombre" value={datos.nombre} onChange={cambiar("nombre")} className={`${ESTILO_CAMPO} ${borde("nombre")}`} />
            </Campo>
            <Campo id="apellido" etiqueta="Apellido" error={errores.apellido}>
              <input id="apellido" value={datos.apellido} onChange={cambiar("apellido")} className={`${ESTILO_CAMPO} ${borde("apellido")}`} />
            </Campo>
          </div>

          <Campo id="email" etiqueta="Correo" error={errores.email} ayuda="Con este correo inicia sesión en el sistema.">
            <input id="email" type="email" value={datos.email} onChange={cambiar("email")} className={`${ESTILO_CAMPO} ${borde("email")}`} />
          </Campo>

          <Campo
            id="local"
            etiqueta="Local"
            error={errores.local}
            ayuda="Solo verá la agenda, las ventas y la asistencia de este local."
          >
            <select id="local" value={datos.local} onChange={cambiar("local")} className={`${ESTILO_CAMPO} ${borde("local")}`}>
              <option value="">Elige un local</option>
              {locales.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </Campo>

          {esNueva && (
            <Campo
              id="clave"
              etiqueta="Clave inicial"
              error={errores.clave}
              ayuda="Mínimo 10 caracteres. Con esta clave la recepcionista entra al sistema."
            >
              <input
                id="clave"
                type="password"
                autoComplete="new-password"
                value={datos.clave}
                onChange={cambiar("clave")}
                className={`${ESTILO_CAMPO} ${borde("clave")}`}
              />
            </Campo>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={guardando}
              className="min-h-11 cursor-pointer rounded-lg bg-[#b5368f] px-6 text-lg font-semibold text-white transition hover:bg-[#9c2d7b] active:scale-95 disabled:cursor-wait disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <Link
              to="/recepcionistas"
              className="flex min-h-11 items-center rounded-lg border border-gray-300 px-6 text-lg text-[#1f1218] transition hover:bg-[#f7e3f1]"
            >
              Cancelar
            </Link>
          </div>
        </form>
      )}
    </Sidebar>
  );
}
