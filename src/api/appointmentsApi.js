// Appointments API utilities

import apiClient, { HttpError } from "./httpClient.js";
import { normaliseListPayload, normaliseSinglePayload, ensureId } from "./utils.js";
import { apiUrl } from "./routes.js";

import {
  DEFAULT_PHASES,
  buildAppointmentCreatePayload,
  buildAppointmentUpdatePayload,
  buildPhase1CreatePayload,
  buildPhase1UpdatePayload,
  buildPhase2CreatePayload,
  buildPhase2UpdatePayload,
  buildPhase3CreatePayload,
  buildPhase3UpdatePayload,
  mapAppointmentFromApi,
  mapAppointmentsFromApi,
  mapDoctorTurnosFromApi,
  mapPhase1FromApi,
  mapPhase1ListFromApi,
  mapPhase2FromApi,
  mapPhase2ListFromApi,
  mapPhase3FromApi,
  mapPhase3ListFromApi,
} from "./appointments.js";

import { listContracts } from "./contractsApi.js";
import { listCenters } from "./centersApi.js";
import { listServices } from "./servicesApi.js";
import { listContractCenters } from "./contractCentersApi.js";
import { listServiceContracts } from "./serviceContractsApi.js";
import { listUsers } from "./usersApi.js";

// Paths
const APPOINTMENTS_URL = apiUrl("appointments");
const PHASE1_URL = apiUrl("phase1");
const PHASE2_URL = apiUrl("phase2");
const PHASE3_URL = apiUrl("phase3");
const DOCTOR_TURNOS_URL = apiUrl("doctorTurnos");

// Helpers
const resolveAppointmentUrl = (id) => apiUrl("appointments", ensureId(id, "resolveAppointmentUrl"));
const resolvePhase1Url = (id) => apiUrl("phase1", ensureId(id, "resolvePhase1Url"));
const resolvePhase2Url = (id) => apiUrl("phase2", ensureId(id, "resolvePhase2Url"));
const resolvePhase3Url = (id) => apiUrl("phase3", ensureId(id, "resolvePhase3Url"));

const toId = (v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const toISODate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const mapUsersByRole = (users = [], matcher) => {
  if (!matcher) return [];
  return users.filter((user) => {
    const role = (user.rolNombre ?? "") || (user.rol ?? "");
    return matcher(role.toString().toLowerCase());
  });
};

// -------- Appointments CRUD --------
// Recupera todas las citas disponibles, normalizando la respuesta del backend.
export async function listAppointments(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(APPOINTMENTS_URL, { signal, query });
  return {
    appointments: mapAppointmentsFromApi(normaliseListPayload(payload)),
    raw: payload,
  };
}

// Obtiene las citas asociadas a un paciente puntual reutilizando la lista general.
export async function listAppointmentsByPatient(patientId, options = {}) {
  const { signal } = options;
  const query = patientId ? { pacienteId: patientId } : undefined;
  const { appointments, raw } = await listAppointments({ signal, query });
  if (!patientId) return { appointments, raw };
  const filtered = appointments.filter(
    (item) => String(item.idPaciente ?? item.paciente?.idPaciente) === String(patientId),
  );
  return { appointments: filtered, raw };
}

// Recupera el detalle principal de una cita por identificador.
export async function getAppointment(appointmentId, options = {}) {
  const { signal } = options;
  const response = await apiClient.get(resolveAppointmentUrl(appointmentId), { signal });
  const appointmentPayload = normaliseSinglePayload(response);
  return { appointment: mapAppointmentFromApi(appointmentPayload), raw: response };
}

// Crea una nueva cita asegurando que el payload siga el formato esperado.
export async function createAppointment(data = {}, options = {}) {
  const { signal } = options;

  const payload = {
    pacienteId: toId(data.pacienteId ?? data.idPaciente),
    centroAtencionId: toId(data.centroAtencionId ?? data.idCentroAtencion ?? data.idCentro_Atencion),
    doctorTurnoId: toId(data.doctorTurnoId ?? data.idTurno ?? data.turnoId),
    faseId: toId(data.faseId ?? data.idFase),
    servicioContratoId: toId(data.servicioContratoId ?? data.idServicioContrato),
    fechaReferencia: toISODate(data.fechaReferencia ?? data.fecha_referencia),
    confirmada: Boolean(data.confirmada),
  };

  const medicoReferido = (data.medicoReferido ?? data.medico_referido ?? "").trim();
  if (medicoReferido) {
    payload.medicoReferido = medicoReferido;
  }

  const doctorAsignadoId = toId(data.doctorAsignadoId ?? data.idDoctorAsignado);
  if (doctorAsignadoId) {
    payload.doctorAsignadoId = doctorAsignadoId;
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null) {
      delete payload[key];
    }
  });

  const response = await apiClient.post(APPOINTMENTS_URL, { data: payload, signal });
  const appointmentPayload = normaliseSinglePayload(response);
  return { appointment: mapAppointmentFromApi(appointmentPayload), raw: response };
}


