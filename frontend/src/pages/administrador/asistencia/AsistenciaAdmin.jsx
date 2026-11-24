import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { QrCode, RefreshCw, Copy, ExternalLink, Loader2, Download } from "lucide-react";
import QRCode from "qrcode";
import { Sidebar } from "../../../components/Sidebar";
import { ListaAsistencia } from "../../../components/ListaAsistencia";
import { useTitulo } from "../../../hooks/useTitulo";
import { useSucursalId, useSucursales } from "../../../hooks/useSucursal";
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
  const SUCURSALES = useSucursales();
  const sucursalId = useSucursalId();
  const nombreSucursal =
    SUCURSALES.find((s) => String(s.id) === String(sucursalId))?.nombre ||
    `Local #${sucursalId}`;

  const [qr, setQr] = useState(null);
  const [qrImagen, setQrImagen] = useState("");
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

  useEffect(() => {
    let activo = true;
    if (!qr?.existe || !qr?.url) {
      setQrImagen("");
      return;
    }

    QRCode.toDataURL(qr.url, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: "#1f1218",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (activo) setQrImagen(url);
      })
      .catch(() => {
        if (activo) setQrImagen("");
      });

    return () => {
      activo = false;
    };
  }, [qr]);

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

  const handleDescargarQR = () => {
    if (!qrImagen) {
      toast.error("No se pudo generar la imagen del QR.");
      return;
    }
    const enlace = document.createElement("a");
    enlace.href = qrImagen;
    enlace.download = `QR_${nombreSucursal.replace(/\s+/g, "_")}.png`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    toast.success("Imagen QR descargada");
  };

  return (
    <Sidebar>
      <h1 className="text-3xl font-bold text-[#a8238f]">Asistencia</h1>
      <p className="mb-6 text-base text-gray-600">
        Asistencia de las trabajadoras de todos los locales.
      </p>

      {/* Panel de gestión de Token QR por sucursal */}
      <section className="mb-6 rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {qr?.existe && !cargandoQr && qrImagen ? (
              <div className="flex shrink-0 flex-col items-center rounded-2xl border border-[#e6b8d4] bg-[#fbeef6] p-3">
                <img
                  src={qrImagen}
                  alt={`Código QR de ${nombreSucursal}`}
                  className="h-36 w-36 rounded-lg bg-white"
                />
                <span className="mt-1.5 text-xs font-semibold text-[#9c2d7b]">
                  Escaneable en cámara
                </span>
              </div>
            ) : (
              <div className="w-fit rounded-xl bg-pink-50 p-3 text-[#a8238f]">
                <QrCode size={26} />
              </div>
            )}

            <div className="min-w-0">
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
                  <p className="text-sm font-medium text-green-700">
                    Token activo · Vigente hasta {formatearVigencia(qr.vigente_hasta)}
                  </p>
                  <p className="max-w-xl truncate font-mono text-xs text-gray-500">
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
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-[#a8238f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8d1c78] disabled:opacity-50"
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
                  onClick={handleDescargarQR}
                  disabled={!qrImagen}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#b5368f] bg-[#fbeef6] px-4 py-2.5 text-sm font-semibold text-[#b5368f] transition hover:bg-[#f7e3f1] disabled:opacity-50"
                >
                  <Download size={16} />
                  Descargar QR
                </button>

                <button
                  type="button"
                  onClick={handleCopiar}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
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