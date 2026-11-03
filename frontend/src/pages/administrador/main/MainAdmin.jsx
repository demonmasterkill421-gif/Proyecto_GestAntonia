import { Sidebar } from "../../../components/Sidebar";
import { SeccionResumen } from "../../../components/SeccionResumen";
import { TituloAnimado } from "../../../components/TituloAnimado";
import { useTitulo } from "../../../hooks/useTitulo";


import { UserCheck } from "lucide-react";
import { PanelAtajo } from "../../../components/PanelAtajo";

export function MainAdmin() {
  useTitulo("Inicio");
  
  return (
    <Sidebar>
      <TituloAnimado/>

      <div className="mt-6">
        <PanelAtajo
          titulo="Asistencia"
          boton="Registrar asistencia"
          ruta="/admin/asistencia"
          icono={UserCheck}
          
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2"></div>
      
    </Sidebar>
  );
}