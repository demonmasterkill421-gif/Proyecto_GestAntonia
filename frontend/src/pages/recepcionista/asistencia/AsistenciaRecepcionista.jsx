import { Sidebar } from "../../../components/Sidebar";
import { ListaAsistencia } from "../../../components/ListaAsistencia";
import { useTitulo } from "../../../hooks/useTitulo";

export function AsistenciaRecepcionista() {
  useTitulo("Asistencia");

  return (
    <Sidebar>
      <h1 className="text-3xl font-bold text-[#a8238f]">Asistencia</h1>
      <p className="mb-6 text-base text-gray-600">Asistencia de las trabajadoras de tu local.</p>

      <ListaAsistencia rol="RECEP" />
    </Sidebar>
  );
}