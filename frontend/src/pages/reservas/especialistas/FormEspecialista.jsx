// 3.8c · Edson: agregar o editar una especialista (versión React del formulario Django 2.4).
// Las reglas (clave segura, correo único, no cambiar de local con reservas futuras) las valida la API.
// Servicios que realiza: solo puede agendarse en esos servicios, y la dueña define el % de comisión de cada uno.
// Primero se elige el servicio en un desplegable y después se ajusta su comisión, así la pantalla
// no crece aunque el catálogo tenga muchos servicios.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { listarLocales } from "../../../api/locales.api";
import { crearEspecialista, editarEspecialista, listarServicios, obtenerEspecialista } from "../../../api/reservas.api";
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
  const [catalogo, setCatalogo] = useState([]);
  const [asignados, setAsignados] = useState([]); // [{ servicio: 3, nombre: "Manicura", porcentaje: "12" }]
  const [porAgregar, setPorAgregar] = useState(""); // servicio elegido en el desplegable

  useEffect(() => {
    listarLocales().then(({ data }) => setLocales(data)).catch(() => setLocales([]));
    listarServicios().then(({ data }) => setCatalogo(data)).catch(() => setCatalogo([]));
  }, []);

  // Al editar, se traen los datos actuales de la especialista
  useEffect(() => {
    if (esNueva) return;
    obtenerEspecialista(id)
      .then(({ data }) => {
        setDatos({
          nombre: data.nombre ?? "",
          apellido: data.apellido ?? "",
          email: data.email ?? "",
          local: data.local ? String(data.local) : "",
          cargo: data.cargo ?? "",
          porcentaje_comision: String(Number(data.porcentaje_comision ?? 0)),
          clave: "",
        });
        setAsignados(
          (data.servicios ?? []).map((s) => ({
            servicio: s.servicio,
            nombre: s.servicio_nombre,
            porcentaje: String(Number(s.porcentaje_comision ?? 0)),
          })),
        );
      })
      .catch((e) => setErrorGeneral(mensajeGeneral(e)))
      .finally(() => setCargando(false));
  }, [id, esNueva]);

  const cambiar = (campo) => (ev) => setDatos({ ...datos, [campo]: ev.target.value });

  // El desplegable solo ofrece los servicios que todavía no tiene (no se pueden repetir)
  const yaAsignado = (idServicio) => asignados.some((a) => a.servicio === idServicio);
  const disponibles = catalogo.filter((s) => !yaAsignado(s.id));
  const duracionDe = (idServicio) => catalogo.find((s) => s.id === idServicio)?.duracion;

  // Al tocar la lista se borra el aviso anterior de servicios (se vuelve a revisar al guardar)
  const limpiarErrorServicios = () => setErrores((actual) => ({ ...actual, servicios: undefined }));

  // Agregar el servicio elegido. Parte con la comisión base y se puede cambiar en la tabla.
  const agregarServicio = () => {
    const servicio = catalogo.find((s) => String(s.id) === porAgregar);
    if (!servicio || yaAsignado(servicio.id)) return;
    limpiarErrorServicios();
    setAsignados((actual) => [
      ...actual,
      { servicio: servicio.id, nombre: servicio.nombre, porcentaje: datos.porcentaje_comision || "0" },
    ]);
    setPorAgregar("");
  };
  const quitarServicio = (idServicio) => {
    limpiarErrorServicios();
    setAsignados((actual) => actual.filter((a) => a.servicio !== idServicio));
  };
  const cambiarPorcentaje = (idServicio, valor) =>
    setAsignados((actual) => actual.map((a) => (a.servicio === idServicio ? { ...a, porcentaje: valor } : a)));

  // Errores de la lista de servicios: texto general o un error por servicio
  const errorServicios = (() => {
    const e = errores.servicios;
    if (!e) return "";
    if (!Array.isArray(e)) return textoError(e);
    return e
      .flatMap((x) => (typeof x === "string" ? [x] : Object.values(x ?? {}).flat()))
      .join(" ");
  })();

  const guardar = async (ev) => {
    ev.preventDefault();
    setGuardando(true);
    setErrores({});
    setErrorGeneral("");
    const envio = {
      ...datos,
      local: datos.local ? Number(datos.local) : null,
      servicios: asignados.map((a) => ({
        servicio: a.servicio,
        porcentaje_comision: a.porcentaje === "" ? "0" : a.porcentaje,
      })),
    };
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
            etiqueta="Comisión base (%)"
            error={errores.porcentaje_comision}
            ayuda="Se usa si alguna vez registra un servicio que no tiene configurado abajo, de 0 a 100."
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

          {/* Servicios que realiza y su comisión en cada uno */}
          <fieldset className="mb-4 min-w-0 rounded-lg border border-gray-200 p-4">
            <legend className="px-1 font-semibold text-[#1f1218]">Servicios que realiza y su comisión</legend>
            <p className="mb-3 text-sm text-gray-500">
              Elige un servicio y agrégalo. Solo se le podrán agendar los servicios de la tabla, y cada uno puede tener
              un % distinto.
            </p>

            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1">
                <label htmlFor="servicio-nuevo" className="mb-1 block text-sm text-gray-600">Agregar servicio</label>
                <select
                  id="servicio-nuevo"
                  value={porAgregar}
                  onChange={(ev) => setPorAgregar(ev.target.value)}
                  disabled={disponibles.length === 0}
                  className={`${ESTILO_CAMPO} border-gray-300 disabled:bg-gray-100`}
                >
                  <option value="">
                    {catalogo.length === 0
                      ? "Cargando servicios…"
                      : disponibles.length === 0
                        ? "Ya tiene todos los servicios"
                        : "Elige un servicio"}
                  </option>
                  {disponibles.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre} ({s.duracion} min)</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={agregarServicio}
                disabled={!porAgregar}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-[#b5368f] px-4 text-lg font-semibold text-[#b5368f] transition hover:bg-[#f7e3f1] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={20} aria-hidden="true" /> Agregar
              </button>
            </div>

            {asignados.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-4 py-3 text-gray-600">Aún no tiene servicios asignados.</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-sm text-gray-600">
                    <th className="py-2 pr-3 font-semibold">Servicio</th>
                    <th className="hidden py-2 pr-3 font-semibold sm:table-cell">Duración</th>
                    <th className="py-2 pr-3 font-semibold">Comisión</th>
                    <th className="py-2"><span className="sr-only">Quitar</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {asignados.map((a) => (
                    <tr key={a.servicio}>
                      <td className="py-2 pr-3">{a.nombre}</td>
                      <td className="hidden py-2 pr-3 text-gray-600 sm:table-cell">
                        {duracionDe(a.servicio) ? `${duracionDe(a.servicio)} min` : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2">
                          <input
                            id={`pct-${a.servicio}`}
                            aria-label={`Comisión de ${a.nombre}`}
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={a.porcentaje}
                            onChange={(ev) => cambiarPorcentaje(a.servicio, ev.target.value)}
                            className="min-h-11 w-24 rounded-lg border border-gray-300 bg-white px-3 text-lg focus:border-[#b5368f] focus:outline-none"
                          />
                          <span className="text-gray-600">%</span>
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => quitarServicio(a.servicio)}
                          aria-label={`Quitar ${a.nombre}`}
                          className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-3 text-red-700 transition hover:bg-red-50"
                        >
                          <Trash2 size={18} aria-hidden="true" /> <span className="hidden sm:inline">Quitar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {errorServicios && <p className="mt-2 text-sm text-red-700" role="alert">{errorServicios}</p>}
          </fieldset>

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
