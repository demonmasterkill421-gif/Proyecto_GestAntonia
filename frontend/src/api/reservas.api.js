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

// Clientes
export const buscarCliente = (telefono) => api.get(`${R}/clientes/`, { params: { telefono } });
export const obtenerCliente = (id) => api.get(`${R}/clientes/${id}/`);
export const crearCliente = (datos) => api.post(`${R}/clientes/`, datos);

// Servicios
export const listarServicios = () => api.get(`${R}/servicios/`);

// Especialistas
export const listarEspecialistas = (local) => api.get(`${R}/especialistas/`, { params: { local } });
export const obtenerEspecialista = (id) => api.get(`${R}/especialistas/${id}/`);
export const crearEspecialista = (datos) => api.post(`${R}/especialistas/`, datos);
export const editarEspecialista = (id, datos) => api.patch(`${R}/especialistas/${id}/`, datos);
export const desactivarEspecialista = (id) => api.post(`${R}/especialistas/${id}/desactivar/`);
export const activarEspecialista = (id) => api.post(`${R}/especialistas/${id}/activar/`);
