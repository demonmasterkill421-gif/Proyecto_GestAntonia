import { Sidebar } from "../../../components/Sidebar";
import { TituloAnimado } from "../../../components/TituloAnimado";
import { useTitulo } from "../../../hooks/useTitulo";

export function MainAdmin() {
  return (
    <Sidebar>
      <TituloAnimado/>
      <h1>Inicio administradora</h1>
    </Sidebar>
  );
}