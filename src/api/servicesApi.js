import apiClient from "./httpClient.js";
import { mapServiceFromApi, mapServicesFromApi, mapServiceToApi } from "./services.js";
import { normaliseListPayload, ensureId } from "./utils.js";
import { apiUrl } from "./routes.js";

const SERVICES_URL = apiUrl("services");
const resolveServiceUrl = (serviceId) =>
  apiUrl("services", ensureId(serviceId, "resolveServiceUrl", "serviceId is required"));

// Lista los servicios disponibles del backend.
export async function listServices(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(SERVICES_URL, { signal, query });
  const rawList = normaliseListPayload(payload);
  return {
    services: mapServicesFromApi(rawList),
    raw: payload,
  };
}

// Recupera el detalle de un servicio individual.
export async function getService(serviceId, options = {}) {
  if (serviceId === undefined || serviceId === null) {
    throw new Error("getService: serviceId is required");
  }
  const { signal } = options;
  const payload = await apiClient.get(resolveServiceUrl(serviceId), { signal });
  return {
    service: mapServiceFromApi(payload),
    raw: payload,
  };
}

// Crea un servicio nuevo validando presencia de nombre y precio.
export async function createService(data, options = {}) {
  const payload = mapServiceToApi(data);
  if (!payload.nombre) {
    throw new Error("createService: nombre is required");
  }
  if (payload.precio === undefined) {
    throw new Error("createService: precio is required");
  }
  const { signal } = options;
  const response = await apiClient.post(SERVICES_URL, {
    data: payload,
    signal,
  });
  return {
    service: mapServiceFromApi(response),
    raw: response,
  };
}

// Actualiza un servicio respetando el mismo contrato que la creacion.
export async function updateService(serviceId, data, options = {}) {
  if (serviceId === undefined || serviceId === null) {
    throw new Error("updateService: serviceId is required");
  }
  const payload = mapServiceToApi(data);
  const { signal } = options;
  const response = await apiClient.put(resolveServiceUrl(serviceId), {
    data: payload,
    signal,
  });
  return {
    service: mapServiceFromApi(response),
    raw: response,
  };
}

// Elimina un servicio utilizando la URL construida con utilidades comunes.
export async function deleteService(serviceId, options = {}) {
  if (serviceId === undefined || serviceId === null) {
    throw new Error("deleteService: serviceId is required");
  }
  const { signal } = options;
  await apiClient.delete(resolveServiceUrl(serviceId), { signal });
}


