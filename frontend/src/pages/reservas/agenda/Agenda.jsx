import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { obtenerAgenda } from "../../../api/reservas.api";
import { useAuth } from "../../../auth/AuthContext";
import { useTitulo } from "../../../hooks/useTitulo";
import { Sidebar } from "../../../components/Sidebar";

export default function Agenda() {
  useTitulo("Agenda del día"); 
  const { usuario } = useAuth(); 
  
  const [searchParams, setSearchParams] = useSearchParams();
  // Fecha de hoy en hora de Chile. toISOString() usa UTC: después de las 21:00 daba el día siguiente.
  const fechaHoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" }); // AAAA-MM-DD
  const fechaUrl = searchParams.get("fecha") || fechaHoy; 

  const [agenda, setAgenda] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargarDatos = async (fecha, idLocal) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await obtenerAgenda(fecha, idLocal);
      setAgenda(respuesta.data); 
    } catch (err) {
      if (err.response?.status === 400 && err.response.data?.local) {
        setError("Por favor, selecciona un local en el menú superior para ver la agenda.");
      } else {
        setError("Error al cargar la agenda. Intenta de nuevo.");
      }
    }
    setCargando(false);
  };

  useEffect(() => {
    // La administradora usa el local del selector del encabezado. Si todavía no ha elegido uno,
    // se usa la primera sucursal (id 1), que es la que el selector muestra por defecto.
    const idLocal = usuario?.rol === "ADMIN" ? (localStorage.getItem("sucursal") || "1") : "";
    cargarDatos(fechaUrl, idLocal);

    const alCambiarLocal = (evento) => cargarDatos(fechaUrl, evento.detail.id);
    window.addEventListener("gestantonia:sucursal-cambiada", alCambiarLocal);
    
    return () => window.removeEventListener("gestantonia:sucursal-cambiada", alCambiarLocal);
  }, [fechaUrl, usuario]);

  const manejarCambioFecha = (evento) => {
    setSearchParams({ fecha: evento.target.value });
  };

  if (cargando) return <Sidebar><div className="p-6 text-gray-500">Cargando agenda...</div></Sidebar>;
  if (error) return <Sidebar><div className="p-6 text-red-700 bg-red-50 rounded-xl m-6">{error}</div></Sidebar>;
  if (!agenda) return null;

  return (
    <Sidebar>
      <div className="p-6 max-w-7xl mx-auto text-[#1f1218]">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Agenda del día</h2>
          <h1 className="text-3xl font-bold text-[#b5368f] mb-6">{agenda.local.nombre}</h1>
          
          <div className="flex items-end max-w-xs">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input 
                type="date" 
                value={fechaUrl} 
                onChange={manejarCambioFecha}
                className="w-full min-h-[44px] rounded-lg border-gray-300 border px-3 focus:border-[#b5368f] focus:ring-[#b5368f]"
              />
            </div>
          </div>
        </div>

        {agenda.especialistas.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500 mb-4">Este local todavía no tiene especialistas activas.</p>
            <Link to={`/agenda/clientes`} className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#b5368f] px-6 text-white hover:bg-[#9c2d7b]">
              Nueva reserva
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-center border-collapse min-w-[600px]">
              <thead className="bg-[#faf9f7] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4 w-24 border-r border-gray-200 font-semibold text-gray-600">Hora</th>
                  {agenda.especialistas.map(esp => (
                    <th key={esp.id} className="py-3 px-4 font-semibold text-gray-600 border-r border-gray-200 last:border-0">
                      {esp.nombre} {!esp.activa && <span className="text-xs text-red-500 font-normal">(inactiva)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agenda.bloques.map((bloque, indexFila) => (
                  <tr key={indexFila} className="border-b border-gray-200 last:border-0">
                    <td className="py-4 px-4 border-r border-gray-200 font-medium text-gray-500 align-top">
                      {bloque.hora}
                    </td>
                    
                    {bloque.celdas.map((celda, indexCelda) => (
                      <td key={indexCelda} className="border-r border-gray-200 last:border-0 p-2 align-top w-48">
                        {celda.estado === "OCUPADO" ? (
                          <div className="h-full bg-gray-50 border-l-4 border-gray-600 p-3 rounded text-left">
                            <p className="font-bold text-gray-700 text-sm mb-1">Ocupado</p>
                            <Link to={`/agenda/reservas/${celda.reserva.id}`} className="text-xs text-gray-600 hover:text-[#b5368f] hover:underline block">
                              {celda.reserva.cliente_nombre} · {celda.reserva.servicio_nombre}
                            </Link>
                          </div>
                        ) : (
                          <div className="h-full bg-green-50 border-l-4 border-green-600 p-3 rounded text-left flex flex-col justify-between">
                            <p className="font-bold text-green-700 text-sm mb-2">Libre</p>
                            <Link 
                              to={`/agenda/clientes?especialista=${celda.especialista}&inicio=${bloque.inicio.slice(0,16)}`}
                              className="inline-flex min-h-[32px] items-center justify-center rounded border border-green-600 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                            >
                              Agendar
                            </Link>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Sidebar>
  );
}