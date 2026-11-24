
import { useState } from 'react';
import { Sidebar } from '../../../components/Sidebar';
import { useTitulo } from '../../../hooks/useTitulo';
import { useSucursalId } from '../../../hooks/useSucursal';
import Reportes from './Reportes';
import './reportes.css';

export function ReportesAdmin() {
  useTitulo('Panel de control');

  const sucursal = useSucursalId();
  const [aviso, setAviso] = useState('');

  return (
    <Sidebar>
      <div className="ga-reports">
        {sucursal != null ? (
          <Reportes
            selectedSucursal={sucursal}
            mostrarAviso={setAviso}
          />
        ) : (
          <p className="loading-report">
            Cargando sucursal...
          </p>
        )}

        {aviso && (
          <div className="report-toast" role="status">
            <span>{aviso}</span>
            <button
              type="button"
              onClick={() => setAviso('')}
              aria-label="Cerrar mensaje"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </Sidebar>
  );
}
