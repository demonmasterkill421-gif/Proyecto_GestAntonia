import { Sidebar } from "../../../components/Sidebar";
import { TituloAnimado } from "../../../components/TituloAnimado";
import { PanelAtajo } from "../../../components/PanelAtajo";
import { useTitulo } from "../../../hooks/useTitulo";

import {
  ShoppingBag,
  UserCheck,
  CalendarDays,
  Users,
  BadgeDollarSign,
  Store,
  Package,
  ChartColumn,
} from "lucide-react";

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

        <PanelAtajo
          titulo="Asistencia"
          descripcion="Mira quién llegó, corrige horarios y descarga el Excel"
          boton="Ver asistencia"
          ruta="/admin/asistencia"
          icono={UserCheck}
        />

        {/* Agenda y Especialistas ya existen (módulo de Reservas, Equipo 4). Comisiones aún no. */}
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
          icono={BadgeDollarSign}
          proximamente
        />

        <PanelAtajo
          titulo="Locales"
          descripcion="Administra tus sucursales"
          boton="Ver locales"
          ruta="/admin/locales"
          icono={Store}
        />

        <PanelAtajo
          titulo="Inventario"
          descripcion="Revisa el stock de productos e insumos"
          boton="Ver inventario"
          ruta="/admin/inventario"
          icono={Package}
        />

        <PanelAtajo
          titulo="Reportes"
          descripcion="Resumen y gráficos de tu negocio"
          boton="Ver reportes"
          ruta="/admin/reportes"
          icono={ChartColumn}
        />
      </div>
    </Sidebar>
  );
}