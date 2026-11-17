import { Sidebar } from "../../../components/Sidebar";
import { TituloAnimado } from "../../../components/TituloAnimado";
import { PanelAtajo } from "../../../components/PanelAtajo";
import { useTitulo } from "../../../hooks/useTitulo";

import {
  ShoppingBag,
  QrCode,
  UserCheck,
  CalendarDays,
  Users,
  BadgeDollarSign,
  Store,
  ChartColumn,
} from "lucide-react";

// Página donde las tres (propietaria, recepcionista y especialista) registran su asistencia.
// Debe ser la misma dirección que usa el menú de la especialista.
const RUTA_ASISTENCIA = "/mi-asistencia";

export function MainAdmin() {
  useTitulo("Inicio");

  return (
    <Sidebar fondo="bg-[#f1cfe4]">
      <TituloAnimado />

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <PanelAtajo
          titulo="Ventas"
          descripcion="Revisa las ventas, descarga el Excel y anula si hace falta"
          boton="Ver ventas"
          ruta="/admin/ventas"
          icono={ShoppingBag}
          destacado
        />

        {/* Solo en el teléfono: registrar la asistencia se hace desde ahí */}
        <div className="md:hidden">
          <PanelAtajo
            titulo="Registrar asistencia"
            descripcion="Marca tu entrada y tu salida del día"
            boton="Registrar"
            ruta={RUTA_ASISTENCIA}
            icono={QrCode}
          />
        </div>

        <PanelAtajo
          titulo="Asistencia"
          descripcion="Mira quién llegó, corrige horarios y descarga el Excel"
          boton="Ver asistencia"
          ruta="/admin/asistencia"
          icono={UserCheck}
        />

        <PanelAtajo
          titulo="Agenda"
          descripcion="Las citas y horas agendadas"
          boton="Ver agenda"
          ruta="/agenda"
          icono={CalendarDays}
        />

        <PanelAtajo
          titulo="Especialistas"
          descripcion="Tu equipo de trabajo"
          boton="Ver especialistas"
          ruta="/especialistas"
          icono={Users}
        />

        <PanelAtajo
          titulo="Comisiones"
          descripcion="Lo que gana cada especialista"
          boton="Ver comisiones"
          ruta="/comisiones"
          icono={BadgeDollarSign}
        />

        <PanelAtajo
          titulo="Locales"
          descripcion="Administra tus sucursales"
          boton="Ver locales"
          ruta="/admin/locales"
          icono={Store}
        />

        {/* En el computador la tarjeta de asistencia no se ve, quedan 7: esta ocupa todo el ancho */}
        <div className="lg:col-span-2">
          <PanelAtajo
            titulo="Reportes"
            descripcion="Resumen y gráficos de tu negocio"
            boton="Ver reportes"
            ruta="/admin/reportes"
            icono={ChartColumn}
          />
        </div>
      </div>
    </Sidebar>
  );
}