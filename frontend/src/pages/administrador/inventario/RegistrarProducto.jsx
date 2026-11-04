import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../../../components/Sidebar";
import {
  obtenerOpcionesProducto,
  registrarProducto,
} from "../../../api/inventario.api";

const estiloCampo =
  "mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-3 outline-none focus:border-[#b5368f]";

export function RegistrarProducto() {
  const navigate = useNavigate();

  const [datos, setDatos] = useState({
    nombre: "",
    marca: "",
    tipo: "",
    precio: "",
    costo: "",
    local: "",
    cantidad: "0",
    stock_minimo: "0",
    descripcion: "",
  });

  const [opciones, setOpciones] = useState({
    locales: [],
    tipos: [],
  });

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    obtenerOpcionesProducto()
      .then(({ data }) => {
        if (activo) setOpciones(data);
      })
      .catch(() => {
        if (activo) {
          setError(
            "No se pudieron cargar los locales y tipos. Revisa tu sesión y la conexión con Django."
          );
        }
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  function cambiarCampo(evento) {
    const { name, value } = evento.target;

    setDatos((anteriores) => ({
      ...anteriores,
      [name]: value,
    }));
  }

  async function guardarProducto(evento) {
    evento.preventDefault();
    if (guardando) return;

    setError("");
    setGuardando(true);

    try {
      await registrarProducto({
        ...datos,
        precio: Number(datos.precio),
        costo: Number(datos.costo),
        local: Number(datos.local),
        cantidad: Number(datos.cantidad),
        stock_minimo: Number(datos.stock_minimo),
      });
    } catch (err) {
      const respuesta = err.response?.data;

      const mensaje =
        respuesta && typeof respuesta === "object"
          ? Object.entries(respuesta)
              .map(([campo, mensajes]) => {
                const texto = Array.isArray(mensajes)
                  ? mensajes.join(" ")
                  : String(mensajes);

                return `${campo}: ${texto}`;
              })
              .join(" · ")
          : "No se pudo registrar el producto. Intenta nuevamente.";

      setError(mensaje);
      setGuardando(false);
      return;
    }

    navigate("/admin/inventario", { replace: true });
  }

  return (
    <Sidebar mostrarSelectorSucursal={false}>
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold text-[#1f1218]">
          Registrar producto
        </h1>

        <p className="mt-2 text-gray-600">
          Incorpora un nuevo producto al inventario.
        </p>

        <form
          onSubmit={guardarProducto}
          className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8"
        >
          <h2 className="text-xl font-semibold">Datos del producto</h2>

          <p className="mt-1 text-sm text-gray-500">
            Completa la información y selecciona el local.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-red-50 p-4 text-red-700"
            >
              {error}
            </p>
          )}

          {cargando && (
            <p role="status" className="mt-5 text-gray-600">
              Cargando opciones…
            </p>
          )}

          {!cargando && opciones.locales.length === 0 && (
            <p className="mt-5 text-amber-800">
              No hay locales disponibles. Necesitas un local activo para
              registrar sus existencias.
            </p>
          )}

          <fieldset
            disabled={cargando || guardando}
            className="mt-8 grid gap-6 sm:grid-cols-2"
          >
            <label className="text-sm font-medium">
              Nombre del producto
              <input
                name="nombre"
                value={datos.nombre}
                onChange={cambiarCampo}
                placeholder="Ej.: Esmalte rojo"
                maxLength={100}
                required
                className={estiloCampo}
              />
            </label>

            <label className="text-sm font-medium">
              Marca
              <input
                name="marca"
                value={datos.marca}
                onChange={cambiarCampo}
                placeholder="Ej.: Pamela Grant"
                maxLength={100}
                required
                className={estiloCampo}
              />
            </label>

            <label className="text-sm font-medium">
              Tipo
              <select
                name="tipo"
                value={datos.tipo}
                onChange={cambiarCampo}
                required
                className={estiloCampo}
              >
                <option value="">Seleccionar tipo</option>
                {opciones.tipos.map((tipo) => (
                  <option key={tipo.valor} value={tipo.valor}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium">
              Local
              <select
                name="local"
                value={datos.local}
                onChange={cambiarCampo}
                required
                className={estiloCampo}
              >
                <option value="">Seleccionar local</option>
                {opciones.locales.map((local) => (
                  <option key={local.id} value={local.id}>
                    {local.nombre}
                  </option>
                ))}
              </select>
            </label>

            {[
              ["precio", "Precio (CLP)"],
              ["costo", "Costo (CLP)"],
              ["cantidad", "Stock inicial"],
              ["stock_minimo", "Stock mínimo"],
            ].map(([campo, titulo]) => (
              <label key={campo} className="text-sm font-medium">
                {titulo}
                <input
                  type="number"
                  name={campo}
                  value={datos[campo]}
                  onChange={cambiarCampo}
                  min="0"
                  max="2147483647"
                  step="1"
                  required
                  className={estiloCampo}
                />
              </label>
            ))}

            <label className="text-sm font-medium sm:col-span-2">
              Descripción
              <textarea
                name="descripcion"
                value={datos.descripcion}
                onChange={cambiarCampo}
                placeholder="Ej.: Frasco de esmalte rojo de 10 ml para manicure."
                rows={3}
                required
                className={estiloCampo}
              />
            </label>
          </fieldset>

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              disabled={guardando}
              onClick={() => navigate("/admin/inventario")}
              className="rounded-lg border border-gray-300 px-6 py-3 font-semibold text-[#b5368f] disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                cargando ||
                guardando ||
                !opciones.locales.length ||
                !opciones.tipos.length
              }
              className="rounded-lg bg-[#b5368f] px-6 py-3 font-semibold text-white hover:bg-[#922b73] disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Registrar producto"}
            </button>
          </div>
        </form>
      </div>
    </Sidebar>
  );
}