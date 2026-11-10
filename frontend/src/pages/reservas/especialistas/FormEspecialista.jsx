// 3.8c · Edson: agregar o editar una especialista (versión React del formulario Django 2.4).
// Las reglas (clave segura, correo único, no cambiar de local con reservas futuras) las valida la API.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { listarLocales } from "../../../api/locales.api";
import { crearEspecialista, editarEspecialista, obtenerEspecialista } from "../../../api/reservas.api";
import { CARGOS, mensajeGeneral, textoError } from "./utilidades";

const VACIO = { nombre: "", apellido: "", email: "", local: "", cargo: "", porcentaje_comision: "0", clave: "" };

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

export function FormEspecialista() {
  const { id } = useParams();
  const esNueva = !id;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  useTitulo(esNueva ? "Nueva especialista" : "Editar especialista");

  const [datos, setDatos] = useState({ ...VACIO, local: params.get("local") ?? "" });
  const [locales, setLocales] = useState([]);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [cargando, setCargando] = useState(!esNueva);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listarLocales().then(({ data }) => setLocales(data)).catch(() => setLocales([]));
  }, []);

  // Al editar, se traen los datos actuales de la especialista
  useEffect(() => {
    if (esNueva) return;
    obtenerEspecialista(id)
      .then(({ data }) =>
        setDatos({
          nombre: data.nombre ?? "",
          apellido: data.apellido ?? "",
          email: data.email ?? "",
          local: data.local ? String(data.local) : "",
          cargo: data.cargo ?? "",
          porcentaje_comision: String(Number(data.porcentaje_comision ?? 0)),
          clave: "",
        }),
      )
      .catch((e) => setErrorGeneral(mensajeGeneral(e)))
      .finally(() => setCargando(false));
  }, [id, esNueva]);

  const cambiar = (campo) => (ev) => setDatos({ ...datos, [campo]: ev.target.value });

  const guardar = async (ev) => {
    ev.preventDefault();
    setGuardando(true);
    setErrores({});
    setErrorGeneral("");
    const envio = { ...datos, local: datos.local ? Number(datos.local) : null };
    if (!esNueva) delete envio.clave;            // la clave solo se pide al crear
    try {
      const { data } = esNueva ? await crearEspecialista(envio) : await editarEspecialista(id, envio);
      const nombre = `${data.nombre} ${data.apellido}`;
      navigate("/especialistas", {
        state: { mensaje: esNueva ? `Especialista ${nombre} agregada.` : `Datos de ${nombre} actualizados.` },
      });
    } catch (e) {
      if (e.response?.status === 400 && e.response.data && typeof e.response.data === "object") {
        setErrores(e.response.data);              // { campo: ["mensaje"] } → bajo cada campo
        if (e.response.data.detail) setErrorGeneral(textoError(e.response.data.detail));
      } else {
        setErrorGeneral(mensajeGeneral(e));
      }
    } finally {
      setGuardando(false);
    }
  };

  const borde = (campo) => (errores[campo] ? "border-red-400" : "border-gray-300");

  return (
    <Sidebar>
      <p className="text-gray-600">
        <Link to="/especialistas" className="text-[#b5368f] hover:underline">Especialistas</Link> ›{" "}
        {esNueva ? "Nueva especialista" : "Editar especialista"}
      </p>
      <h1 className="mb-6 mt-1 text-4xl font-bold text-[#1f1218]">
        {esNueva ? "Nueva especialista" : `Editar a ${datos.nombre} ${datos.apellido}`.trim()}
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

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Campo id="local" etiqueta="Local" error={errores.local} ayuda="Solo aparecerá al agendar en ese local.">
              <select id="local" value={datos.local} onChange={cambiar("local")} className={`${ESTILO_CAMPO} ${borde("local")}`}>
                <option value="">Elige un local</option>
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>{l.nombre}</option>
                ))}
              </select>
            </Campo>
            <Campo id="cargo" etiqueta="Cargo" error={errores.cargo}>
              <select id="cargo" value={datos.cargo} onChange={cambiar("cargo")} className={`${ESTILO_CAMPO} ${borde("cargo")}`}>
                <option value="">Elige un cargo</option>
                {CARGOS.map((c) => (
                  <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo
            id="comision"
            etiqueta="% de comisión"
            error={errores.porcentaje_comision}
            ayuda="Comisión base sobre sus servicios, de 0 a 100 (regla por confirmar en la tarea 2.6)."
          >
            <input
              id="comision"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={datos.porcentaje_comision}
              onChange={cambiar("porcentaje_comision")}
              className={`${ESTILO_CAMPO} ${borde("porcentaje_comision")} max-w-40`}
            />
          </Campo>

          {esNueva && (
            <Campo
              id="clave"
              etiqueta="Clave inicial"
              error={errores.clave}
              ayuda="Con esta clave la especialista entra al sistema (por ejemplo, para marcar su asistencia)."
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
              to="/especialistas"
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
