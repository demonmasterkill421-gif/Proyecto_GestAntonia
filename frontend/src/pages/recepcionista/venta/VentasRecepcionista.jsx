import { Sidebar } from "../../../components/Sidebar";
import { TablaVentas } from "../../../components/TablaVentas";
import { useTitulo } from "../../../hooks/useTitulo";

export function VentasRecepcionista() {
  useTitulo("Ventas");
  return (
    <Sidebar>
      <h1 className="mb-6 text-3xl font-bold text-[#1f1218]">Ventas</h1>
      <TablaVentas rol="RECEP" />
    </Sidebar>
  );
}