// Actualiza campos de una cita existente respetando el contrato de actualizacion.
export async function updateAppointment(appointmentId, data = {}, options = {}) {
  const { signal } = options;
  const payload = buildAppointmentUpdatePayload(data);
  if (!Object.keys(payload).length) return { appointment: null, raw: null };
  const response = await apiClient.patch(resolveAppointmentUrl(appointmentId), { data: payload, signal });
  const appointmentPayload = normaliseSinglePayload(response);
  return { appointment: mapAppointmentFromApi(appointmentPayload), raw: response };
}

// Elimina una cita por identificador.
export async function deleteAppointment(appointmentId, options = {}) {
  ensureId(appointmentId, "deleteAppointment", "appointmentId is required");
  const { signal } = options;
  await apiClient.delete(resolveAppointmentUrl(appointmentId), { signal });
}

// Confirma una cita usando el endpoint dedicado.
export async function confirmAppointment(appointmentId, options = {}) {
  const safeId = ensureId(appointmentId, "confirmAppointment", "appointmentId is required");
  const { signal } = options;
  const url = apiUrl("appointments", safeId, "confirmar");
  const response = await apiClient.patch(url, { signal });
  const appointmentPayload = normaliseSinglePayload(response);
  return { appointment: mapAppointmentFromApi(appointmentPayload), raw: response };
}

// Cambia la fase asociada a una cita ya existente.
export async function updateAppointmentPhase(appointmentId, phaseId, options = {}) {
  const { signal } = options;
  const payload = buildAppointmentUpdatePayload({ idFase: phaseId, faseId: phaseId });
  if (!Object.keys(payload).length) {
    throw new Error("updateAppointmentPhase: faseId es requerido");
  }
  const response = await apiClient.patch(resolveAppointmentUrl(appointmentId), { data: payload, signal });
  const appointmentPayload = normaliseSinglePayload(response);
  return {
    appointment: mapAppointmentFromApi(appointmentPayload),
    raw: response,
  };
}


// -------- Phases --------
// Lista los registros existentes para la fase 1.
export async function listPhase1(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(PHASE1_URL, { signal, query });
  return { phases: mapPhase1ListFromApi(normaliseListPayload(payload)), raw: payload };
}
// Lista los registros existentes para la fase 2.
export async function listPhase2(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(PHASE2_URL, { signal, query });
  return { phases: mapPhase2ListFromApi(normaliseListPayload(payload)), raw: payload };
}
// Lista los registros existentes para la fase 3.
export async function listPhase3(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(PHASE3_URL, { signal, query });
  return { phases: mapPhase3ListFromApi(normaliseListPayload(payload)), raw: payload };
}

// Obtiene las citas asociadas a un doctor especifico.
export async function listAppointmentsByDoctor(doctorId, options = {}) {
  const safeDoctorId = ensureId(doctorId, "listAppointmentsByDoctor", "doctorId is required");
  const { signal, query } = options;
  const url = apiUrl("appointments", "doctor", safeDoctorId);
  const payload = await apiClient.get(url, { signal, query });
  return {
    appointments: mapAppointmentsFromApi(normaliseListPayload(payload)),
    raw: payload,
  };
}

// Guarda (crea o actualiza) la informacion de fase 1 de una cita.
export async function savePhase1(appointmentId, data, options = {}) {
  const { signal } = options;
  const phaseId = data?.idFase1 ?? data?.faseId ?? data?.id;
  if (phaseId) {
    const payload = buildPhase1UpdatePayload(data);
    if (!Object.keys(payload).length) return { phase: null, raw: null };
    const response = await apiClient.patch(resolvePhase1Url(phaseId), { data: payload, signal });
    return { phase: mapPhase1FromApi(normaliseSinglePayload(response)), raw: response };
  }
  const payload = buildPhase1CreatePayload({ ...data, citaId: appointmentId });
  const response = await apiClient.post(PHASE1_URL, { data: payload, signal });
  return { phase: mapPhase1FromApi(normaliseSinglePayload(response)), raw: response };
}

// Guarda la informacion asociada a la fase 2.
export async function savePhase2(appointmentId, data, options = {}) {
  const { signal } = options;
  const phaseId = data?.idFase2 ?? data?.faseId ?? data?.id;
  if (phaseId) {
    const payload = buildPhase2UpdatePayload(data);
    if (!Object.keys(payload).length) return { phase: null, raw: null };
    const response = await apiClient.patch(resolvePhase2Url(phaseId), { data: payload, signal });
    return { phase: mapPhase2FromApi(normaliseSinglePayload(response)), raw: response };
  }
  const payload = buildPhase2CreatePayload({ ...data, citaId: appointmentId });
  const response = await apiClient.post(PHASE2_URL, { data: payload, signal });
  return { phase: mapPhase2FromApi(normaliseSinglePayload(response)), raw: response };
}

