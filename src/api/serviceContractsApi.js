import apiClient from "./httpClient.js";
import { mapServiceContractFromApi, mapServiceContractsFromApi, mapServiceContractToApi } from "./serviceContracts.js";
import { normaliseListPayload, ensureId } from "./utils.js";
import { apiUrl } from "./routes.js";

const SERVICE_CONTRACTS_URL = apiUrl("serviceContracts");
const resolveServiceContractUrl = (id) =>
  apiUrl("serviceContracts", ensureId(id, "resolveServiceContractUrl", "id is required"));

// Lista los contratos de servicio aplicando la normalizacion comun.
export async function listServiceContracts(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(SERVICE_CONTRACTS_URL, { signal, query });
  const rawList = normaliseListPayload(payload);
  return {
    serviceContracts: mapServiceContractsFromApi(rawList),
    raw: payload,
  };
}

// Crea una relacion servicio-contrato despues de validar los campos criticos.
export async function createServiceContract(data, options = {}) {
  const payload = mapServiceContractToApi(data);
  if (payload.contratoCentroAtencionId == null) {
    throw new Error("createServiceContract: contratoCentroAtencionId es obligatorio");
  }
  if (payload.servicioId == null) {
    throw new Error("createServiceContract: servicioId es obligatorio");
  }
  if (payload.cantidad === null || payload.cantidad === undefined) {
    throw new Error("createServiceContract: cantidad es obligatoria");
  }
  const requestPayload = {
    contratoCentroAtencionId: payload.contratoCentroAtencionId,
    servicioId: payload.servicioId,
    cantidad: payload.cantidad,
  };
  const { signal } = options;
  const response = await apiClient.post(SERVICE_CONTRACTS_URL, { data: requestPayload, signal });
  return {
    serviceContract: mapServiceContractFromApi(response),
    raw: response,
  };
}

// Actualiza un servicio contratado reutilizando la validacion de ID.
export async function updateServiceContract(id, data, options = {}) {
  ensureId(id, "updateServiceContract", "id is required");
  const payload = mapServiceContractToApi(data);
  if (
    payload.contratoCentroAtencionId == null &&
    payload.servicioId == null &&
    payload.cantidad == null
  ) {
    throw new Error("updateServiceContract: no se proporcionaron campos para actualizar");
  }
  const requestPayload = {
    ...(payload.contratoCentroAtencionId != null && {
      contratoCentroAtencionId: payload.contratoCentroAtencionId,
    }),
    ...(payload.servicioId != null && { servicioId: payload.servicioId }),
    ...(payload.cantidad != null && { cantidad: payload.cantidad }),
  };
  const { signal } = options;
  const response = await apiClient.patch(resolveServiceContractUrl(id), { data: requestPayload, signal });
  return {
    serviceContract: mapServiceContractFromApi(response),
    raw: response,
  };
}

// Elimina un servicio contratado mediante la URL construida de forma centralizada.
export async function deleteServiceContract(id, options = {}) {
  ensureId(id, "deleteServiceContract", "id is required");
  const { signal } = options;
  await apiClient.delete(resolveServiceContractUrl(id), { signal });
}

// Elimina un servicio contratado mediante la URL construida de forma centralizada.
