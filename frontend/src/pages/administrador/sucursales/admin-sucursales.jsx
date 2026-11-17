import { useNavigate } from "react-router-dom";
import { Sidebar } from "../../../components/Sidebar";
import { useTitulo } from "../../../hooks/useTitulo";
import { SUCURSALES, guardarSucursal } from "../../../data/sucursales";
import { TarjetaSucursal } from "../../../components/TarjetaSucursal";

export function AdminSucursales() {
  useTitulo("Sucursales");
  const navigate = useNavigate();

  // Deja elegida esa sucursal y va a la pantalla pedida
  const ir = (id, ruta) => {
    guardarSucursal(id);
    navigate(ruta);
  };

  return (
    <Sidebar>
      {/* Los márgenes negativos anulan el espacio del contenedor para que el rosa llegue hasta los bordes */}
      <div className="-m-4 min-h-[calc(100vh-4rem)] bg-[#f7e3f1] p-4 sm:-m-8 sm:min-h-[calc(100vh-5rem)] sm:p-8">
        <h1 className="text-3xl font-bold text-[#a8238f] sm:text-4xl">Selector de sucursal</h1>
        <p className="mb-6 mt-3 text-base text-gray-700 sm:text-lg">
          
        </p>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {SUCURSALES.map((s) => (
            <TarjetaSucursal
              key={s.id}
              sucursal={s}
              onVerAgenda={() => ir(s.id, "/agenda")}
              onVerAsistencia={() => ir(s.id, "/asistencia")}
            />
          ))}
        </div>
      </div>
    </Sidebar>
  );
}