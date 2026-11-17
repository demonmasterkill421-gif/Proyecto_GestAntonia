import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../../../auth/AuthContext';
import { useTitulo } from '../../../hooks/useTitulo';
import { escanearAsistenciaAutomatica } from '../../../api/asistencia.api';

export function RegistrarAsistencia() {
  useTitulo("Registro de Asistencia");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();

  const [estado, setEstado] = useState('cargando'); // 'cargando', 'exito', 'error'
  const [mensaje, setMensaje] = useState("Procesando tu asistencia...");

  // Bandera para evitar el doble disparo de React StrictMode
  const peticionEnviada = useRef(false);

  useEffect(() => {
    if (peticionEnviada.current) return;

    const registrarAsistencia = async () => {
      const tokenQR = searchParams.get("qr");

      if (!tokenQR) {
        setEstado('error');
        setMensaje("No se detectó un código QR válido en el enlace.");
        return;
      }

      peticionEnviada.current = true;

      try {
        const response = await escanearAsistenciaAutomatica(tokenQR);
        setEstado('exito');
        setMensaje(response.data.mensaje || "¡Asistencia registrada correctamente!");
      } catch (error) {
        setEstado('error');
        const errorServidor = error.response?.data?.error || error.response?.data?.detail;
        setMensaje(errorServidor || "Hubo un problema al registrar la asistencia.");
      }
    };

    registrarAsistencia();
  }, [searchParams]);

  // Función para cerrar la sesión y volver al login
  const finalizarYCerrar = () => {
    auth.cerrarSesion(); // Desconecta a la trabajadora
    navigate('/login', { replace: true }); // La manda al inicio de sesión
  };

  return (
    <main className="fondo-animado min-h-screen flex flex-col items-center justify-center px-4 bg-[#fbfbf9]">
      <div className="w-full max-w-md rounded-2xl bg-white px-8 py-10 text-center shadow-[0_4px_24px_rgba(181,54,143,0.12)] border border-gray-100">
        
        {/* Título de la app */}
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-[#1f1218]">
          Gest<span className="text-[#b5368f]">Antonia</span>
        </h1>

        {/* Contenido Dinámico según estado */}
        <div className="flex min-h-[160px] flex-col items-center justify-center">
          
          {estado === 'cargando' && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <Loader2 className="h-16 w-16 animate-spin text-[#b5368f] mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">Validando QR</h2>
              <p className="mt-2 text-sm text-gray-500">{mensaje}</p>
            </div>
          )}

          {estado === 'exito' && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
              <div className="rounded-full bg-green-50 p-4 mb-4 ring-8 ring-green-50/50">
                <CheckCircle className="h-14 w-14 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">¡Todo Listo!</h2>
              <p className="mt-2 text-base font-medium text-green-600">{mensaje}</p>
            </div>
          )}

          {estado === 'error' && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
              <div className="rounded-full bg-red-50 p-4 mb-4 ring-8 ring-red-50/50">
                <XCircle className="h-14 w-14 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Algo falló</h2>
              <p className="mt-2 text-base font-medium text-red-500">{mensaje}</p>
            </div>
          )}
        </div>

        {/* Botón de acción */}
        {estado !== 'cargando' && (
          <button
            onClick={finalizarYCerrar}
            className="mt-10 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1f1218] text-sm font-semibold text-white transition-all hover:bg-[#3a222d] focus:outline-none focus:ring-2 focus:ring-[#1f1218]/50 focus:ring-offset-2 hover:shadow-lg"
          >
            <LogOut size={18} />
            Finalizar y salir
          </button>
        )}
      </div>
    </main>
  );
}