import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { FolderOpen } from "lucide-react";
import { CARPETAS, carpetaActual, prepararCarpeta, soportaCarpeta } from "../utils/carpetas";

// Línea "Se guardan en «Carpeta» · Cambiar" con la ventana que explica cómo elegir la carpeta.
// tipo: "boletas", "ventas" o "asistencia" (ver utils/carpetas.js).
// onCambio(nombre): avisa el nombre de la carpeta elegida (o null si aún no hay).
export function CarpetaDestino({ tipo, onCambio, className = "" }) {
  const nombreCarpeta = CARPETAS[tipo];
  const [carpeta, setCarpeta] = useState(null);
  const [ayuda, setAyuda] = useState(false);

  useEffect(() => {
    carpetaActual(tipo).then((nombre) => {
      setCarpeta(nombre);
      onCambio?.(nombre);
    });
    // onCambio no va en las dependencias: basta leer la carpeta al abrir la pantalla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  useEffect(() => {
    if (!ayuda) return;
    const alPresionar = (e) => e.key === "Escape" && setAyuda(false);
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [ayuda]);

  if (!soportaCarpeta()) return null;

  // El clic de "Abrir ventana" es el que deja al navegador mostrar su ventana de carpetas
  const elegir = async () => {
    setAyuda(false);
    const elegida = await prepararCarpeta(tipo, { cambiar: true });
    if (elegida) {
      const nombre = await carpetaActual(tipo);
      setCarpeta(nombre);
      onCambio?.(nombre);
      toast.success(`Se guardarán en «${nombre}»`);
    }
  };

  return (
    <>
      <p className={`flex flex-wrap items-center gap-x-2 text-sm text-gray-600 ${className}`}>
        <FolderOpen size={16} className="shrink-0 text-[#b5368f]" />
        {carpeta ? <>Se guardan en «{carpeta}»</> : <>Elige una carpeta y se guardarán solos en «{nombreCarpeta}» (si no, se descargan)</>}
        <button type="button" onClick={() => setAyuda(true)} className="cursor-pointer font-semibold text-[#b5368f] underline">
          {carpeta ? "Cambiar" : "Elegir carpeta"}
        </button>
      </p>

      {ayuda && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setAyuda(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby={`titulo-carpeta-${tipo}`} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white p-6 text-left shadow-2xl">
            <h2 id={`titulo-carpeta-${tipo}`} className="flex items-center gap-2 text-2xl font-bold text-[#1f1218]">
              <FolderOpen className="text-[#b5368f]" /> Carpeta «{nombreCarpeta}»
            </h2>
            <p className="mt-3 text-base text-gray-700">En la ventana que se abrirá:</p>
            <ol className="mt-2 list-decimal space-y-1 pl-6 text-base text-gray-700">
              <li>Entra a <b>Documentos</b>.</li>
              <li>Presiona <b>Nueva carpeta</b> y llámala <b>{nombreCarpeta}</b> (si ya existe, solo ábrela).</li>
              <li>Selecciónala y presiona <b>Seleccionar carpeta</b>. Si Chrome pregunta, elige <b>Permitir</b>.</li>
            </ol>
            <p className="mt-3 rounded-lg bg-[#fbeef6] p-3 text-sm text-[#7a2461]">
              Chrome no permite elegir directamente Documentos, Descargas ni Escritorio («contiene archivos del sistema»),
              pero sí una carpeta dentro de ellas. Si eliges una carpeta con otro nombre (por ejemplo «GestAntonia»),
              adentro se crean solas «Boletas Ventas», «Reportes Ventas» y «Reportes Asistencia».
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setAyuda(false)}
                className="h-12 cursor-pointer rounded-lg border border-gray-300 bg-white text-lg font-semibold text-gray-700 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="button" autoFocus onClick={elegir}
                className="h-12 cursor-pointer rounded-lg bg-[#b5368f] text-lg font-semibold text-white hover:bg-[#9c2d7b]">
                Abrir ventana
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
