import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { guardarSucursalId } from "../../../hooks/useSucursal";
import { obtenerLocales } from "../../../api/inventario.api";
import { TarjetaSucursal } from "../../../components/TarjetaSucursal";

export function AdminSucursales() {
  useTitulo("Sucursales");
  const navigate = useNavigate();

  // A3: los locales vienen de la base de datos (API), no de datos de ejemplo
  const [locales, setLocales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const control = new AbortController();
    obtenerLocales(control.signal)
      .then(({ data }) => {
        setLocales(data);
        setCargando(false);
      })
      .catch((e) => {
        if (e.code === "ERR_CANCELED") return; // la pantalla se cerró antes de recibir la respuesta
        setError("No se pudieron cargar los locales.");
        setCargando(false);
      });
    return () => control.abort();
  }, []);

  // Deja elegido ese local (avisa al selector del encabezado) y va a la pantalla pedida
  const ir = (id, ruta) => {
    guardarSucursalId(id);
    navigate(ruta);
  };

  return (
    <Sidebar>
      {/* Los márgenes negativos anulan el espacio del contenedor para que el rosa llegue hasta los bordes */}
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-[#f7e3f1] p-4 sm:-m-8 sm:min-h-[calc(100vh-5rem)] sm:p-8">
        <h1 className="text-3xl font-bold text-[#a8238f] sm:text-4xl">Selector de sucursal</h1>
        <p className="mb-6 mt-3 text-base text-gray-700 sm:text-lg">
          
        </p>

        {cargando && <p className="text-lg text-gray-700">Cargando locales…</p>}
        {error && <p className="text-lg font-medium text-red-600">{error}</p>}
        {!cargando && !error && locales.length === 0 && (
          <p className="text-lg text-gray-700">Aún no hay locales registrados.</p>
        )}

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {locales.map((s) => (
            <TarjetaSucursal
              key={s.id}
              sucursal={s}
              onVerVentas={() => ir(s.id, "/admin/ventas")}
              onVerAsistencia={() => ir(s.id, "/admin/asistencia")}
              onVerReporte={() => ir(s.id, "/admin/reportes")}
            />
          ))}
        </div>
      </div>
    </Sidebar>
  );
}