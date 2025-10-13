import apiClient from "./httpClient.js";
import { mapCenterFromApi, mapCentersFromApi, mapCenterToApi } from "./centers.js";
import { normaliseListPayload, ensureId } from "./utils.js";
import { apiUrl } from "./routes.js";

const CENTERS_URL = apiUrl("centers");
const resolveCenterUrl = (centerId) => apiUrl("centers", ensureId(centerId, "resolveCenterUrl"));

// Lista los centros disponibles aplicando normalizacion de respuesta.
export async function listCenters(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(CENTERS_URL, { signal, query });
  const rawList = normaliseListPayload(payload);
  return {
    centers: mapCentersFromApi(rawList),
    raw: payload,
  };
}

// Recupera un centro puntual con mapeo consistente.
export async function getCenter(centerId, options = {}) {
  if (centerId === undefined || centerId === null) {
    throw new Error("getCenter: centerId is required");
  }
  const { signal } = options;
  const payload = await apiClient.get(resolveCenterUrl(centerId), { signal });
  return {
    center: mapCenterFromApi(payload),
    raw: payload,
  };
}

// Crea un centro nuevo validando los campos indispensables.
export async function createCenter(data, options = {}) {
  const payload = mapCenterToApi(data);
  if (!payload.nombre) {
    throw new Error("createCenter: nombre is required");
  }
  const { signal } = options;
  const response = await apiClient.post(CENTERS_URL, {
    data: payload,
    signal,
  });
  return {
    center: mapCenterFromApi(response),
    raw: response,
  };
}

// Actualiza un centro existente manteniendo el mapeo de datos homogeneo.
export async function updateCenter(centerId, data, options = {}) {
  if (centerId === undefined || centerId === null) {
    throw new Error("updateCenter: centerId is required");
  }
  const payload = mapCenterToApi(data);
  const { signal } = options;
  const response = await apiClient.patch(resolveCenterUrl(centerId), {
    data: payload,
    signal,
  });
  return {
    center: mapCenterFromApi(response),
    raw: response,
  };
}

// Elimina un centro por identificador manteniendo la misma validacion.
export async function deleteCenter(centerId, options = {}) {
  if (centerId === undefined || centerId === null) {
    throw new Error("deleteCenter: centerId is required");
  }
  const { signal } = options;
  await apiClient.delete(resolveCenterUrl(centerId), { signal });
}

