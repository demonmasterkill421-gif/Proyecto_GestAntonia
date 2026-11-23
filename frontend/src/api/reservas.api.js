import api from "./client";

const R = "/api/reservas";

// Agenda
export const obtenerAgenda = (fecha, local) => api.get(`${R}/agenda/`, { params: { fecha, local } });

// Reservas
export const listarReservas = (filtros) => api.get(`${R}/reservas/`, { params: filtros });
export const obtenerReserva = (id) => api.get(`${R}/reservas/${id}/`);
export const crearReserva = (datos) => api.post(`${R}/reservas/`, datos);
export const reprogramarReserva = (id, inicio) => api.post(`${R}/reservas/${id}/reprogramar/`, { inicio });
export const cancelarReserva = (id, motivo) => api.post(`${R}/reservas/${id}/cancelar/`, { motivo });
export const cambiarEstado = (id, estado, motivo = "") => api.post(`${R}/reservas/${id}/estado/`, { estado, motivo });

// Clientes
export const buscarCliente = (telefono) => api.get(`${R}/clientes/`, { params: { telefono } });
export const obtenerCliente = (id) => api.get(`${R}/clientes/${id}/`);
export const crearCliente = (datos) => api.post(`${R}/clientes/`, datos);
export const editarCliente = (id, datos) => api.patch(`${R}/clientes/${id}/`, datos);
export const eliminarDatosCliente = (id) => api.post(`${R}/clientes/${id}/eliminar-datos/`);
export const obtenerHistorial = (id) => api.get(`${R}/clientes/${id}/historial/`);
export const guardarObservacion = (id, observacion) => api.post(`${R}/clientes/${id}/observacion/`, { observacion });

// Servicios
export const listarServicios = () => api.get(`${R}/servicios/`);

// Especialistas
export const listarEspecialistas = (local) => api.get(`${R}/especialistas/`, { params: { local } });
export const obtenerEspecialista = (id) => api.get(`${R}/especialistas/${id}/`);
export const crearEspecialista = (datos) => api.post(`${R}/especialistas/`, datos);
export const editarEspecialista = (id, datos) => api.patch(`${R}/especialistas/${id}/`, datos);
export const desactivarEspecialista = (id) => api.post(`${R}/especialistas/${id}/desactivar/`);
export const activarEspecialista = (id) => api.post(`${R}/especialistas/${id}/activar/`);

// Recepcionistas (solo la administradora)
export const listarRecepcionistas = (local) => api.get(`${R}/recepcionistas/`, { params: { local } });
export const obtenerRecepcionista = (id) => api.get(`${R}/recepcionistas/${id}/`);
export const crearRecepcionista = (datos) => api.post(`${R}/recepcionistas/`, datos);
export const editarRecepcionista = (id, datos) => api.patch(`${R}/recepcionistas/${id}/`, datos);
export const desactivarRecepcionista = (id) => api.post(`${R}/recepcionistas/${id}/desactivar/`);
export const activarRecepcionista = (id) => api.post(`${R}/recepcionistas/${id}/activar/`);
