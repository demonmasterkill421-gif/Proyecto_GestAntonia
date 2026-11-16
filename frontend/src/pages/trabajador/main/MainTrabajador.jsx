import { Sidebar } from "../../../components/Sidebar";
import { TituloAnimado } from "../../../components/TituloAnimado";
import { PanelAtajo } from "../../../components/PanelAtajo";
import { useTitulo } from "../../../hooks/useTitulo";

import { QrCode } from "lucide-react";

const RUTA_ASISTENCIA = "/mi-asistencia";

export function MainTrabajador() {
  useTitulo("Inicio");

  return (
    <Sidebar fondo="bg-[#f1cfe4]">
      <TituloAnimado />

      <div className="mt-6 grid gap-5">
        <PanelAtajo
          titulo="Registrar asistencia"
          descripcion="Marca tu entrada y tu salida del día"
          boton="Registrar"
          ruta={RUTA_ASISTENCIA}
          icono={QrCode}
          destacado
        />
      </div>
    </Sidebar>
  );
}