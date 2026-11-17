import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { useTitulo } from '../../../hooks/useTitulo';
// Importamos la función de la API de tu proyecto (ajusta la ruta si es necesario)
import { escanearAsistenciaAutomatica } from '../../../api/asistencia.api';

export function RegistrarAsistencia() {
  useTitulo("Registro de Asistencia");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth(); 

  const [estado, setEstado] = useState('cargando'); // 'cargando', 'exito', 'error'
  const [mensaje, setMensaje] = useState("Registrando tu asistencia...");

  useEffect(() => {
    const registrarAsistencia = async () => {
      const debeMarcar = searchParams.get("marcar") === "true";
      
      if (!debeMarcar) {
        setEstado('error');
        setMensaje("No se detectó el escaneo del código QR de la sucursal.");
        return;
      }

      try {
        // Usamos Axios a través de tu cliente pre-configurado (él maneja el token)
        const response = await escanearAsistenciaAutomatica();
        
        setEstado('exito');
        setMensaje(response.data.mensaje || "¡Asistencia registrada correctamente!");
        
      } catch (error) {
        setEstado('error');
        // Extraemos el mensaje de error de Django si existe, sino un genérico
        const errorServidor = error.response?.data?.error || error.response?.data?.detail;
        setMensaje(errorServidor || "Hubo un problema al registrar la asistencia.");
      }
    };

    registrarAsistencia();
  }, [searchParams]);

  const handleCerrarSesion = () => {
    auth.cerrarSesion();
    navigate('/login?qr=true');
  };

  return (
    <div className="min-h-screen bg-[#fbfbf9] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-[0_2px_12px_rgba(181,54,143,0.12)] border border-gray-100 flex flex-col items-center max-w-md w-full text-center relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#d61f9a] to-[#a8238f]"></div>

        <h1 className="text-3xl font-bold tracking-tight text-[#1f1218] mb-8 mt-2">
          Gest<span className="text-[#b5368f]">Antonia</span>
        </h1>

        {estado === 'cargando' && (
          <div className="flex flex-col items-center animate-pulse py-6">
            <div className="w-14 h-14 border-4 border-[#fbeef6] border-t-[#b5368f] rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 font-medium">{mensaje}</p>
          </div>
        )}

        {estado === 'exito' && (
          <div className="w-full flex flex-col items-center py-4">
            <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4 shadow-sm border border-green-100">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">¡Listo!</h2>
            <p className="text-gray-600 mb-8 font-medium">{mensaje}</p>
          </div>
        )}

        {estado === 'error' && (
          <div className="w-full flex flex-col items-center py-4">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 shadow-sm border border-red-100">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <h2 className="text-2xl font-bold text-red-700 mb-2">¡Ups!</h2>
            <p className="text-gray-600 mb-8 font-medium">{mensaje}</p>
          </div>
        )}

        {estado !== 'cargando' && (
          <button 
            onClick={handleCerrarSesion}
            className="w-full bg-[#b5368f] text-white py-3.5 px-6 rounded-xl font-semibold hover:bg-[#9d2d7c] transition-colors shadow-md flex items-center justify-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}