import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { ListaVentas } from "../../../components/ListaVentas";
import { useTitulo } from "../../../hooks/useTitulo";

export function VentasRecepcionista() {
  useTitulo("Ventas");

  return (
    <Sidebar>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#a8238f]">Ventas</h1>
          <p className="text-base text-gray-600">Ventas de tu local.</p>
        </div>

        <Link
          to="/recepcionista/registrar-venta"
          className="flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-[#d61f9a] to-[#a8238f] px-5 text-base font-semibold text-white shadow-md shadow-[#d61f9a]/30 hover:brightness-110"
        >
          <Plus size={20} />
          Registrar venta
        </Link>
      </div>

      <ListaVentas rol="RECEP" />
    </Sidebar>
  );
}