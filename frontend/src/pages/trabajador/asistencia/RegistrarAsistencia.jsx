import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../auth/AuthContext';
import { useTitulo } from '../../../../hooks/useTitulo';
import { escanearAsistenciaAutomatica } from '../../../../api/asistencia.api';

export function RegistrarAsistencia() {
  useTitulo("Registro de Asistencia");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();

  const [estado, setEstado] = useState('cargando'); // 'cargando', 'exito', 'error'
  const [mensaje, setMensaje] = useState("Registrando tu asistencia...");

  useEffect(() => {
    const registrarAsistencia = async () => {
      // Capturamos el token del QR desde los parámetros de la URL (ej: ?qr=TOKEN)
      const tokenQR = searchParams.get("qr");

      if (!tokenQR) {
        setEstado('error');
        setMensaje("No se detectó un código QR válido en el enlace.");
        return;
      }

      try {
        // Enviamos el token al backend para su validación de seguridad
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

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>Registro de Asistencia por QR</h2>
      <div style={{ marginTop: "1.5rem", fontSize: "1.2rem", color: estado === 'error' ? 'red' : estado === 'exito' ? 'green' : 'black' }}>
        {mensaje}
      </div>
    </div>
  );
}