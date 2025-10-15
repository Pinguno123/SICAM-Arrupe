import apiClient from "./httpClient.js";
import { mapContractCenterFromApi, mapContractCentersFromApi, mapContractCenterToApi } from "./contractCenters.js";
import { normaliseListPayload, ensureId } from "./utils.js";
import { apiUrl } from "./routes.js";

const CONTRACT_CENTERS_URL = apiUrl("contractCenters");
const resolveContractCenterUrl = (id) =>
  apiUrl("contractCenters", ensureId(id, "resolveContractCenterUrl", "id is required"));

// Recupera las relaciones contrato-centro aplicando el mapeo comun.
export async function listContractCenters(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(CONTRACT_CENTERS_URL, { signal, query });
  const rawList = normaliseListPayload(payload);
  return {
    contractCenters: mapContractCentersFromApi(rawList),
    raw: payload,
  };
}

// Crea una relacion contrato-centro validando datos minimos.
export async function createContractCenter(data, options = {}) {
  const payload = mapContractCenterToApi(data);
  if (payload.contratoId == null || payload.centroAtencionId == null) {
    throw new Error("createContractCenter: contrato y centro son obligatorios");
  }
  const { signal } = options;
  const response = await apiClient.post(CONTRACT_CENTERS_URL, { data: payload, signal });
  return {
    contractCenter: mapContractCenterFromApi(response),
    raw: response,
  };
}

// Elimina una relacion usando la validacion compartida para IDs.
export async function deleteContractCenter(id, options = {}) {
  ensureId(id, "deleteContractCenter", "id is required");
  const { signal } = options;
  await apiClient.delete(resolveContractCenterUrl(id), { signal });
}
