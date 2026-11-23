import { useEffect, useState } from "react";
import { listarLocales } from "../api/locales.api";

// Locales reales de la base de datos (antes era una lista fija de 3 locales de ejemplo).
// Se piden una vez a /api/reservas/locales/ y se guardan para mostrarlos al tiro la próxima vez.
// Cuando la administradora crea o edita un local, se llama a cargarSucursales() y todo se actualiza.
const CLAVE = "sucursal";
const CLAVE_LISTA = "locales";
const EVENTO = "sucursal-cambiada";
const EVENTO_LISTA = "locales-cambiados";

function leerListaGuardada() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_LISTA) ?? "[]");
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

let sucursales = leerListaGuardada();
let pedido = null;

/** Vuelve a pedir los locales al servidor (por ejemplo, después de crear uno). */
export function cargarSucursales() {
  if (!pedido) {
    pedido = listarLocales()
      .then(({ data }) => {
        sucursales = data.map((l) => ({ id: l.id, nombre: l.nombre, estado: l.estado }));
        try {
          localStorage.setItem(CLAVE_LISTA, JSON.stringify(sucursales));
        } catch {
          // si no se puede guardar, igual funciona
        }
        window.dispatchEvent(new Event(EVENTO_LISTA));
      })
      .catch(() => {}) // sin sesión o sin conexión: se queda con la lista que tenía
      .finally(() => {
        pedido = null;
      });
  }
  return pedido;
}

/** Lista de locales [{ id, nombre, estado }]; se actualiza sola cuando cambia. */
export function useSucursales() {
  const [lista, setLista] = useState(sucursales);
  useEffect(() => {
    const actualizar = () => setLista(sucursales);
    window.addEventListener(EVENTO_LISTA, actualizar);
    cargarSucursales();
    return () => window.removeEventListener(EVENTO_LISTA, actualizar);
  }, []);
  return lista;
}

export function leerSucursalId() {
  let id = null;
  try {
    id = Number(localStorage.getItem(CLAVE)) || null;
  } catch {
    // sin almacenamiento: se usa el primer local
  }
  if (sucursales.length === 0) return id; // aún no llega la lista: se respeta lo guardado
  return sucursales.some((s) => s.id === id) ? id : sucursales[0].id;
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
    window.addEventListener(EVENTO_LISTA, actualizar);
    window.addEventListener("storage", actualizar);
    return () => {
      window.removeEventListener(EVENTO, actualizar);
      window.removeEventListener(EVENTO_LISTA, actualizar);
      window.removeEventListener("storage", actualizar);
    };
  }, []);

  return id;
}