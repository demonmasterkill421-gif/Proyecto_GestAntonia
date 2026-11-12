import { useCallback, useEffect, useState } from "react";

export function useDatos(cargar, { cadaMs = 0 } = {}) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const recargar = useCallback(async () => {
    try {
      const res = await cargar();
      const bruto = res.data ?? res;
      setDatos(Array.isArray(bruto) ? bruto : (bruto.results ?? []));
      setError("");
    } catch {
      setError("No se pudo cargar la información");
    } finally {
      setCargando(false);
    }
  }, [cargar]);

  useEffect(() => {
    recargar();
    if (!cadaMs) return;
    const id = setInterval(recargar, cadaMs);
    return () => clearInterval(id);
  }, [recargar, cadaMs]);

  return { datos, cargando, error, recargar };
}