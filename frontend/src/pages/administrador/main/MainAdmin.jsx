import { Sidebar } from "../../../components/Sidebar";
import { SeccionResumen } from "../../../components/SeccionResumen";
import { TituloAnimado } from "../../../components/TituloAnimado";
import { useTitulo } from "../../../hooks/useTitulo";

export function MainAdmin() {
  useTitulo("Inicio");
  
  return (
    <Sidebar>
      <TituloAnimado/>


      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>
  

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>
  

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>
  

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>
  

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>
  

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>



        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>
  

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>
  

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>

        <SeccionResumen titulo="Ventas de hoy"> 
          <h1>Inicio administradora</h1>
        </SeccionResumen>
        
      </div>


      
    </Sidebar>
  );
}