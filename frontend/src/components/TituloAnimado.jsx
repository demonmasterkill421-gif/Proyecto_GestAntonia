import { useAuth } from "../auth/AuthContext";

const ETIQUETA_ROL = { ADMIN: "Propietaria", RECEP: "Recepcionista", TRAB: "Especialista" };

export function TituloAnimado() {
  const { usuario } = useAuth();

  return (
    <div className="animate-aparecer">
      <h1 className="text-4xl font-bold text-[#1f1218] sm:text-5xl">
        Bienvenid@ <span className="text-[#b5368f]">{usuario?.nombre}</span>
      </h1>
      <p className="mt-2 text-lg text-gray-600">{ETIQUETA_ROL[usuario?.rol]}</p>
    </div>
  );
}