import { useEffect, useState } from 'react';
import { Sidebar } from '../../../components/Sidebar';
import { useTitulo } from '../../../hooks/useTitulo';
import Reportes from './Reportes';
import './reportes.css';

// Mapeo TEMPORAL de IDs del selector compartido a los datos de demostración.
// Cuando la API esté disponible, reemplazarlo por los IDs reales de /api/locales/.
const SUCURSALES_DEMO = Object.freeze({
  1: 'mall',
  2: 'vargas',
  3: 'espinosa',
});

function leerSucursalDemo() {
  try {
    const guardada = Number(window.localStorage.getItem('sucursal'));
    return SUCURSALES_DEMO[guardada] ?? 'mall';
  } catch {
    return 'mall';
  }
}

export function ReportesAdmin() {
  useTitulo('Reportes');
  const [sucursal, setSucursal] = useState(leerSucursalDemo);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    function actualizarSucursal(event) {
      const id = Number(event?.detail?.id);
      setSucursal(SUCURSALES_DEMO[id] ?? leerSucursalDemo());
    }

    function actualizarDesdeOtraPestana() {
      setSucursal(leerSucursalDemo());
    }

    window.addEventListener('gestantonia:sucursal-cambiada', actualizarSucursal);
    window.addEventListener('storage', actualizarDesdeOtraPestana);
    return () => {
      window.removeEventListener('gestantonia:sucursal-cambiada', actualizarSucursal);
      window.removeEventListener('storage', actualizarDesdeOtraPestana);
    };
  }, []);

  return (
    <Sidebar>
      <div className="ga-reports">
        <Reportes selectedSucursal={sucursal} mostrarAviso={setAviso} />
        {aviso && (
          <div className="report-toast" role="status">
            <span>{aviso}</span>
            <button type="button" onClick={() => setAviso('')} aria-label="Cerrar mensaje">×</button>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
