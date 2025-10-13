import apiClient from "./httpClient.js";
import { mapPatientFromApi, mapPatientsFromApi, mapPatientToApi } from "./patients.js";
import { normaliseListPayload, ensureId } from "./utils.js";
import { apiUrl } from "./routes.js";

const PATIENTS_URL = apiUrl("patients");
const resolvePatientUrl = (patientId) =>
  apiUrl("patients", ensureId(patientId, "resolvePatientUrl", "patientId is required"));

// Lista pacientes aplicando la misma normalizacion para colecciones.
export async function listPatients(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(PATIENTS_URL, { signal, query });
  const rawList = normaliseListPayload(payload);
  return {
    patients: mapPatientsFromApi(rawList),
    raw: payload,
  };
}

// Recupera un paciente especifico del backend.
export async function getPatient(patientId, options = {}) {
  ensureId(patientId, "getPatient", "patientId is required");
  const { signal } = options;
  const payload = await apiClient.get(resolvePatientUrl(patientId), { signal });
  return {
    patient: mapPatientFromApi(payload),
    raw: payload,
  };
}

// Crea un paciente nuevo a partir de los datos normalizados.
export async function createPatient(data, options = {}) {
  const payload = mapPatientToApi(data);
  const { signal } = options;
  const response = await apiClient.post(PATIENTS_URL, {
    data: payload,
    signal,
  });
  return {
    patient: mapPatientFromApi(response),
    raw: response,
  };
}

// Actualiza un paciente reutilizando el mapeo de creacion.
export async function updatePatient(patientId, data, options = {}) {
  const safeId = ensureId(patientId, "updatePatient", "patientId is required");
  const payload = mapPatientToApi(data);
  const { signal } = options;
  const response = await apiClient.patch(resolvePatientUrl(safeId), {
    data: payload,
    signal,
  });
  return {
    patient: mapPatientFromApi(response),
    raw: response,
  };
}

// Elimina un paciente por identificador.
export async function deletePatient(patientId, options = {}) {
  if (patientId === undefined || patientId === null) {
    throw new Error("deletePatient: patientId is required");
  }
  const { signal } = options;
  await apiClient.delete(resolvePatientUrl(patientId), { signal });
}

