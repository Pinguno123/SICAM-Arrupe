// Utilidades compartidas para la capa de API. Mantienen las validaciones y
// transformaciones usadas a lo largo de los clientes HTTP.
import { buildApiUrl } from "./config.js";

function isNil(value) {
  return value === undefined || value === null;
}

/**
 * Normaliza las respuestas de listas sin depender de la forma exacta del backend.
 */
export function normaliseListPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload.items)) {
    return payload.items;
  }
  if (Array.isArray(payload.data?.items)) {
    return payload.data.items;
  }
  if (Array.isArray(payload.content)) {
    return payload.content;
  }
  if (Array.isArray(payload.data?.content)) {
    return payload.data.content;
  }
  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  return [];
}

/**
 * Devuelve el objeto de datos relevante dentro de una respuesta de detalle.
 */
export function normaliseSinglePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  if (payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  if (payload.result && typeof payload.result === "object") {
    return payload.result;
  }
  return payload;
}

/**
 * Garantiza que el identificador exista antes de construir una URL.
 */
export function ensureId(value, context = "id", errorMessage = "id es requerido") {
  if (isNil(value) || value === "") {
    throw new Error(`${context}: ${errorMessage}`);
  }
  return value;
}

/**
 * Ensambla una URL a partir de un recurso y su identificador validado.
 */
export function buildResourceUrl(path, id, context, errorMessage) {
  const safeId = ensureId(id, context, errorMessage);
  return buildApiUrl(`${path}/${safeId}`);
}
