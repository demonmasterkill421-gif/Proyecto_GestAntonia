import { Sidebar } from "../../../components/Sidebar";
import { TituloAnimado } from "../../../components/TituloAnimado";
import { useTitulo } from "../../../hooks/useTitulo";

export function MainRecepcionista() {
  useTitulo(Inicio);
  return (
    <Sidebar>
      <TituloAnimado/>
      <h1>Inicio Recepcionista</h1>
    </Sidebar>
  );
}