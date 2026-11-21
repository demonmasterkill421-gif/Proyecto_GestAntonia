import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { QrCode, RefreshCw, Copy, ExternalLink, Loader2 } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { ListaAsistencia } from "../../../components/ListaAsistencia";
import { useTitulo } from "../../../hooks/useTitulo";
import { useSucursalId, SUCURSALES } from "../../../hooks/useSucursal";
import { obtenerQR, generarQR } from "../../../api/asistencia.api";

function formatearVigencia(fechaIso) {
  if (!fechaIso) return "";
  return new Date(fechaIso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AsistenciaAdmin() {
  useTitulo("Asistencia");
  const sucursalId = useSucursalId();
  const nombreSucursal =
    SUCURSALES.find((s) => s.id === sucursalId)?.nombre || `Local #${sucursalId}`;

  const [qr, setQr] = useState(null);
  const [cargandoQr, setCargandoQr] = useState(true);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargandoQr(true);

    obtenerQR(sucursalId)
      .then(({ data }) => {
        if (activo) setQr(data);
      })
      .catch(() => {
        if (activo) {
          setQr(null);
          toast.error("No se pudo consultar el QR de este local.");
        }
      })
      .finally(() => {
        if (activo) setCargandoQr(false);
      });

    return () => {
      activo = false;
    };
  }, [sucursalId]);

  const handleGenerar = async () => {
    setGenerando(true);
    try {
      const { data } = await generarQR(sucursalId);
      setQr(data);
      toast.success(`Token QR generado para ${nombreSucursal}`);
    } catch (error) {
      const msg = error.response?.data?.detail || "No se pudo generar el token QR.";
      toast.error(msg);
    } finally {
      setGenerando(false);
    }
  };

  const handleCopiar = async () => {
    if (!qr?.url) return;
    try {
      await navigator.clipboard.writeText(qr.url);
      toast.success("Enlace QR copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  return (
    <Sidebar>
      <h1 className="text-3xl font-bold text-[#a8238f]">Asistencia</h1>
      <p className="mb-6 text-base text-gray-600">
        Asistencia de las trabajadoras de todos los locales.
      </p>

      {/* Panel de gestión de Token QR por sucursal */}
      <section className="mb-6 rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-pink-50 p-3 text-[#a8238f]">
              <QrCode size={26} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Código QR — {nombreSucursal}
              </h2>
              {cargandoQr ? (
                <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={15} className="animate-spin" />
                  Consultando token activo...
                </p>
              ) : qr?.existe ? (
                <div className="mt-1 space-y-1">
                  <p className="text-sm text-green-700 font-medium">
                    Token activo · Vigente hasta {formatearVigencia(qr.vigente_hasta)}
                  </p>
                  <p className="max-w-xl truncate text-xs text-gray-500 font-mono">
                    {qr.url}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-amber-700">
                  Este local no tiene un token QR activo todavía.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerar}
              disabled={generando || cargandoQr}
              className="flex items-center gap-2 rounded-lg bg-[#a8238f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8d1c78] disabled:opacity-50"
            >
              {generando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {qr?.existe ? "Regenerar token" : "Generar token QR"}
            </button>

            {qr?.existe && (
              <>
                <button
                  type="button"
                  onClick={handleCopiar}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <Copy size={16} />
                  Copiar enlace
                </button>

                <a
                  href={qr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-[#1f1218] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3a222d]"
                >
                  <ExternalLink size={16} />
                  Abrir enlace
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      <ListaAsistencia rol="ADMIN" />
    </Sidebar>
  );
}