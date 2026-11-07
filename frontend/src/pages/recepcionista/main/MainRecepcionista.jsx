import { UserCheck } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { TituloAnimado } from "../../../components/TituloAnimado";
import { useTitulo } from "../../../hooks/useTitulo";
import { PanelAtajo } from "../../../components/PanelAtajo";

export function MainRecepcionista() {
  useTitulo("Inicio");
  return (
    <Sidebar>
      <TituloAnimado />
      <div className="mt-6">
        <PanelAtajo
          titulo="Registrar Venta"
          boton="Nueva Venta"
          ruta="/recepcionista/registrar-venta"
          icono={UserCheck}
        />
      </div>


      <div className="mt-6">
        <PanelAtajo
          titulo="Ver Agenda"
          boton="Nueva Venta"
          ruta="/recepcionista/registrar-venta"
          icono={UserCheck}
        />
      </div>

      <div className="mt-6">
        <PanelAtajo
          titulo="Ver Asistencia"
          boton="Nueva Venta"
          ruta="/recepcionista/registrar-venta"
          icono={UserCheck}
        />
      </div>
    </Sidebar>
  );
}