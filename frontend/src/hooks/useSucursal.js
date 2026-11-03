import { useEffect, useState } from "react";

// Lista de ejemplo. Después se reemplaza por los datos de /api/locales/
export const SUCURSALES = [
  { id: 1, nombre: "Local Mall Plaza Calama" },
  { id: 2, nombre: "Local Centro 1" },
  { id: 3, nombre: "Local Centro 2" },
];

const CLAVE = "sucursal";
const EVENTO = "sucursal-cambiada";

export function leerSucursalId() {
  try {
    const id = Number(localStorage.getItem(CLAVE));
    return SUCURSALES.some((s) => s.id === id) ? id : SUCURSALES[0].id;
  } catch {
    return SUCURSALES[0].id;
  }
}

export function guardarSucursalId(id) {
  try {
    localStorage.setItem(CLAVE, id);
  } catch {
    // si no se puede guardar, igual funciona
  }
  // Avisa a todas las pantallas que la sucursal cambió
  window.dispatchEvent(new Event(EVENTO));
}

// Devuelve el id de la sucursal elegida y se actualiza solo cuando cambia
export function useSucursalId() {
  const [id, setId] = useState(leerSucursalId);

  useEffect(() => {
    const actualizar = () => setId(leerSucursalId());
    window.addEventListener(EVENTO, actualizar);
    window.addEventListener("storage", actualizar);
    return () => {
      window.removeEventListener(EVENTO, actualizar);
      window.removeEventListener("storage", actualizar);
    };
  }, []);

  return id;
}