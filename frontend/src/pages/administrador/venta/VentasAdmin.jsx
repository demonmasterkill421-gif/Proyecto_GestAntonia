import { Sidebar } from "../../../components/Sidebar";
import { ListaVentas } from "../../../components/ListaVentas";
import { useTitulo } from "../../../hooks/useTitulo";

export function VentasAdmin() {
  useTitulo("Ventas");

  return (
    <Sidebar>
      <h1 className="text-3xl font-bold text-[#a8238f]">Ventas</h1>
      <p className="mb-6 text-base text-gray-600">Ventas de todos los locales.</p>

      <ListaVentas rol="ADMIN" />
    </Sidebar>
  );
}