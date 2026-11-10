import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { buscarCliente, crearCliente } from "../../../api/reservas.api";
import { useTitulo } from "../../../hooks/useTitulo";
import { Sidebar } from "../../../components/Sidebar";

export default function BuscarCliente() {
  useTitulo("Buscar Cliente");
  const navigate = useNavigate(); 
  
  const [searchParams] = useSearchParams();
  const especialistaId = searchParams.get("especialista") || "";
  const inicio = searchParams.get("inicio") || "";

  const [telefonoBuscado, setTelefonoBuscado] = useState("");
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [busquedaRealizada, setBusquedaRealizada] = useState(false);
  const [cargando, setCargando] = useState(false);
  
  const [nombre, setNombre] = useState("");
  const [telefonoNuevo, setTelefonoNuevo] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  
  const [errores, setErrores] = useState({});

  const manejarBusqueda = async (e) => {
    e.preventDefault(); 
    if (!telefonoBuscado) return;
    
    setCargando(true);
    setErrores({});
    setClienteEncontrado(null);
    
    try {
      const respuesta = await buscarCliente(telefonoBuscado);
      
      if (respuesta.data.length > 0) {
        setClienteEncontrado(respuesta.data[0]); 
      } else {
        setTelefonoNuevo(telefonoBuscado); 
      }
      setBusquedaRealizada(true);
    } catch (error) {
      if (error.response?.data) setErrores(error.response.data);
    } finally {
      setCargando(false);
    }
  };

  const manejarRegistro = async (e) => {
    e.preventDefault();
    
    if (!consentimiento) {
      setErrores({ consentimiento: ["Debe aceptar el uso de datos (Ley 19.628)."] });
      return;
    }

    setCargando(true);
    setErrores({});

    try {
      const respuesta = await crearCliente({ 
        nombre, 
        telefono: telefonoNuevo, 
        consentimiento: true 
      });
      
      irANuevaReserva(respuesta.data.id);
    } catch (error) {
      if (error.response?.data) setErrores(error.response.data);
    } finally {
      setCargando(false);
    }
  };

  const irANuevaReserva = (clienteId) => {
    let url = `/agenda/nueva?cliente=${clienteId}`;
    
    if (especialistaId) url += `&especialista=${especialistaId}`;
    if (inicio) url += `&inicio=${inicio}`;
    
    navigate(url);
  };

  return (
    <Sidebar>
      <div className="p-6 max-w-xl mx-auto text-[#1f1218]">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-[#b5368f] mb-6">Buscar Cliente</h1>

          <form onSubmit={manejarBusqueda} className="mb-6 flex items-end gap-2">
            <div className="flex-grow">
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono del cliente</label>
              <input
                type="text"
                placeholder="+56 9 1234 5678"
                value={telefonoBuscado}
                onChange={(e) => setTelefonoBuscado(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border-gray-300 border px-3 focus:border-[#b5368f] focus:ring-[#b5368f]"
              />
              {errores.telefono && <p className="text-red-700 text-sm mt-1">{errores.telefono[0]}</p>}
            </div>
            <button 
              type="submit" 
              disabled={cargando}
              className="min-h-[44px] rounded-lg bg-[#b5368f] px-6 text-white font-medium hover:bg-[#9c2d7b] disabled:opacity-50"
            >
              {cargando ? "..." : "Buscar"}
            </button>
          </form>

          {busquedaRealizada && (
            <div className="border-t border-gray-200 pt-6 mt-2">
              
              {clienteEncontrado ? (
                
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">Cliente encontrado</h3>
                  <p className="mb-1"><span className="font-medium">Nombre:</span> {clienteEncontrado.nombre}</p>
                  <p className="mb-4"><span className="font-medium">Teléfono:</span> {clienteEncontrado.telefono}</p>
                  
                  <button 
                    onClick={() => irANuevaReserva(clienteEncontrado.id)}
                    className="w-full min-h-[44px] rounded-lg bg-[#b5368f] text-white font-medium hover:bg-[#9c2d7b]"
                  >
                    Confirmar y Agendar
                  </button>
                </div>

              ) : (

                <div>
                  <h3 className="text-lg font-semibold text-[#b5368f] mb-4">Cliente no encontrado. Registrar nuevo:</h3>
                  
                  <form onSubmit={manejarRegistro}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        className="w-full min-h-[44px] rounded-lg border-gray-300 border px-3 focus:border-[#b5368f] focus:ring-[#b5368f]"
                      />
                      {errores.nombre && <p className="text-red-700 text-sm mt-1">{errores.nombre[0]}</p>}
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={telefonoNuevo}
                        onChange={(e) => setTelefonoNuevo(e.target.value)}
                        className="w-full min-h-[44px] rounded-lg border-gray-300 border px-3 focus:border-[#b5368f] focus:ring-[#b5368f]"
                      />
                      {errores.telefono && <p className="text-red-700 text-sm mt-1">{errores.telefono[0]}</p>}
                    </div>

                    <div className="mb-6 flex items-start">
                      <div className="flex h-5 items-center">
                        <input
                          id="consentimiento"
                          type="checkbox"
                          checked={consentimiento}
                          onChange={(e) => setConsentimiento(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-[#b5368f] focus:ring-[#b5368f]"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="consentimiento" className="font-medium text-gray-700">
                          Acepto el uso de datos (Ley 19.628 / 21.719)
                        </label>
                        {errores.consentimiento && <p className="text-red-700 text-sm mt-1">{errores.consentimiento[0]}</p>}
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={cargando}
                      className="w-full min-h-[44px] rounded-lg bg-[#b5368f] text-white font-medium hover:bg-[#9c2d7b] disabled:opacity-50"
                    >
                      {cargando ? "Registrando..." : "Registrar y Continuar"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}