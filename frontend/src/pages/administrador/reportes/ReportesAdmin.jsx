import { useEffect, useState } from 'react';
import { Sidebar } from '../../../components/Sidebar';
import { useTitulo } from '../../../hooks/useTitulo';
import Reportes from './Reportes';
import './reportes.css';

function leerLocalActual() {
  try {
    const localId = Number(window.localStorage.getItem('sucursal'));
    return Number.isInteger(localId) && localId > 0 ? localId : 1;
  } catch {
    return 1;
  }
}

export function ReportesAdmin() {
  useTitulo('Panel de control');
  const [sucursal, setSucursal] = useState(leerLocalActual);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    function actualizarSucursal(event) {
      const id = Number(event?.detail?.id);
      setSucursal(Number.isInteger(id) && id > 0 ? id : leerLocalActual());
    }

    function actualizarDesdeOtraPestana() {
      setSucursal(leerLocalActual());
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
