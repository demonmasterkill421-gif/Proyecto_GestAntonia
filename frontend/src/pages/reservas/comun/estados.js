// Estados de la reserva con los nombres del sistema que ya usaba el local (Reservo) y un color para cada uno.
// El valor (AGENDADA, CANCELADA…) es el que guarda la base de datos; el nombre es el que ve la recepcionista.
// libera: el horario queda libre para otra clienta (la reserva no se borra: queda en el histórico).
// Las clases van escritas completas para que Tailwind las incluya al compilar.

export const ESTADOS = [
  { valor: "AGENDADA", nombre: "No confirmado", libera: false,
    bloque: "bg-slate-50 border-slate-400", texto: "text-slate-700", chip: "bg-slate-100 text-slate-700" },
  { valor: "CONFIRMADA", nombre: "Confirmado", libera: false,
    bloque: "bg-blue-50 border-blue-600", texto: "text-blue-800", chip: "bg-blue-100 text-blue-800" },
  { valor: "LLEGO", nombre: "Llegó", libera: false,
    bloque: "bg-amber-50 border-amber-500", texto: "text-amber-800", chip: "bg-amber-100 text-amber-800" },
  { valor: "ATENCION", nombre: "En atención", libera: false,
    bloque: "bg-purple-50 border-purple-600", texto: "text-purple-800", chip: "bg-purple-100 text-purple-800" },
  { valor: "ATENDIDA", nombre: "Atendido", libera: false,
    bloque: "bg-teal-50 border-teal-600", texto: "text-teal-800", chip: "bg-teal-100 text-teal-800" },
  { valor: "NO_LLEGO", nombre: "No llegó", libera: true,
    bloque: "bg-red-50 border-red-600", texto: "text-red-800", chip: "bg-red-100 text-red-800" },
  { valor: "CANCELADA", nombre: "Suspendió", libera: true,
    bloque: "bg-gray-100 border-gray-500", texto: "text-gray-700", chip: "bg-gray-200 text-gray-700" },
  { valor: "ESPERA", nombre: "Lista de espera", libera: true,
    bloque: "bg-orange-50 border-orange-500", texto: "text-orange-800", chip: "bg-orange-100 text-orange-800" },
];

const POR_VALOR = Object.fromEntries(ESTADOS.map((e) => [e.valor, e]));

export const estadoDe = (valor) => POR_VALOR[valor] ?? ESTADOS[0];
