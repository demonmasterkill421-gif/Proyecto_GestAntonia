import { Link } from "react-router-dom";

const ESTILOS = {
  principal:
    "bg-[#b5368f] text-white hover:bg-[#9c2d7b] disabled:opacity-40 disabled:hover:bg-[#b5368f]",
  secundario: "border border-[#b5368f] bg-white text-[#b5368f] hover:bg-[#fbeef6]",
  neutro: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
};

const TAMANOS = {
  normal: "h-10 px-4 text-sm sm:h-12 sm:px-5 sm:text-base",
  grande: "h-12 px-5 text-base sm:h-14 sm:px-6 sm:text-lg",
};

export function Boton({
  variante = "principal",
  tamano = "normal",
  ruta,
  className = "",
  children,
  ...props
}) {
  const clases = `flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-95 disabled:cursor-not-allowed ${ESTILOS[variante]} ${TAMANOS[tamano]} ${className}`;

  // Con "ruta" navega a otra página; sin "ruta" es un botón normal
  if (ruta) {
    return (
      <Link to={ruta} className={clases} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={clases} {...props}>
      {children}
    </button>
  );
}