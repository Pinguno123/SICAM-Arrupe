import apiClient from "./httpClient.js";
import { mapContractFromApi, mapContractsFromApi, mapContractToApi } from "./contracts.js";
import { normaliseListPayload, ensureId } from "./utils.js";
import { apiUrl } from "./routes.js";

const CONTRACTS_URL = apiUrl("contracts");
const resolveContractUrl = (contractId) =>
  apiUrl("contracts", ensureId(contractId, "resolveContractUrl", "contractId is required"));

// Lista los contratos disponibles usando normalizacion comun.
export async function listContracts(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(CONTRACTS_URL, { signal, query });
  const rawList = normaliseListPayload(payload);
  return {
    contracts: mapContractsFromApi(rawList),
    raw: payload,
  };
}

// Obtiene el detalle de un contrato especifico.
export async function getContract(contractId, options = {}) {
  ensureId(contractId, "getContract", "contractId is required");
  const { signal } = options;
  const payload = await apiClient.get(resolveContractUrl(contractId), { signal });
  return {
    contract: mapContractFromApi(payload),
    raw: payload,
  };
}

// Registra un nuevo contrato respetando el mapeo al backend.
export async function createContract(data, options = {}) {
  const payload = mapContractToApi(data, { mode: "create" });
  const { signal } = options;
  const response = await apiClient.post(CONTRACTS_URL, {
    data: payload,
    signal,
  });
  return {
    contract: mapContractFromApi(response),
    raw: response,
  };
}

// Actualiza un contrato existente manteniendo el mismo esquema que create.
export async function updateContract(contractId, data, options = {}) {
  ensureId(contractId, "updateContract", "contractId is required");
  const payload = mapContractToApi(data, { mode: "update" });
  const { signal } = options;
  const response = await apiClient.patch(resolveContractUrl(contractId), {
    data: payload,
    signal,
  });
  return {
    contract: mapContractFromApi(response),
    raw: response,
  };
}

// Elimina un contrato aprovechando la validacion centralizada de IDs.
export async function deleteContract(contractId, options = {}) {
  ensureId(contractId, "deleteContract", "contractId is required");
  const { signal } = options;
  await apiClient.delete(resolveContractUrl(contractId), { signal });
}

// Devuelve los servicios que un centro puede ofrecer, normalizados.
export async function listAvailableServicesByCenter(centerId, options = {}) {
  const safeCenterId = ensureId(centerId, "listAvailableServicesByCenter", "centerId is required");
  const { signal, query } = options;
  const url = apiUrl("filters", "servicios-disponibles", safeCenterId);
  const payload = await apiClient.get(url, { signal, query });
  const servicesList = normaliseListPayload(payload);
  const services = servicesList.length > 0 ? servicesList : payload;
  return { services, raw: payload };
}