// Guarda la informacion asociada a la fase 3.
export async function savePhase3(appointmentId, data, options = {}) {
  const { signal } = options;
  const phaseId = data?.idFase3 ?? data?.faseId ?? data?.id;
  if (phaseId) {
    const payload = buildPhase3UpdatePayload(data);
    if (!Object.keys(payload).length) return { phase: null, raw: null };
    const response = await apiClient.patch(resolvePhase3Url(phaseId), { data: payload, signal });
    return { phase: mapPhase3FromApi(normaliseSinglePayload(response)), raw: response };
  }
  const payload = buildPhase3CreatePayload({ ...data, citaId: appointmentId });
  const response = await apiClient.post(PHASE3_URL, { data: payload, signal });
  return { phase: mapPhase3FromApi(normaliseSinglePayload(response)), raw: response };
}

// -------- Doctor turnos --------
// Consulta la disponibilidad de turnos para doctores.
export async function listDoctorTurnos(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(DOCTOR_TURNOS_URL, { signal, query });
  return { doctorTurnos: mapDoctorTurnosFromApi(normaliseListPayload(payload)), raw: payload };
}

// -------- Details --------
// Recupera la cita completa junto con sus fases ya cargadas.
export async function getAppointmentDetails(appointmentId, options = {}) {
  const { signal } = options;
  let appointmentPayload = null;
  let appointment = null;
  try {
    appointmentPayload = await apiClient.get(resolveAppointmentUrl(appointmentId), { signal });
    appointment = mapAppointmentFromApi(normaliseSinglePayload(appointmentPayload));
  } catch (error) {
    if (!(error instanceof HttpError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }
  }

  if (!appointment) {
    try {
      const fallback = await apiClient.get(APPOINTMENTS_URL, { signal, query: { id: appointmentId } });
      const items = mapAppointmentsFromApi(normaliseListPayload(fallback));
      appointment = items.find((item) => String(item.idCita) === String(appointmentId)) ?? null;
      appointmentPayload = appointmentPayload ?? fallback;
    } catch (error) {
      if (!(error instanceof HttpError) || (error.status !== 404 && error.status !== 405)) {
        throw error;
      }
    }
  }

  const [phase1Payload, phase2Payload, phase3Payload] = await Promise.all([
    apiClient.get(PHASE1_URL, { signal }).catch((error) => (error instanceof HttpError ? error.response : Promise.reject(error))),
    apiClient.get(PHASE2_URL, { signal }).catch((error) => (error instanceof HttpError ? error.response : Promise.reject(error))),
    apiClient.get(PHASE3_URL, { signal }).catch((error) => (error instanceof HttpError ? error.response : Promise.reject(error))),
  ]);

  const fase1List = mapPhase1ListFromApi(normaliseListPayload(phase1Payload));
  const fase2List = mapPhase2ListFromApi(normaliseListPayload(phase2Payload));
  const fase3List = mapPhase3ListFromApi(normaliseListPayload(phase3Payload));

  const fase1 = fase1List.find((item) => String(item.citaId) === String(appointmentId)) ?? null;
  const fase2 = fase2List.find((item) => String(item.citaId) === String(appointmentId)) ?? null;
  const fase3 = fase3List.find((item) => String(item.citaId) === String(appointmentId)) ?? null;

  return {
    cita: appointment,
    fase1,
    fase2,
    fase3,
    raw: {
      appointment: appointmentPayload,
      fase1: phase1Payload,
      fase2: phase2Payload,
      fase3: phase3Payload,
    },
  };
}

// -------- Catalog --------
function fallbackValueForCatalog(key) {
  switch (key) {
    case "contracts":
      return { contracts: [], raw: null };
    case "centers":
      return { centers: [], raw: null };
    case "services":
      return { services: [], raw: null };
    case "contractCenters":
      return { contractCenters: [], raw: null };
    case "serviceContracts":
      return { serviceContracts: [], raw: null };
    case "users":
      return { users: [], raw: null };
    case "doctorTurnos":
      return [];
    default:
      return null;
  }
}

function shouldFetchCatalog(include, key) {
  if (!include) {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(include, key)) {
    return Boolean(include[key]);
  }
  return true;
}

// Recupera catalogos necesarios para construir formularios de citas.
export async function fetchAppointmentsCatalog(options = {}) {
  const { signal, include } = options;
  const catalogKeys = [
    "contracts",
    "centers",
    "services",
    "contractCenters",
    "serviceContracts",
    "users",
    "doctorTurnos",
  ];

  const tasks = catalogKeys.map((key) => {
    if (!shouldFetchCatalog(include, key)) {
      return Promise.resolve(fallbackValueForCatalog(key));
    }
    switch (key) {
      case "contracts":
        return listContracts({ signal });
      case "centers":
        return listCenters({ signal });
      case "services":
        return listServices({ signal });
      case "contractCenters":
        return listContractCenters({ signal });
      case "serviceContracts":
        return listServiceContracts({ signal });
      case "users":
        return listUsers({ signal });
      case "doctorTurnos":
        return apiClient.get(DOCTOR_TURNOS_URL, { signal });
      default:
        return Promise.resolve(fallbackValueForCatalog(key));
    }
  });

  const settled = await Promise.allSettled(tasks);
  const resolved = settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    const reason = result.reason;
    const key = catalogKeys[index];
    if (reason instanceof HttpError && reason.status === 403) {
      return fallbackValueForCatalog(key);
    }
    throw reason;
  });

  const [
    contractsRes,
    centersRes,
    servicesRes,
    contractCentersRes,
    serviceContractsRes,
    usersRes,
    doctorTurnosPayload,
  ] = resolved;

  const contratos = contractsRes.contracts ?? [];
  const centros = centersRes.centers ?? [];
  const servicios = servicesRes.services ?? servicesRes.servicios ?? [];
  const contractCenters = contractCentersRes.contractCenters ?? [];
  const serviceContracts = serviceContractsRes.serviceContracts ?? [];
  const users = usersRes.users ?? [];
  const doctorTurnos = mapDoctorTurnosFromApi(normaliseListPayload(doctorTurnosPayload));

  const doctores = mapUsersByRole(users, (role) => role.includes("doctor"));
  const licenciadas = mapUsersByRole(users, (role) => role.includes("lic"));

  // contrato-centro
  const contratoCentrosRelations = contractCenters
    .map((relation) => {
      const contratoCentroAtencionId =
        relation.contratoCentroAtencionId ??
        relation.idContratoCentroAtencion ??
        relation.idContratoCentro ??
        relation.contratoCentroId ??
        relation.id ??
        null;
      const idContrato = relation.contratoId ?? relation.idContrato ?? relation.contrato?.id ?? null;
      const idCentro =
        relation.centroId ?? relation.idCentroAtencion ?? relation.idCentro ?? relation.centroAtencion?.id ?? null;
      if (idContrato == null || idCentro == null) return null;
      return {
        idContrato,
        idCentro_Atencion: idCentro,
        contratoCentroAtencionId: contratoCentroAtencionId ?? null,
      };
    })
    .filter(Boolean);

  // index por contratoCentroAtencionId
  const contractCenterById = new Map();
  contratoCentrosRelations.forEach((item) => {
    if (item.contratoCentroAtencionId !== null && item.contratoCentroAtencionId !== undefined) {
      contractCenterById.set(item.contratoCentroAtencionId, {
        idContrato: item.idContrato,
        idCentro_Atencion: item.idCentro_Atencion,
      });
    }
  });

  // contrato+centro <-> servicio
  const contratoServiciosRelations = serviceContracts
    .map((relation) => {
      const contratoCentroAtencionId =
        relation.contratoCentroAtencionId ??
        relation.idContratoCentroAtencion ??
        relation.idContratoCentro ??
        relation.contratoCentroAtencion?.id ??
        null;

      const fromContractCenter =
        contratoCentroAtencionId != null ? contractCenterById.get(contratoCentroAtencionId) : null;

      const idContrato = relation.contratoId ?? relation.idContrato ?? fromContractCenter?.idContrato ?? null;
      const idCentro =
        relation.centroId ??
        relation.idCentroAtencion ??
        relation.idCentro ??
        fromContractCenter?.idCentro_Atencion ??
        null;
      const idServicio = relation.servicioId ?? relation.idServicio ?? relation.servicio?.id ?? null;

      if (idContrato == null || idServicio == null) return null;

      const rawCantidad = relation.cantidad ?? relation.numeroEstudios ?? relation.quantity ?? null;
      const n = Number(rawCantidad);
      const cantidad = Number.isFinite(n) ? n : 0;

      return {
        idServicioContrato: relation.idServicioContrato ?? relation.id ?? relation.servicioContratoId ?? null,
        idContrato,
        idCentro_Atencion: idCentro,
        contratoCentroAtencionId: contratoCentroAtencionId ?? null,
        idServicio,
        cantidad,
      };
    })
    .filter(Boolean);

  return {
    contratos,
    centros,
    servicios,
    fases: DEFAULT_PHASES,
    doctores,
    licenciadas,
    turnos: doctorTurnos,
    relaciones: {
      contrato_centros: contratoCentrosRelations,
      contrato_servicios: contratoServiciosRelations,
    },
  };
}




