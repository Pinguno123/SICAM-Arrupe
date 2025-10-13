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
  delete payload.contratoCentroAtencionId;
  delete payload.contratoCentroId;
  delete payload.servicioId;
  delete payload.idServicio;
  if (!payload.contratoCentroAtencion?.id || !payload.servicio?.id) {
    throw new Error("createServiceContract: contrato y servicio son obligatorios");
  }
  if (payload.cantidad === null || payload.cantidad === undefined) {
    throw new Error("createServiceContract: cantidad es obligatoria");
  }
  const { signal } = options;
  const response = await apiClient.post(SERVICE_CONTRACTS_URL, { data: payload, signal });
  return {
    serviceContract: mapServiceContractFromApi(response),
    raw: response,
  };
}

// Actualiza un servicio contratado reutilizando la validacion de ID.
export async function updateServiceContract(id, data, options = {}) {
  ensureId(id, "updateServiceContract", "id is required");
  const payload = mapServiceContractToApi(data);
  delete payload.contratoCentroAtencionId;
  delete payload.contratoCentroId;
  delete payload.servicioId;
  delete payload.idServicio;
  const { signal } = options;
  const response = await apiClient.patch(resolveServiceContractUrl(id), { data: payload, signal });
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
