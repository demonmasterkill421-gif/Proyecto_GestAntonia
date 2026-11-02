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
      <h1 className="text-4xl font-bold text-[#1f1218]">Selector de sucursal</h1>
      <p className="mb-6 mt-3 text-lg text-gray-600">
        Elige la sucursal que quieres revisar. Puedes cambiarla en cualquier momento desde el encabezado.
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
    </Sidebar>
  );
}