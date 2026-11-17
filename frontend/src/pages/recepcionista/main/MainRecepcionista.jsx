import { CalendarDays, CirclePlus, Receipt, UserCheck } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { TituloAnimado } from "../../../components/TituloAnimado";
import { useTitulo } from "../../../hooks/useTitulo";
import { PanelAtajo } from "../../../components/PanelAtajo";

export function MainRecepcionista() {
  useTitulo("Inicio");
  return (
    <Sidebar fondo="bg-[#f1cfe4]">
      <TituloAnimado />

      {/* En pantallas grandes van de a dos; en el celular, una bajo otra */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <PanelAtajo
          titulo="Registrar venta"
          descripcion="Anota una nueva venta"
          boton="Nueva venta"
          ruta="/recepcionista/registrar-venta"
          icono={CirclePlus}
          destacado
        />

        <PanelAtajo
          titulo="Ver ventas"
          descripcion="Revisa las ventas de tu local"
          boton="Ver ventas"
          ruta="/recepcionista/ventas"
          icono={Receipt}
        />

        <PanelAtajo
          titulo="Asistencia"
          descripcion="Marca la entrada y salida del equipo"
          boton="Marcar"
          ruta="/recepcionista/asistencia"
          icono={UserCheck}
        />

        <PanelAtajo
          titulo="Agenda"
          descripcion="Las citas del día"
          boton="Ver agenda"
          ruta="/agenda"
          icono={CalendarDays}
        />
      </div>
    </Sidebar>
  );
}