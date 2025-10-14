import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

import { HttpError } from "../api/httpClient.js";
import tokenManager from "../api/tokenManager.js";
import { listPatients, updatePatient as updatePatientApi } from "../api/patientsApi.js";

import {
  fetchAppointmentsCatalog,
  listAppointments,
  listAppointmentsByPatient,
  getAppointmentDetails,
  createAppointment as createAppointmentApi,
  updateAppointment as updateAppointmentApi,
  updateAppointmentPhase,
  savePhase1,
  savePhase2,
  savePhase3,
  confirmAppointment as confirmAppointmentApi,
} from "../api/appointmentsApi.js";
import apiClient from "../api/httpClient.js";
import { normaliseListPayload } from "../api/utils.js";

import { apiUrl } from "../api/routes.js"

const TODAY = new Date().toISOString().slice(0, 10);

const DEFAULT_PHASE_FLOW = {
  precita: 1,
  cita: 2,
  registro: 3,
  lectura: 4,
  entrega: 5,
};

const PHASE_LABEL_GROUPS = {
  precita: ["precita", "pre-cita", "pre cita", "fase0", "fase 0", "fase-0"],
  cita: [
    "cita",
    "citas",
    "confirm",
    "confirmar",
    "confirmacion",
    "fase1",
    "fase 1",
    "fase-1",
  ],
  registro: ["registro", "fase2", "fase 2", "fase-2"],
  lectura: ["lectura", "fase3", "fase 3", "fase-3"],
  entrega: ["entrega", "fase4", "fase 4", "fase-4"],
};

const PATIENT_FIELDS = [
  "nombre",
  "apellido",
  "genero",
  "fecha_nacimiento",
  "dui",
  "numero_afiliacion",
  "telefono_fijo",
  "telefono_celular",
];

function normalizeId(value) {
  return value === null || value === undefined ? "" : value.toString();
}

function normalizePatientSnapshot(data) {
  return PATIENT_FIELDS.reduce((acc, field) => {
    const value =
      data && Object.prototype.hasOwnProperty.call(data, field)
        ? data[field]
        : "";
    acc[field] = value === null || value === undefined ? "" : String(value);
    return acc;
  }, {});
}

function toNumericId(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric > 0 ? numeric : null;
}

function sanitizePhaseLabel(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

const PHASE_ALIAS_LOOKUP = (() => {
  const map = new Map();
  Object.entries(PHASE_LABEL_GROUPS).forEach(([key, labels]) => {
    labels.forEach((label) => {
      const normalized = sanitizePhaseLabel(label);
      if (normalized) {
        map.set(normalized, key);
      }
    });
  });
  return map;
})();

function resolvePhaseMappings(phases) {
  const flow = { ...DEFAULT_PHASE_FLOW };
  let precitaId = "";
  if (!Array.isArray(phases)) {
    return { flow, precitaId };
  }
  phases.forEach((phase) => {
    const phaseId = normalizeId(phase?.idFase ?? phase?.id);
    if (!phaseId) {
      return;
    }
    const labels = [
      phase?.nombre,
      phase?.descripcion,
      phase?.descripcionDetallada,
      phase?.detalle,
      phase?.etiqueta,
      phase?.clave,
      phase?.codigo,
      phase?.code,
    ];
    let matchedKey = null;
    for (const candidate of labels) {
      const normalized = sanitizePhaseLabel(candidate);
      if (!normalized) {
        continue;
      }
      if (PHASE_ALIAS_LOOKUP.has(normalized)) {
        matchedKey = PHASE_ALIAS_LOOKUP.get(normalized);
        break;
      }
    }
    if (!matchedKey) {
      return;
    }
    const numericId = Number(phaseId);
    if (matchedKey === "precita") {
      precitaId = phaseId ? phaseId.toString() : precitaId;
      if (
        Object.prototype.hasOwnProperty.call(flow, matchedKey) &&
        Number.isFinite(numericId)
      ) {
        flow[matchedKey] = numericId;
      }
      return;
    }
    if (Object.prototype.hasOwnProperty.call(flow, matchedKey)) {
      if (Number.isFinite(numericId)) {
        flow[matchedKey] = numericId;
      }
    }
  });
  if (!precitaId && Object.prototype.hasOwnProperty.call(flow, "precita")) {
    const numericPrecita = Number(flow.precita);
    precitaId = Number.isFinite(numericPrecita)
      ? numericPrecita.toString()
      : "";
  }
  return { flow, precitaId };
}

function buildServiceNameMap(services) {
  const map = new Map();
  (services ?? []).forEach((item) => {
    const id = normalizeId(item?.idServicio ?? item?.id);
    if (!id) {
      return;
    }
    const label = [
      item?.nombre,
      item?.nombreServicio,
      item?.nombre_servicio,
      item?.descripcion,
      item?.descripcionDetallada,
      item?.detalle,
    ].find((value) => typeof value === "string" && value.trim().length > 0);
    map.set(id, label ? label.trim() : id);
  });
  return map;
}

const ALL_STEPS = [
  { id: "actualizar", label: "Actualizar paciente", required: ["update:patients"] },
  { id: "confirmar", label: "Gestionar precita/cita", required: ["confirm:appointments"] },
  { id: "registro", label: "Registro", required: ["phase:register"] },
  { id: "lectura", label: "Lectura", required: ["phase:read"] },
  { id: "entrega", label: "Entrega", required: ["phase:deliver"] },
];

const emptyPatient = {
  nombre: "",
  apellido: "",
  genero: "",
  fecha_nacimiento: "",
  dui: "",
  numero_afiliacion: "",
  telefono_fijo: "",
  telefono_celular: "",
};

const emptyAppointment = {
  idServicio: "",
  nombreServicio: "",
  idContrato: "",
  idCentro_Atencion: "",
  idFase: null,
  idTurno: "",
  fecha_referencia: TODAY,
  medico_referido: "",
  confirmada: false,
};

const emptyPhase1 = {
  fecha_programada_entrega: "",
  idLic_encargada: "",
};

const emptyPhase2 = {
  idDoctor_Qlee: "",
  birads: "-",
};

const emptyPhase3 = {
  fecha_entrega: "",
  retirada_por_usuario: false,
  nombre: "",
  dui: "",
};

function fullName(item) {
  return [item?.nombre, item?.apellido].filter(Boolean).join(" ");
}

function computeAge(dateString) {
  if (!dateString) return "-";
  const birth = new Date(dateString);
  if (Number.isNaN(birth.getTime())) return "-";
  const diff = Date.now() - birth.getTime();
  return diff > 0 ? Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)) : "-";
}

function formatDateForDisplay(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function parseBiradsPayload(rawValue) {
  if (typeof rawValue !== "string") {
    return { raw: "", birads: "" };
  }
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return { raw: "", birads: "" };
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      const source =
        parsed && typeof parsed.data === "object" ? parsed.data : parsed;
      return {
        raw: rawValue,
        birads: typeof source?.birads === "string" ? source.birads : "",
      };
    } catch (error) {
      return { raw: rawValue, birads: rawValue };
    }
  }
  return { raw: rawValue, birads: rawValue };
}

function serializeBiradsPayload({ type, birads, serviceName }) {
  return JSON.stringify({
    version: 1,
    type,
    serviceName,
    birads: birads ?? "",
  });
}

// Tipado de datos similares a TypeScript (no usados pq me da asco TypeScript)
/**
 * @typedef {Object} AvailableService
 * @property {number} idContrato
 * @property {string} codigoContrato
 * @property {string} nombreServicio
 * @property {number} idServicioContrato
 * @property {?number} idServicio
 * @property {string} label
 */

const toId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveServicioContratoId = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value !== "object") {
    return toId(value);
  }
  const cantidad = toId(
    value.cantidad ?? value.numeroEstudios ?? value.quantity ?? null,
  );
  const candidates = [
    value.idServicioContrato,
    value.servicioContratoId,
    value.idContratoServicio,
    value.contratoServicioId,
    value.id_servicio_contrato,
    value.id,
    value.servicioContrato?.idServicioContrato,
    value.servicioContrato?.id,
    value.contratoServicio?.idServicioContrato,
    value.contratoServicio?.id,
    value.servicio?.idServicioContrato,
  ];
  for (const candidate of candidates) {
    const normalized = toId(candidate);
    if (normalized !== null && normalized !== cantidad) {
      return normalized;
    }
  }
  return null;
};

const pickFirst = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
};

const norm = (s) => String(s ?? "").trim().toLowerCase();

const resolveAppointmentId = (appointment) => {
  if (!appointment || typeof appointment !== "object") {
    return null;
  }
  return pickFirst(
    appointment.idCita,
    appointment.id,
    appointment?.cita?.idCita,
    appointment?.cita?.id,
    appointment?.raw?.idCita,
    appointment?.raw?.id,
  );
};

export default function AppointmentCreate() {
  const navigate = useNavigate();
  const { hasPermission, hasAllPermissions } = useAuth();

  const allowedSteps = useMemo(
    () => ALL_STEPS.filter((step) => hasAllPermissions(step.required ?? [])),
    [hasAllPermissions],
  );

  // Estado local de la vista: paso activo, avisos, catálogos y pacientes, con flags de carga/error/búsqueda/selección/guardado/confirmación e IDs verificados
  const [activeStep, setActiveStep] = useState(() => allowedSteps[0]?.id ?? null);
  const [notice, setNotice] = useState(null);
  const [catalogs, setCatalogs] = useState(null);
  const [catalogsLoading, setCatalogsLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientForm, setPatientForm] = useState(emptyPatient);
  const [patientSaving, setPatientSaving] = useState(false);
  const [patientConfirmed, setPatientConfirmed] = useState(false);
  const [verifiedPatientIds, setVerifiedPatientIds] = useState([]);

  useEffect(() => {
    if (allowedSteps.length === 0) {
      if (activeStep !== null) {
        setActiveStep(null);
      }
      return;
    }
    if (!allowedSteps.some((step) => step.id === activeStep)) {
      setActiveStep(allowedSteps[0]?.id ?? null);
    }
  }, [allowedSteps, activeStep]);

  // Permisos y banderas derivadas: acciones sobre pacientes y citas, fases (register/read/deliver), acceso a datos, deshabilitado de campos, visibilidad de contratos/servicios/centros y necesidad de catálogos
  const canViewPatients = hasPermission("view:patients");
  const canUpdatePatients = hasPermission("update:patients");
  const canCreatePatients = hasPermission("create:patients");
  const canEditPatient = canUpdatePatients || canCreatePatients;
  const canCreateAppointment = hasPermission("create:appointments");
  const canViewAppointments = hasPermission("view:appointments") || canCreateAppointment;
  const canConfirmAppointment = hasPermission("confirm:appointments");
  const canEditAppointmentDetails = canCreateAppointment && canConfirmAppointment;
  const canPhaseRegister = hasPermission("phase:register");
  const canPhaseRead = hasPermission("phase:read");
  const canPhaseDeliver = hasPermission("phase:deliver");
  const canAccessPatientData = canViewPatients || canPhaseRegister || canPhaseRead || canPhaseDeliver;
  const patientFieldsDisabled = !canEditPatient;
  const canViewContracts = hasPermission("view:contracts");
  const canViewServices = hasPermission("view:services");
  const canViewCenters = hasPermission("view:centers");
  const needsSchedulingCatalogs = canCreateAppointment || canConfirmAppointment;
  const needsPhaseCatalogs = canPhaseRegister || canPhaseRead || canPhaseDeliver

  const catalogInclude = useMemo(
    () => ({
      contracts: needsSchedulingCatalogs || canViewContracts,
      centers: needsSchedulingCatalogs || canViewCenters,
      services: needsSchedulingCatalogs || canViewServices,
      contractCenters: needsSchedulingCatalogs || canViewContracts,
      serviceContracts: needsSchedulingCatalogs || canViewContracts,
      users: needsPhaseCatalogs || needsSchedulingCatalogs,
      doctorTurnos: needsSchedulingCatalogs || canViewAppointments,
    }),
    [
      needsSchedulingCatalogs,
      needsPhaseCatalogs,
      canViewContracts,
      canViewCenters,
      canViewServices,
      canViewAppointments,
    ],
  );

  const goToStep = useCallback(
    (stepId) => {
      if (!allowedSteps.length) {
        setActiveStep(null);
        return;
      }
      if (stepId && allowedSteps.some((step) => step.id === stepId)) {
        setActiveStep(stepId);
      } else {
        setActiveStep(allowedSteps[0].id);
      }
    },
    [allowedSteps],
  );

  // Estado de citas y fases: listado/carga, servicios disponibles, selección y detalles, formularios y guardado (cita y fases 1–3), bloqueos/solo lectura por permisos y refs auxiliares
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [availableServices, setAvailableServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectFallbacks, setSelectFallbacks] = useState({
    center: null,
    service: null,
    contract: null,
  });
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [selectedAppointmentDetails, setSelectedAppointmentDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointment);
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [phase1Form, setPhase1Form] = useState(emptyPhase1);
  const [phase1Saving, setPhase1Saving] = useState(false);
  const [phase2Form, setPhase2Form] = useState(emptyPhase2);
  const [phase2Saving, setPhase2Saving] = useState(false);
  const [phase2RawBirads, setPhase2RawBirads] = useState("");
  const [phase3Form, setPhase3Form] = useState(emptyPhase3);
  const [phase3Saving, setPhase3Saving] = useState(false);
  const [appointmentStageLocked, setAppointmentStageLocked] = useState(false);
  const [phase1Locked, setPhase1Locked] = useState(false);
  const [phase2Locked, setPhase2Locked] = useState(false);
  const [phase3Locked, setPhase3Locked] = useState(false);
  const [phaseAccess, setPhaseAccess] = useState({
    lectura: false,
    entrega: false,
  });
  const phase1ReadOnly = phase1Locked || !canPhaseRegister;
  const phase2ReadOnly = phase2Locked || !canPhaseRead;
  const phase3ReadOnly = phase3Locked || !canPhaseDeliver;
  const previousPatientIdRef = useRef(null);
  const loadServiciosAbortRef = useRef(null);

  //Funcion para mostrar cosas
  const notify = useCallback((type, text) => {
    setNotice({ type, text, timestamp: Date.now() });
  }, []);

  const { flow: phaseFlow, precitaId: precitaPhaseId } = useMemo(() => {
    return resolvePhaseMappings(catalogs?.fases);
  }, [catalogs]);

  const defaultPhaseId = useMemo(() => {
    return (
      toNumericId(precitaPhaseId) ??
      toNumericId(phaseFlow?.precita) ??
      1
    );
  }, [precitaPhaseId, phaseFlow]);

  const serviceNameById = useMemo(() => {
    return buildServiceNameMap(catalogs?.servicios ?? []);
  }, [catalogs]);

  const servicesCatalog = useMemo(() => catalogs?.servicios ?? [], [catalogs]);
  const serviceContractIndex = useMemo(() => {
    const relations = catalogs?.relaciones?.contrato_servicios ?? [];
    const index = new Map();
    relations.forEach((relation) => {
      const contractId = toId(
        relation?.idContrato ?? relation?.contratoId ?? relation?.idContratoId,
      );
      const serviceId = toId(
        relation?.idServicio ?? relation?.servicioId ?? relation?.idServicioId,
      );
      const centerId = toId(
        relation?.idCentro_Atencion ??
        relation?.centroId ??
        relation?.idCentro ??
        relation?.centro?.id,
      );
      const servicioContratoId = toId(
        relation?.idServicioContrato ??
        relation?.servicioContratoId ??
        relation?.id,
      );
      if (contractId == null || serviceId == null || servicioContratoId == null) {
        return;
      }
      const cantidad = toId(
        relation?.cantidad ??
        relation?.numeroEstudios ??
        relation?.quantity ??
        null,
      );
      const entry = {
        idServicioContrato: servicioContratoId,
        cantidad,
      };
      const baseKey = `${contractId}:${serviceId}:`;
      if (!index.has(baseKey)) {
        index.set(baseKey, entry);
      }
      if (centerId != null) {
        index.set(`${contractId}:${serviceId}:${centerId}`, entry);
      }
    });
    return index;
  }, [catalogs]);

  // Carga y deja en estado la lista de servicios disponibles para un centro
  const loadServiciosDisponibles = useCallback(
    async (idCentroAtencion) => {
      // Si había una carga en curso, abortarla
      if (loadServiciosAbortRef.current) {
        loadServiciosAbortRef.current.abort();
      }

      // Nuevo AbortController para esta ejecución
      const abortCtrl = new AbortController();
      loadServiciosAbortRef.current = abortCtrl;
      setLoadingServices(true);

      try {
        // Normaliza el id para la URL
        const centerId = toId(idCentroAtencion);
        const idForPath = centerId ?? idCentroAtencion;

        // Uso de apiURL para acceder a las rutas y agregar el endpoint especifico
        const SERVICIOS_DISPONIBLES_URL = apiUrl("filters");

        // Llamada al endpoint con soporte de cancelación
        const resp = await apiClient.get(
          `${SERVICIOS_DISPONIBLES_URL}/servicios-disponibles/${idForPath}`,
          { signal: abortCtrl.signal },
        );

        // Si se abortó, no continuar
        if (abortCtrl.signal.aborted) return [];

        // Acepta múltiples formas de payload y extrae contratos
        const listPayload = normaliseListPayload(resp);
        const contratos =
          listPayload.length > 0 ? listPayload
            : Array.isArray(resp?.data) ? resp.data
              : Array.isArray(resp?.contratos) ? resp.contratos
                : Array.isArray(resp?.data?.contratos) ? resp.data.contratos
                  : Array.isArray(resp) ? resp
                    : [];

        // Mapa nombre normalizado -> idServicio desde el catálogo
        const nombreAId = new Map();
        (servicesCatalog ?? []).forEach((service) => {
          const serviceId = toId(service?.idServicio ?? service?.id);
          if (!serviceId) return;
          const aliases = [
            service?.nombre,
            service?.nombreServicio,
            service?.nombre_servicio,
            service?.descripcion,
            service?.descripcionDetallada,
            service?.detalle,
          ];
          aliases.forEach((alias) => {
            const key = norm(alias);
            if (key) nombreAId.set(key, serviceId);
          });
        });

        // Aplana contratos->servicios y arma opciones enriquecidas
        const flattened = contratos.flatMap((contract) => {
          const contractId = toId(contract?.idContrato ?? contract?.id);
          if (!contractId) return [];
          const codigoContrato = String(contract?.codigoContrato ?? contract?.codigo ?? "");
          const entries = Object.entries(contract?.servicios ?? {});
          if (!entries.length) return [];
          return entries
            .map(([nombreServicio, value]) => {
              const normalizedValue =
                value && typeof value === "object"
                  ? value
                  : { idServicioContrato: value };
              const serviceName = String(nombreServicio ?? "");
              const serviceId =
                nombreAId.get(norm(serviceName)) ??
                toId(
                  normalizedValue.idServicio ??
                  normalizedValue.servicioId ??
                  normalizedValue.servicio?.id ??
                  null,
                );
              const relationKeyWithCenter = `${contractId}:${serviceId ?? ""
                }:${centerId ?? ""}`;
              const relationKeyBase = `${contractId}:${serviceId ?? ""}:`;
              const relationMatch =
                serviceContractIndex.get(relationKeyWithCenter) ??
                serviceContractIndex.get(relationKeyBase) ??
                null;
              const idServicioContrato =
                relationMatch?.idServicioContrato ??
                resolveServicioContratoId(normalizedValue);
              if (!idServicioContrato) return null;
              const cantidad =
                relationMatch?.cantidad ??
                toId(
                  normalizedValue.cantidad ??
                  normalizedValue.numeroEstudios ??
                  normalizedValue.quantity ??
                  null,
                );
              return {
                idContrato: contractId,
                codigoContrato,
                nombreServicio: serviceName,
                idServicioContrato,
                idServicio: serviceId,
                label: `${serviceName} - ${codigoContrato}`,
                cantidad: cantidad ?? null,
              };
            })
            .filter(Boolean);
        });

        if (abortCtrl.signal.aborted) return [];

        // Persistir en estado y devolver
        setAvailableServices(flattened);
        return flattened;
      } catch (error) {
        // Tratar cancelaciones como resultado vacío
        if (
          error?.name === "CanceledError" ||
          error?.name === "AbortError" ||
          abortCtrl.signal.aborted
        ) {
          return [];
        }
        // Error real: limpiar estado y notificar
        setAvailableServices([]);
        await notify("error", "No se pudieron cargar los servicios disponibles.");
        return [];
      } finally {
        // Limpiar ref y flag de carga solo si corresponde a este ciclo
        if (loadServiciosAbortRef.current === abortCtrl) {
          loadServiciosAbortRef.current = null;
          setLoadingServices(false);
        }
      }
    },
    // Dependencias usadas dentro
    [notify, servicesCatalog, serviceContractIndex],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const resetFormsForNewAppointment = useCallback(() => {
    const initialPhaseNumeric = defaultPhaseId;
    setAppointmentForm(() => ({
      ...emptyAppointment,
      idFase: initialPhaseNumeric,
    }));
    setPhase1Form(emptyPhase1);
    setPhase2Form(emptyPhase2);
    setPhase2RawBirads("");
    setPhase3Form(emptyPhase3);
    setAppointmentStageLocked(false);
    setPhase1Locked(false);
    setPhase2Locked(false);
    setPhase3Locked(false);
    setPhaseAccess({
      lectura: false,
      entrega: false,
    });
    setSelectFallbacks({
      center: null,
      service: null,
      contract: null,
    });
  }, [defaultPhaseId]);
  const loadCatalogs = useCallback(async () => {
    setCatalogsLoading(true);
    try {
      const data = await fetchAppointmentsCatalog({ include: catalogInclude });
      setCatalogs(data);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        notify("error", "Tu sesiï¿½n expirï¿½. Inicia sesiï¿½n nuevamente.");
        tokenManager.clear();
        navigate("/login");
        return;
      }
      notify("error", `No se pudieron cargar los catalogos: ${error.message}`);
    } finally {
      setCatalogsLoading(false);
    }
  }, [catalogInclude, navigate, notify]);

  useEffect(() => {
    const rawCentro =
      appointmentForm.idCentro_Atencion ?? appointmentForm.idCentroAtencion;
    const centerIdNumeric = toId(
      typeof rawCentro === "object" ? rawCentro?.value : rawCentro,
    );

    if (!rawCentro) {
      if (loadServiciosAbortRef.current) {
        loadServiciosAbortRef.current.abort();
        loadServiciosAbortRef.current = null;
      }
      setAvailableServices([]);
      setLoadingServices(false);
      setAppointmentForm((prev) => {
        if (!prev.idServicio && !prev.nombreServicio && !prev.idContrato) {
          return prev;
        }
        return {
          ...prev,
          idServicio: "",
          nombreServicio: "",
          idContrato: "",
        };
      });
      return;
    }

    if (!centerIdNumeric) {
      console.debug("Centro invÃ¡lido o sin ID", rawCentro);
      return;
    }

    setAvailableServices([]);
    loadServiciosDisponibles(centerIdNumeric);
  }, [appointmentForm.idCentro_Atencion, loadServiciosDisponibles]);

  useEffect(() => {
    if (!appointmentForm.idContrato || !availableServices?.length) {
      return;
    }
    const currentContratoId = toId(appointmentForm.idContrato);
    const currentServicioId = toId(appointmentForm.idServicio);
    const stillValid = availableServices.some((service) => {
      const serviceContratoId = toId(service?.idContrato);
      if (serviceContratoId !== currentContratoId) {
        return false;
      }
      if (service?.idServicio != null && service.idServicio === currentServicioId) {
        return true;
      }
      return norm(service?.nombreServicio) === norm(appointmentForm.nombreServicio);
    });
    if (!stillValid) {
      setAppointmentForm((prev) => ({
        ...prev,
        idServicio: "",
        nombreServicio: "",
      }));
    }
  }, [
    appointmentForm.idContrato,
    appointmentForm.idServicio,
    appointmentForm.nombreServicio,
    availableServices,
  ]);

  const loadPatients = useCallback(async () => {
    if (!canAccessPatientData) {
      setPatients([]);
      setPatientsError(null);
      return [];
    }
    setPatientsLoading(true);
    try {
      const { patients: list } = await listPatients();
      setPatients(list);
      setPatientsError(null);
      return list;
    } catch (error) {
      const message = error?.message ?? "Error desconocido";
      setPatientsError(message);
      notify("error", `No se pudieron cargar los pacientes: ${message}`);
      setPatients([]);
      return [];
    } finally {
      setPatientsLoading(false);
    }
  }, [canAccessPatientData, notify]);
  const loadAppointments = useCallback(
    async (patientId) => {
      if (!patientId) return [];
      if (!canViewAppointments) {
        setAppointments([]);
        return [];
      }
      setAppointmentsLoading(true);
      try {
        const { appointments: list } =
          await listAppointmentsByPatient(patientId);
        setAppointments(list);
        return list;
      } catch (error) {
        const message = error?.message ?? "Error desconocido";
        notify("error", `No se pudieron cargar las citas: ${message}`);
        setAppointments([]);
        return [];
      } finally {
        setAppointmentsLoading(false);
      }
    },
    [canViewAppointments, notify],
  );
  const updateCitaPhase = useCallback(async (appointmentId, nextPhase) => {
    if (!appointmentId || !nextPhase) return;
    await updateAppointmentPhase(appointmentId, nextPhase);
    setAppointmentForm((prev) => ({
      ...prev,
      idFase: toNumericId(nextPhase) ?? prev.idFase,
    }));
    setSelectedAppointmentDetails((prev) =>
      prev
        ? {
          ...prev,
          cita: {
            ...prev.cita,
            idFase: nextPhase,
          },
        }
        : prev,
    );
    setAppointments((prev) =>
      prev.map((item) =>
        item.idCita === appointmentId ? { ...item, idFase: nextPhase } : item,
      ),
    );
  }, []);
  const loadAppointmentDetails = useCallback(
    async (appointmentId) => {
      if (!appointmentId) {
        setSelectedAppointmentDetails(null);
        resetFormsForNewAppointment();
        setSelectFallbacks({
          center: null,
          service: null,
          contract: null,
        });
        return;
      }
      setDetailsLoading(true);
      setPhaseAccess({
        lectura: false,
        entrega: false,
      });
      try {
        const details = await getAppointmentDetails(appointmentId);
        if (!details || !details.cita) {
          notify("error", "No se pudo cargar la cita seleccionada");
          return;
        }
        setSelectedAppointmentDetails(details);
        const cita = details.cita ?? {};
        const citaRaw = cita.raw ?? {};
        const resolvedId = pickFirst(
          cita.idCita,
          cita.id,
          citaRaw.idCita,
          citaRaw.id,
          appointmentId,
        );
        setAppointments((prev) =>
          prev.map((item) => {
            const itemId = resolveAppointmentId(item);
            const matches =
              (itemId != null && resolvedId != null && toId(itemId) === toId(resolvedId)) ||
              String(itemId ?? "") === String(resolvedId ?? "");
            if (!matches) {
              return item;
            }
            return {
              ...item,
              ...cita,
            };
          }),
        );
        const derivedPhaseNumeric =
          toNumericId(cita.idFase) ??
          toNumericId(precitaPhaseId) ??
          toNumericId(phaseFlow?.precita) ??
          toNumericId(phaseFlow?.cita);
        const normalizedServiceId = normalizeId(
          pickFirst(
            cita.idServicio,
            cita.servicio?.idServicio,
            cita.servicio?.id,
            citaRaw.idServicio,
            citaRaw.servicioId,
          ),
        );
        const serviceNameFromDetails =
          pickFirst(
            serviceNameById.get(normalizedServiceId ?? ""),
            cita.servicio_nombre,
            cita.servicio?.nombre,
            cita.servicio?.nombreServicio,
            cita.servicio?.nombre_servicio,
            cita.servicio?.descripcion,
            cita.nombreServicio,
            citaRaw.servicioNombre,
            citaRaw.nombreServicio,
          ) ??
          "";
        const serviceIdValue = pickFirst(
          cita.idServicio,
          cita.servicio?.idServicio,
          cita.servicio?.id,
          citaRaw.idServicio,
          citaRaw.servicioId,
        );
        const servicioContratoId = pickFirst(
          cita.servicioContratoId,
          cita.idServicioContrato,
          cita.servicio?.idServicioContrato,
          cita.servicio?.servicioContratoId,
          citaRaw.servicioContratoId,
          citaRaw.idServicioContrato,
        );
        const contractIdRaw = pickFirst(
          cita.idContrato,
          cita.contrato?.idContrato,
          cita.contrato?.id,
          citaRaw.idContrato,
          citaRaw.contratoId,
        );
        const contractCode = pickFirst(
          cita.contrato?.codigoContrato,
          cita.contrato?.codigo,
          cita.contrato_nombre,
          citaRaw.codigoContrato,
          citaRaw.contractCode,
          citaRaw.contratoCodigo,
        );
        const centroIdRaw = pickFirst(
          cita.idCentro_Atencion,
          cita.idCentroAtencion,
          cita.centroAtencionId,
          cita.centro?.idCentro_Atencion,
          cita.centro?.idCentroAtencion,
          cita.centro?.idCentro,
          cita.centro?.id,
          citaRaw.idCentroAtencion,
          citaRaw.centroId,
          citaRaw.centroAtencionId,
        );
        const centroNombre = pickFirst(
          cita.centro_nombre,
          cita.centro?.nombre,
          cita.centro?.descripcion,
          cita.centro?.nombreCentro,
          cita.centro?.nombreCentroAtencion,
          citaRaw.centroNombre,
          citaRaw.nombreCentro,
          citaRaw.centroDescripcion,
          citaRaw.nombreCentroAtencion,
          citaRaw.centroTitulo,
        );
        const serviceFallbackEntry = {
          idContrato: toId(contractIdRaw),
          codigoContrato: contractCode ?? (contractIdRaw != null ? `Contrato ${contractIdRaw}` : "Contrato"),
          nombreServicio: serviceNameFromDetails || "Servicio",
          idServicioContrato: toId(servicioContratoId),
          idServicio: toId(serviceIdValue),
          label: `${serviceNameFromDetails || "Servicio"} - ${contractCode || contractIdRaw || "Contrato"}`,
          cantidad: null,
        };
        setAvailableServices((prev) => {
          if (!serviceFallbackEntry.idContrato && !serviceFallbackEntry.idServicioContrato) {
            return prev;
          }
          const alreadyExists = (prev ?? []).some((item) => {
            const sameContract =
              toId(item.idContrato) === toId(serviceFallbackEntry.idContrato);
            const sameService =
              toId(item.idServicio) === toId(serviceFallbackEntry.idServicio) &&
              norm(item.nombreServicio) === norm(serviceFallbackEntry.nombreServicio);
            const sameContratoServicio =
              toId(item.idServicioContrato) === toId(serviceFallbackEntry.idServicioContrato);
            return (
              (sameContract && sameService) ||
              (sameContract && sameContratoServicio) ||
              sameContratoServicio
            );
          });
          if (alreadyExists) {
            return prev;
          }
          return [...(prev ?? []), serviceFallbackEntry];
        });
        const serviceValue =
          serviceIdValue != null
            ? String(toId(serviceIdValue))
            : serviceNameFromDetails
              ? String(serviceNameFromDetails)
              : "";
        const turnoIdRaw = pickFirst(
          cita.idTurno,
          cita.doctorTurno?.idTurno,
          citaRaw.idTurno,
          citaRaw.turnoId,
        );
        const fechaReferencia = pickFirst(
          cita.fecha_referencia,
          cita.fechaReferencia,
          citaRaw.fechaReferencia,
        ) ?? TODAY;
        const medicoReferido = pickFirst(
          cita.medico_referido,
          cita.medicoReferido,
          citaRaw.medicoReferido,
        ) ?? "";
        setSelectFallbacks({
          center:
            centroIdRaw != null
              ? {
                value: String(centroIdRaw),
                label: centroNombre || `Centro ${centroIdRaw}`,
              }
              : null,
          service:
            serviceValue
              ? {
                value: serviceValue,
                label: serviceNameFromDetails || serviceValue,
                servicioContratoId: toId(servicioContratoId),
              }
              : null,
          contract:
            contractIdRaw != null
              ? {
                value: String(contractIdRaw),
                label: contractCode || `Contrato ${contractIdRaw}`,
              }
              : null,
        });
        setAppointmentForm({
          idServicio: serviceValue,
          nombreServicio: serviceNameFromDetails,
          idContrato: contractIdRaw != null ? String(contractIdRaw) : "",
          idCentro_Atencion: centroIdRaw != null ? String(centroIdRaw) : "",
          idFase: derivedPhaseNumeric,
          idTurno: turnoIdRaw != null ? String(turnoIdRaw) : "",
          fecha_referencia: fechaReferencia,
          medico_referido: medicoReferido,
          confirmada: Boolean(cita.confirmada),
        });
        const fase1 = details.fase1 ?? {};
        setPhase1Form({
          fecha_programada_entrega:
            fase1.fecha_programada_entrega ?? fase1.fecha_entrega ?? "",
          idLic_encargada: fase1.idLic_encargada
            ? fase1.idLic_encargada.toString()
            : "",
        });
        const fase2 = details.fase2 ?? {};
        const parsedBirads = parseBiradsPayload(fase2.birads ?? "");
        setPhase2RawBirads(parsedBirads.raw ?? "");
        setPhase2Form({
          idDoctor_Qlee: fase2.idDoctor_Qlee
            ? fase2.idDoctor_Qlee.toString()
            : "",
          birads: parsedBirads.birads ?? "",
        });
        const fase3 = details.fase3 ?? {};
        setPhase3Form({
          fecha_entrega: fase3.fecha_entrega ?? "",
          retirada_por_usuario: Boolean(fase3.retirada_por_usuario),
          nombre: fase3.nombre ?? "",
          dui: fase3.dui ?? "",
        });
        const phaseValue =
          toNumericId(
            pickFirst(
              cita.idFase,
              cita.fase?.idFase,
              citaRaw.idFase,
              citaRaw.faseId,
            ),
          ) ?? 0;
        const fase1HasData = Boolean(
          fase1 &&
          (fase1.fecha_programada_entrega ||
            fase1.fecha_entrega ||
            fase1.idLic_encargada),
        );
        const fase2HasData = Boolean(
          fase2 &&
          (fase2.idDoctor_Qlee || parsedBirads.raw || parsedBirads.birads),
        );
        const fase3HasData = Boolean(
          fase3 &&
          (fase3.fecha_entrega ||
            fase3.retirada_por_usuario ||
            fase3.nombre ||
            fase3.dui),
        );
        const appointmentAlreadyConfirmed = Boolean(
          cita.confirmada === 1 ||
          cita.confirmada === true ||
          cita.confirmada === "1",
        );
        const reachedRegistro = phaseValue >= phaseFlow.registro;
        const reachedLectura = phaseValue >= phaseFlow.lectura;
        const reachedEntrega = phaseValue >= phaseFlow.entrega;
        const canAccessLectura =
          appointmentAlreadyConfirmed || reachedRegistro || fase1HasData;
        const canAccessEntrega =
          appointmentAlreadyConfirmed || reachedLectura || fase2HasData;
        setAppointmentStageLocked(reachedRegistro);
        setPhase1Locked(reachedRegistro || fase1HasData);
        setPhase2Locked(!canAccessLectura || fase2HasData);
        setPhase3Locked(!canAccessEntrega || fase3HasData);
        setPhaseAccess({
          lectura: canAccessLectura,
          entrega: canAccessEntrega,
        });
      } catch (error) {
        notify("error", `No se pudo cargar la cita: ${error.message}`);
      } finally {
        setDetailsLoading(false);
      }
    },
    [notify, resetFormsForNewAppointment, phaseFlow, precitaPhaseId, serviceNameById],
  );
  useEffect(() => {
    loadCatalogs();
    if (canAccessPatientData) {
      loadPatients();
    } else {
      setPatients([]);
    }
  }, [canAccessPatientData, loadCatalogs, loadPatients]);
  useEffect(() => {
    if (!selectedPatientId) {
      setPatientForm(emptyPatient);
      setPatientConfirmed(false);
      goToStep();
      setAppointments([]);
      setSelectedAppointmentId(null);
      setSelectedAppointmentDetails(null);
      resetFormsForNewAppointment();
      previousPatientIdRef.current = null;
      return;
    }
    const current = patients.find((p) => p.idPaciente === selectedPatientId);
    if (current) {
      setPatientForm({
        nombre: current.nombre ?? "",
        apellido: current.apellido ?? "",
        genero: current.genero ?? "",
        fecha_nacimiento: current.fecha_nacimiento ?? "",
        dui: current.dui ?? "",
        numero_afiliacion: current.numero_afiliacion ?? "",
        telefono_fijo: current.telefono_fijo ?? "",
        telefono_celular: current.telefono_celular ?? "",
      });
    }
    const numericId = Number(selectedPatientId);
    const wasVerified = verifiedPatientIds.includes(numericId);
    if (previousPatientIdRef.current !== selectedPatientId) {
      setPatientConfirmed(wasVerified);
      goToStep(wasVerified ? "confirmar" : null);
    } else if (wasVerified && !patientConfirmed) {
      setPatientConfirmed(true);
    }
    previousPatientIdRef.current = selectedPatientId;
    loadAppointments(selectedPatientId).then((list) => {
      if (
        selectedAppointmentId &&
        !list.some((item) => item.idCita === selectedAppointmentId)
      ) {
        setSelectedAppointmentId(null);
        setSelectedAppointmentDetails(null);
        resetFormsForNewAppointment();
      }
    });
  }, [
    selectedPatientId,
    patients,
    verifiedPatientIds,
    loadAppointments,
    selectedAppointmentId,
    resetFormsForNewAppointment,
    patientConfirmed,
  ]);
  useEffect(() => {
    if (!selectedAppointmentId) return;
    loadAppointmentDetails(selectedAppointmentId);
  }, [selectedAppointmentId, loadAppointmentDetails]);
  const centroOptionsBase = useMemo(() => {
    const items = catalogs?.centros ?? [];
    const seen = new Set();
    return items
      .map((item) => {
        const value = normalizeId(
          item?.idCentro_Atencion ?? item?.idCentroA ?? item?.idCentro,
        );
        if (!value) {
          return null;
        }
        if (seen.has(value)) {
          return null;
        }
        seen.add(value);
        return { value, label: item?.nombre ?? "" };
      })
      .filter(Boolean);
  }, [catalogs]);

  const centroOptions = useMemo(() => {
    const base = [...centroOptionsBase];
    const fallback = selectFallbacks.center;
    if (fallback && fallback.value) {
      const existingIndex = base.findIndex(
        (option) => String(option.value) === String(fallback.value),
      );
      if (existingIndex >= 0) {
        const current = base[existingIndex];
        if (!current.label && fallback.label) {
          base[existingIndex] = { ...current, label: fallback.label };
        }
      } else {
        base.push(fallback);
      }
    }
    return base;
  }, [centroOptionsBase, selectFallbacks.center]);

  const servicioOptionsBase = useMemo(() => {
    if (!appointmentForm.idCentro_Atencion) {
      return [];
    }
    const seen = new Set();
    return (availableServices ?? [])
      .filter((row) => row?.nombreServicio)
      .map((row) => {
        const numericId = toId(row.idServicio);
        return {
          value:
            numericId != null ? String(numericId) : String(row.nombreServicio),
          label: row.nombreServicio,
          nombre: row.nombreServicio,
          servicioContratoId: row.idServicioContrato,
        };
      })
      .filter((option) => {
        if (!option.label) {
          return false;
        }
        const key = `${option.value ?? ""}-${norm(option.nombre)}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }, [appointmentForm.idCentro_Atencion, availableServices]);

  const servicioOptions = useMemo(() => {
    const base = servicioOptionsBase;
    const fallback = selectFallbacks.service;
    if (
      fallback &&
      fallback.value &&
      !base.some(
        (option) =>
          String(option.value) === String(fallback.value) ||
          (fallback.servicioContratoId != null &&
            option.servicioContratoId != null &&
            toId(option.servicioContratoId) === toId(fallback.servicioContratoId)),
      )
    ) {
      return [...base, fallback];
    }
    return base;
  }, [servicioOptionsBase, selectFallbacks.service]);

  const contratoOptionsBase = useMemo(() => {
    if (!appointmentForm.idCentro_Atencion) {
      return [];
    }
    const n = (value) => String(value ?? "").trim().toLowerCase();
    const wantedServicioId = toId(appointmentForm.idServicio);
    const wantedNombre = n(appointmentForm.nombreServicio);
    if (wantedServicioId == null && !wantedNombre) {
      return [];
    }
    const rows = (availableServices ?? []).filter((row) => {
      const rowId = toId(row?.idServicio);
      const rowNombre = n(row?.nombreServicio);
      return (rowId != null && rowId === wantedServicioId) ||
        rowNombre === wantedNombre;
    });
    return rows
      .filter((row) => row?.idContrato != null)
      .map((row) => ({
        value: String(row.idContrato),
        label: row.codigoContrato,
      }));
  }, [
    appointmentForm.idCentro_Atencion,
    appointmentForm.idServicio,
    appointmentForm.nombreServicio,
    availableServices,
  ]);

  const contratoOptions = useMemo(() => {
    const base = contratoOptionsBase;
    const fallback = selectFallbacks.contract;
    if (
      fallback &&
      fallback.value &&
      !base.some((option) => String(option.value) === String(fallback.value))
    ) {
      return [...base, fallback];
    }
    return base;
  }, [contratoOptionsBase, selectFallbacks.contract]);

  useEffect(() => {
    if (loadingServices) {
      return;
    }
    const hasServicio = Boolean(appointmentForm.idServicio);
    const hasNombre = Boolean(norm(appointmentForm.nombreServicio));
    if (!hasServicio && !hasNombre) {
      if (appointmentForm.idContrato) {
        setAppointmentForm((prev) => ({
          ...prev,
          idContrato: "",
        }));
      }
      return;
    }
    if (
      appointmentForm.idContrato &&
      !contratoOptions.some(
        (option) => String(option.value) === String(appointmentForm.idContrato),
      )
    ) {
      setAppointmentForm((prev) => ({
        ...prev,
        idContrato: "",
      }));
    }
  }, [
    appointmentForm.idContrato,
    appointmentForm.idServicio,
    appointmentForm.nombreServicio,
    contratoOptions,
    loadingServices,
  ]);

  useEffect(() => {
    if (loadingServices) {
      return;
    }
    if (appointmentForm.idContrato) {
      return;
    }
    if (contratoOptions.length === 1) {
      const single = contratoOptions[0];
      if (single?.value !== undefined && single?.value !== null) {
        setAppointmentForm((prev) => ({
          ...prev,
          idContrato: String(single.value),
        }));
      }
    }
  }, [contratoOptions, appointmentForm.idContrato, loadingServices]);

  const filteredPatients = useMemo(() => {
    const query = patientSearch.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((p) => {
      const full = `${p.nombre ?? ""} ${p.apellido ?? ""}`.toLowerCase();
      return (
        full.includes(query) || (p.dui ?? "").toLowerCase().includes(query)
      );
    });
  }, [patientSearch, patients]);
  const normalizedServiceId = normalizeId(appointmentForm.idServicio);
  const selectOptions = useMemo(() => {
    const faseItems = catalogs?.fases ?? [];
    const doctorItems = catalogs?.doctores ?? [];
    const turnoItems = catalogs?.turnos ?? [];
    const rawLicenciadas = catalogs?.licenciadas ?? [];
    const filteredLicenciadas = rawLicenciadas.filter((item) => {
      const rol = typeof item?.rol === "string" ? item.rol.toLowerCase() : "";
      return rol.includes("lic");
    });
    const licenciadasSource = filteredLicenciadas.length
      ? filteredLicenciadas
      : rawLicenciadas;

    const fases = faseItems.map((item) => ({
      value: normalizeId(item?.idFase),
      label: item?.nombre ?? "",
    }));
    const doctores = doctorItems.map((item) => ({
      value: normalizeId(item?.idDoctor ?? item?.idUsuario),
      label: `${item?.nombre ?? ""} ${item?.apellido ?? ""}`.trim(),
    }));
    const licenciadas = licenciadasSource.map((item) => ({
      value: normalizeId(item?.idLicenciada ?? item?.idUsuario),
      label: `${item?.nombre ?? ""} ${item?.apellido ?? ""}`.trim(),
    }));
    const turnos = turnoItems.map((item) => ({
      value: normalizeId(item?.idTurno),
      label: `${item?.fecha ?? ""} ${item?.hora ?? ""}`.trim(),
    }));

    return {
      fases,
      doctores,
      licenciadas,
      turnos,
    };
  }, [catalogs]);

  const currentPatient = selectedPatientId
    ? patients.find((p) => p.idPaciente === selectedPatientId)
    : null;
  const patientBaseline = useMemo(
    () => normalizePatientSnapshot(currentPatient),
    [currentPatient],
  );
  const normalizedPatientForm = useMemo(
    () => normalizePatientSnapshot(patientForm),
    [patientForm],
  );
  const patientHasChanges = useMemo(() => {
    if (!selectedPatientId) {
      return false;
    }
    return PATIENT_FIELDS.some(
      (field) => normalizedPatientForm[field] !== patientBaseline[field],
    );
  }, [normalizedPatientForm, patientBaseline, selectedPatientId]);
  const currentCita = selectedAppointmentDetails?.cita ?? null;
  const appointmentConfirmed = currentCita
    ? currentCita.confirmada === 1 || currentCita.confirmada === true
    : appointmentForm.confirmada;
  const appointmentFinalized =
    (selectedAppointmentDetails?.cita?.idFase ?? 0) >= phaseFlow.entrega;
  const appointmentLocked = Boolean(
    appointmentFinalized ||
    appointmentStageLocked ||
    (selectedAppointmentId ? appointmentConfirmed : false),
  );
  const selectedServiceOption = useMemo(() => {
    if (!servicioOptions.length) {
      return null;
    }
    if (appointmentForm.idServicio) {
      const matchById = servicioOptions.find(
        (option) => option.value === appointmentForm.idServicio,
      );
      if (matchById) {
        return matchById;
      }
    }
    if (appointmentForm.nombreServicio) {
      const targetName = norm(appointmentForm.nombreServicio);
      return (
        servicioOptions.find(
          (option) => norm(option.nombre) === targetName,
        ) ?? null
      );
    }
    return null;
  }, [servicioOptions, appointmentForm.idServicio, appointmentForm.nombreServicio]);
  const selectedServiceName = useMemo(() => {
    if (currentCita?.servicio_nombre) {
      return currentCita.servicio_nombre;
    }
    if (selectedServiceOption?.nombre) {
      return selectedServiceOption.nombre;
    }
    if (appointmentForm.nombreServicio) {
      return appointmentForm.nombreServicio;
    }
    if (normalizedServiceId) {
      return serviceNameById.get(normalizedServiceId) ?? normalizedServiceId;
    }
    return "";
  }, [
    currentCita,
    selectedServiceOption,
    serviceNameById,
    normalizedServiceId,
    appointmentForm.nombreServicio,
  ]);
  const serviceAvailabilityMessage = useMemo(() => {
    if (loadingServices) {
      return "Calculando disponibilidad...";
    }
    return "";
  }, [loadingServices]);
  const serviceAvailabilityTone = "text-gray-500";
  const normalizedServiceKey = useMemo(() => {
    if (!selectedServiceName || typeof selectedServiceName !== "string") {
      return "";
    }
    try {
      return selectedServiceName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    } catch (error) {
      return selectedServiceName.toLowerCase();
    }
  }, [selectedServiceName]);
  const lecturaConfig = useMemo(() => {
    if (!normalizedServiceKey) {
      return { type: "general" };
    }
    if (normalizedServiceKey.includes("mam")) {
      return { type: "mamografia" };
    }
    if (normalizedServiceKey.includes("ultra")) {
      return { type: "ultrasonido" };
    }
    if (
      normalizedServiceKey.includes("rayos") ||
      normalizedServiceKey.includes("rx")
    ) {
      return { type: "rayosx" };
    }
    if (normalizedServiceKey.includes("resonancia")) {
      return { type: "resonancia" };
    }
    if (normalizedServiceKey.includes("tomografia")) {
      return { type: "tomografia" };
    }
    return { type: "general" };
  }, [normalizedServiceKey]);
  const showBiradsField = lecturaConfig.type === "mamografia";
  useEffect(() => {
    setPhase2Form((prev) => {
      if (!showBiradsField && prev.birads !== "-") {
        return { ...prev, birads: "-" };
      }
      if (showBiradsField && prev.birads === "-") {
        return { ...prev, birads: "" };
      }
      return prev;
    });
  }, [showBiradsField]);
  useEffect(() => {
    if (!selectedAppointmentId) return;
    if (appointmentsLoading || appointmentSaving) return;
    const selectedNumeric = toId(selectedAppointmentId);
    const hasMatch = appointments.some((item) => {
      const itemId = toId(item?.idCita ?? item?.id);
      if (itemId == null || selectedNumeric == null) {
        return String(item?.idCita ?? item?.id) === String(selectedAppointmentId);
      }
      return itemId === selectedNumeric;
    });
    if (hasMatch)
      return;
    setSelectedAppointmentId(null);
    setSelectedAppointmentDetails(null);
    resetFormsForNewAppointment();
  }, [
    appointments,
    selectedAppointmentId,
    appointmentsLoading,
    appointmentSaving,
    resetFormsForNewAppointment,
  ]);
  const handlePatientSubmit = async (event) => {
    event.preventDefault();
    if (!selectedPatientId) return;
    if (!canEditPatient) return;
    if (!patientHasChanges) return;
    const normalizedPatientId = String(selectedPatientId).trim();
    const updatePayload = {
      idPaciente: normalizedPatientId,
      apellido: (patientForm.apellido ?? "").trim(),
      dui: (patientForm.dui ?? "").trim(),
      fecha_nacimiento: patientForm.fecha_nacimiento ?? "",
      genero: patientForm.genero ?? "",
      nombre: (patientForm.nombre ?? "").trim(),
      numero_afiliacion: (patientForm.numero_afiliacion ?? "").trim(),
      telefono_celular: (patientForm.telefono_celular ?? "").trim(),
      telefono_fijo: (patientForm.telefono_fijo ?? "").trim(),
    };
    setPatientSaving(true);
    try {
      const { patient: updatedPatient } = await updatePatientApi(
        normalizedPatientId,
        updatePayload,
      );
      const normalized = updatedPatient ?? updatePayload;
      const nextPatient = {
        ...normalizePatientSnapshot({
          ...normalized,
          idPaciente: normalized.idPaciente ?? normalizedPatientId,
        }),
        idPaciente: normalized.idPaciente ?? normalizedPatientId,
      };
      notify("success", "Datos del paciente actualizados");
      setPatientConfirmed(true);
      setVerifiedPatientIds((prev) => {
        const numericId = Number(selectedPatientId);
        return prev.includes(numericId) ? prev : [...prev, numericId];
      });
      goToStep("confirmar");
      setPatients((prev) =>
        prev.map((item) =>
          String(item.idPaciente) === String(selectedPatientId)
            ? { ...item, ...nextPatient }
            : item,
        ),
      );
    } catch (error) {
      notify("error", `No se pudo actualizar el paciente: ${error.message}`);
    } finally {
      setPatientSaving(false);
    }
  };
  const handleAppointmentSubmit = async (event) => {
    event.preventDefault();
    if (!canEditAppointmentDetails) {
      return;
    }
    if (appointmentSaving) {
      return;
    }
    if (!selectedPatientId) {
      await notify("error", "Selecciona un paciente primero");
      return;
    }
    if (!appointmentForm.idCentro_Atencion) {
      await notify("error", "Selecciona un Centro de Atencion.");
      setAppointmentSaving(false);
      return;
    }
    if (!appointmentForm.idServicio && !appointmentForm.nombreServicio) {
      await notify("error", "Selecciona un servicio.");
      setAppointmentSaving(false);
      return;
    }
    const currentPhaseNumeric = toNumericId(currentCita?.idFase);
    const precitaPhaseNumeric = toNumericId(precitaPhaseId);
    const selectedPhaseNumeric = toNumericId(appointmentForm.idFase);
    const defaultPrecitaNumeric =
      toNumericId(phaseFlow?.precita) ?? toNumericId(phaseFlow?.cita);
    const basePhaseNumeric =
      selectedPhaseNumeric ??
      currentPhaseNumeric ??
      precitaPhaseNumeric ??
      defaultPrecitaNumeric;
    if (!Number.isFinite(basePhaseNumeric)) {
      await notify("error", "No se pudo determinar la fase Precita");
      return;
    }
    const confirming = Boolean(appointmentForm.confirmada);
    const wasPreviouslyConfirmed = Boolean(
      currentCita &&
      (currentCita.confirmada === 1 ||
        currentCita.confirmada === true ||
        currentCita.confirmada === "1"),
    );
    let resolvedPhaseNumeric = basePhaseNumeric;
    if (confirming) {
      const minimumPhase = toNumericId(phaseFlow.cita);
      if (Number.isFinite(minimumPhase) && resolvedPhaseNumeric < minimumPhase) {
        resolvedPhaseNumeric = minimumPhase;
      }
    }
    if (!Number.isFinite(resolvedPhaseNumeric)) {
      await notify("error", "No se pudo determinar la fase Precita");
      return;
    }
    if (appointmentForm.idFase !== resolvedPhaseNumeric) {
      setAppointmentForm((prev) => ({
        ...prev,
        idFase: resolvedPhaseNumeric,
      }));
    }
    setAppointmentSaving(true);
    const wasExisting = Boolean(selectedAppointmentId);
    try {
      const medicoReferido = (appointmentForm.medico_referido ?? "").trim();
      const fechaReferencia = appointmentForm.fecha_referencia ?? null;
      const requestPayload = {
        pacienteId: toNumericId(selectedPatientId),
        centroAtencionId: toNumericId(appointmentForm.idCentro_Atencion),
        doctorTurnoId: toNumericId(appointmentForm.idTurno),
        faseId: resolvedPhaseNumeric,
        fechaReferencia,
        confirmada: Boolean(appointmentForm.confirmada),
      };

      const wantedServicioId = toId(appointmentForm.idServicio);
      const wantedContratoId = toId(appointmentForm.idContrato);

      const matches = (availableServices ?? []).filter(
        (r) =>
          (r.idServicio != null && r.idServicio === wantedServicioId) ||
          norm(r.nombreServicio) === norm(appointmentForm.nombreServicio),
      );

      if (!wantedContratoId && matches.length > 1) {
        await notify("error", "Este servicio esta en varios contratos. Selecciona un contrato.");
        setAppointmentSaving(false);
        return;
      }

      let serviceMatch =
        matches.find(
          (r) =>
            wantedContratoId &&
            r.idContrato === wantedContratoId &&
            ((r.idServicio != null && r.idServicio === wantedServicioId) ||
              norm(r.nombreServicio) === norm(appointmentForm.nombreServicio)),
        ) ??
        matches.find(
          (r) => r.idServicio != null && r.idServicio === wantedServicioId,
        ) ??
        matches.find(
          (r) => norm(r.nombreServicio) === norm(appointmentForm.nombreServicio),
        );

      const servicioContratoId =
        serviceMatch?.idServicioContrato ??
        serviceMatch?.servicioContratoId ??
        serviceMatch?.id;
      const normalizedServicioContratoId = toId(servicioContratoId);
      if (normalizedServicioContratoId == null) {
        await notify("error", "No se pudo determinar el servicio contratado seleccionado.");
        setAppointmentSaving(false);
        return;
      }

      requestPayload.servicioContratoId = normalizedServicioContratoId;

      if (medicoReferido && String(medicoReferido).trim()) {
        requestPayload.medicoReferido = String(medicoReferido).trim();
      }

      if (appointmentForm.doctorAsignadoId != null) {
        requestPayload.doctorAsignadoId = toId(appointmentForm.doctorAsignadoId);
      }

      const payloadEntries = Object.entries(requestPayload).reduce(
        (acc, [key, value]) => {
          if (value === undefined || value === null) {
            return acc;
          }
          if (typeof value === "number") {
            if (!Number.isFinite(value)) {
              return acc;
            }
          }
          if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) {
              return acc;
            }
            acc[key] = trimmed;
            return acc;
          }
          acc[key] = value;
          return acc;
        },
        {},
      );

      console.debug("Appointment payload", payloadEntries);

      let targetId = toId(selectedAppointmentId) ?? selectedAppointmentId ?? null;

      if (wasExisting && targetId != null) {
        try {
          await updateAppointmentApi(targetId, payloadEntries);
        } catch (error) {
          console.error("Update appointment failed", {
            payload: payloadEntries,
            targetId,
            error,
            response: error?.response ?? null,
          });
          throw error;
        }
      } else {
        console.debug("Creating appointment with payload", payloadEntries);
        let createdResp;
        try {
          createdResp = await createAppointmentApi(payloadEntries);
        } catch (error) {
          console.error("Create appointment failed", {
            payload: payloadEntries,
            error,
            response: error?.response ?? null,
          });
          throw error;
        }
        const created = createdResp?.appointment ?? createdResp ?? null;
        targetId = toId(created?.idCita ?? created?.id ?? null);
        if (!targetId) {
          throw new Error("No se pudo determinar la cita creada por el backend.");
        }
        setSelectedAppointmentId(targetId);
      }

      if (!targetId) {
        throw new Error("No se pudo determinar la cita para actualizar.");
      }

      const shouldConfirmAfterSave = confirming && !wasPreviouslyConfirmed;
      if (shouldConfirmAfterSave) {
        try {
          await confirmAppointmentApi(targetId);
        } catch (error) {
          console.error("Confirm appointment failed", {
            targetId,
            error,
            response: error?.response ?? null,
          });
          throw error;
        }
      }

      await notify("success", wasExisting ? "Cita actualizada" : "Cita creada");

      const list = await loadAppointments(selectedPatientId);
      if (
        targetId &&
        !list?.some?.((item) => toId(item?.idCita) === toId(targetId))
      ) {
        setAppointments((prev) => [...prev, { idCita: targetId }]);
      }
      await loadAppointmentDetails(targetId);

    } catch (error) {
      const backendMessage =
        error?.response?.data?.message ??
        error?.payload?.message ??
        error?.message ??
        "Error desconocido";
      console.error("Save appointment failed", { error, apiMessage: backendMessage });
      await notify("error", `No se pudo guardar la cita: ${backendMessage}`);
    } finally {
      setAppointmentSaving(false);
    }
  };
  const handlePhase1Submit = async (event) => {
    event.preventDefault();
    if (!canPhaseRegister) {
      return;
    }
    if (!selectedAppointmentId) {
      notify("error", "Selecciona una cita");
      return;
    }
    setPhase1Saving(true);
    try {
      await savePhase1(selectedAppointmentId, {
        idFase1: selectedAppointmentDetails?.fase1?.idFase1,
        idLic_encargada: phase1Form.idLic_encargada || null,
        fecha_programada_entrega: phase1Form.fecha_programada_entrega || null,
      });
      await updateCitaPhase(selectedAppointmentId, phaseFlow.registro);
      setPhase1Locked(true);
      notify("success", "Registro actualizado");
      await loadAppointmentDetails(selectedAppointmentId);
    } catch (error) {
      notify("error", `No se pudo guardar el registro: ${error.message}`);
    } finally {
      setPhase1Saving(false);
    }
  };
  const handlePhase2Submit = async (event) => {
    event.preventDefault();
    if (!canPhaseRead) {
      return;
    }
    if (!selectedAppointmentId) {
      notify("error", "Selecciona una cita");
      return;
    }
    if (!phase2Form.idDoctor_Qlee) {
      notify("error", "Selecciona el doctor que lee el examen");
      return;
    }
    setPhase2Saving(true);
    try {
      const storedBirads = showBiradsField ? phase2Form.birads : "-";
      const existingPhase2Doctor = selectedAppointmentDetails?.fase2
        ?.idDoctor_Qlee
        ? selectedAppointmentDetails.fase2.idDoctor_Qlee.toString()
        : "";
      if (
        storedBirads === (phase2RawBirads ?? "") &&
        phase2Form.idDoctor_Qlee === existingPhase2Doctor
      ) {
        await updateCitaPhase(selectedAppointmentId, phaseFlow.lectura);
        setPhase2Locked(true);
        notify("success", "Lectura actualizada");
        await loadAppointmentDetails(selectedAppointmentId);
        return;
      }
      await savePhase2(selectedAppointmentId, {
        idFase2: selectedAppointmentDetails?.fase2?.idFase2,
        idDoctor_Qlee: phase2Form.idDoctor_Qlee || null,
        birads: storedBirads,
      });
      setPhase2RawBirads(storedBirads);
      await updateCitaPhase(selectedAppointmentId, phaseFlow.lectura);
      setPhase2Locked(true);
      notify("success", "Lectura actualizada");
      await loadAppointmentDetails(selectedAppointmentId);
    } catch (error) {
      notify("error", `No se pudo guardar la lectura: ${error.message}`);
    } finally {
      setPhase2Saving(false);
    }
  };

  const handlePhase3Submit = async (event) => {
    event.preventDefault();
    if (!canPhaseDeliver) {
      return;
    }
    if (!selectedAppointmentId) {
      notify("error", "Selecciona una cita");
      return;
    }
    setPhase3Saving(true);
    try {
      await savePhase3(selectedAppointmentId, {
        idFase3: selectedAppointmentDetails?.fase3?.idFase3,
        usuarioEntregaId:
          selectedAppointmentDetails?.fase3?.usuarioEntregaId ?? null,
        fecha_entrega: phase3Form.fecha_entrega || null,
        retirada_por_usuario: phase3Form.retirada_por_usuario,
        nombre: phase3Form.nombre || null,
        dui: phase3Form.dui || null,
      });
      await updateCitaPhase(selectedAppointmentId, phaseFlow.entrega);
      setPhase3Locked(true);
      notify("success", "Entrega registrada");
      await loadAppointmentDetails(selectedAppointmentId);
    } catch (error) {
      notify("error", `No se pudo registrar la entrega: ${error.message}`);
    } finally {
      setPhase3Saving(false);
    }
  };

  useEffect(() => {
    if (!phase3Form.retirada_por_usuario) return;
    if (!currentPatient) return;
    setPhase3Form((prev) => ({
      ...prev,
      nombre: fullName(currentPatient),
      dui: currentPatient.dui ?? prev.dui,
    }));
  }, [phase3Form.retirada_por_usuario, currentPatient]);

  const renderNotice = () => {
    if (!notice) return null;
    const color =
      notice.type === "error"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-green-50 text-green-700 border-green-200";
    return (
      <div className={`rounded-md border px-4 py-2 text-sm ${color}`}>
        {notice.text}
      </div>
    );
  };

  const stepButton = (step) => {
    const isActive = activeStep === step.id;
    const requiresPatient = step.id !== "actualizar";
    const requiresAppointment = ["registro", "lectura", "entrega"].includes(
      step.id,
    );
    const appointmentSelected = Boolean(selectedAppointmentId);
    const canAccessStep = (() => {
      if (step.id === "actualizar") {
        return true;
      }
      if (step.id === "confirmar") {
        return Boolean(selectedPatientId);
      }
      if (step.id === "registro") {
        return appointmentSelected;
      }
      if (step.id === "lectura") {
        return appointmentSelected && phaseAccess.lectura;
      }
      if (step.id === "entrega") {
        return appointmentSelected && phaseAccess.entrega;
      }
      return true;
    })();
    const disabled =
      (requiresPatient && !selectedPatientId) ||
      (requiresAppointment && !canAccessStep);
    return (
      <button
        key={step.id}
        type="button"
        onClick={() => !disabled && goToStep(step.id)}
        className={`${isActive
          ? "bg-gray-900 text-white"
          : "bg-white text-gray-700 hover:bg-gray-100"
          } rounded-full border border-gray-200 px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50`}
        disabled={disabled}
      >
        {step.label}
      </button>
    );
  };

  // Formatear Nombres y Apellidos
  const limpiar2PalabrasLive = (v) => {
    let s = v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, ""); // permite letras, tildes, ñ, espacio
    s = s.replace(/ {2,}/g, " ");                         // colapsa espacios múltiples
    const trailing = s.endsWith(" ");
    const parts = s.trim().split(" ").filter(Boolean);
    if (parts.length > 2) s = parts.slice(0, 2).join(" ") + (trailing ? " " : "");
    return s; // NO trim al final para permitir espacio mientras escribe
  };

  const titleCase = (v) =>
    v.replace(/\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])([A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’-]*)/g,
      (_, a, b) => a.toUpperCase() + b.toLowerCase());

  // Limitador de fechas
  const toLocalISODate = (d = new Date()) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  };

  const TODAY = toLocalISODate();

  const MIN_120 = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 120); // mismo día y mes, 120 años atrás
    return toLocalISODate(d);
  })();

  const MIN_1Y = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return toLocalISODate(d);
  })();

  const MAX_1Y = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return toLocalISODate(d);
  })();

  // Formatear DUI
  const soloNumeros = (v) => v.replace(/\D/g, "").slice(0, 9);
  const formatearDUI = (v) => (v.length <= 8 ? v : `${v.slice(0, 8)}-${v.slice(8)}`);

  // Formatear No. de afiliación
  const soloNumeros9 = (v) => v.replace(/\D/g, "").slice(0, 9);
  const formatearAfiliacion = (d) => {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 9)}`;
  };

  // Formatear Números de teléfono:
  const soloNumeros8 = (v) => v.replace(/\D/g, "").slice(0, 8);
  const formatearTel = (d) => (d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`);

  const renderPatientStep = () => (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Pacientes</h3>
        <p className="mt-1 text-xs text-gray-500">
          Busca y selecciona el paciente para iniciar el flujo.
        </p>
        <input
          value={patientSearch}
          onChange={(event) => setPatientSearch(event.target.value)}
          placeholder="Buscar por nombre o DUI"
          className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
        />
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {patientsLoading ? (
            <p className="text-sm text-gray-500">Cargando pacientes...</p>
          ) : filteredPatients.length === 0 ? (
            <p className="text-sm text-gray-500">Sin coincidencias</p>
          ) : (
            filteredPatients.map((patient) => {
              const selected = patient.idPaciente === selectedPatientId;
              return (
                <button
                  key={patient.idPaciente}
                  type="button"
                  onClick={() => setSelectedPatientId(patient.idPaciente)}
                  className={`${selected ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"} w-full rounded-xl px-3 py-2 text-left text-sm transition-colors`}
                >
                  <div className="font-semibold">{fullName(patient)}</div>
                  <div className="text-xs opacity-75">
                    DUI: {patient.dui || "-"}
                  </div>
                </button>
              );
            })
          )}
        </div>
        {patientsError ? (
          <p className="mt-3 text-xs text-red-600">Error: {patientsError}</p>
        ) : null}
        {canEditPatient ? (
          <p className="mt-4 text-xs text-gray-500">
            ?No encuentras al paciente?
            <Link
              to="/pacientes"
              className="font-medium text-gray-900 hover:underline"
            >
              {" "}
              Registralo aqui
            </Link>
            .
          </p>
        ) : null}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {!selectedPatientId ? (
          <p className="text-sm text-gray-600">
            Selecciona un paciente para revisar sus datos.
          </p>
        ) : (
          <form className="space-y-5" onSubmit={handlePatientSubmit}>
            <fieldset disabled={patientFieldsDisabled} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm text-gray-700">
                  <span>Nombre *</span>
                  <input
                    name="nombre"
                    placeholder="Juan Carlos"
                    value={patientForm.nombre}
                    minLength={3}
                    maxLength={60}
                    inputMode="text"
                    pattern="^(?=.{3,60}$)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?$"
                    onChange={(e) =>
                      setPatientForm(p => ({ ...p, nombre: limpiar2PalabrasLive(e.target.value) }))
                    }
                    onBlur={(e) =>
                      setPatientForm(p => ({ ...p, nombre: titleCase(e.target.value.trim()) }))
                    }
                    className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                    required
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-700">
                  <span>Apellido *</span>
                  <input
                    name="apellido"
                    placeholder="Pérez Gomez"
                    value={patientForm.apellido}
                    minLength={3}
                    maxLength={60}
                    inputMode="text"
                    pattern="^(?=.{3,60}$)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?$"
                    onChange={(e) =>
                      setPatientForm(p => ({ ...p, apellido: limpiar2PalabrasLive(e.target.value) }))
                    }
                    onBlur={(e) =>
                      setPatientForm(p => ({ ...p, apellido: titleCase(e.target.value.trim()) }))
                    }
                    className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                    required
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-700">
                  <span>Genero *</span>
                  <select
                    name="genero"
                    value={patientForm.genero}
                    onChange={(event) =>
                      setPatientForm((prev) => ({
                        ...prev,
                        genero: event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm text-gray-700">
                  <span>Fecha de nacimiento</span>
                  <input
                    type="date"
                    name="fecha_nacimiento"
                    value={patientForm.fecha_nacimiento}
                    min={MIN_120}
                    max={TODAY}
                    onChange={(e) => setPatientForm(p => ({ ...p, fecha_nacimiento: e.target.value }))}
                    onBlur={(e) => {
                      const v = e.target.value; if (!v) return;
                      let nv = v; if (v > TODAY) nv = TODAY; if (v < MIN_120) nv = MIN_120;
                      if (nv !== v) { e.target.value = nv; setPatientForm(p => ({ ...p, fecha_nacimiento: nv })); }
                    }}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                    required
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-700">
                  <span>DUI</span>
                  <input
                    name="dui"
                    placeholder="00000000-0"
                    value={patientForm.dui}
                    maxLength={10}
                    inputMode="numeric"
                    pattern="^\d{8}-\d$"
                    onChange={(e) => {
                      const d = soloNumeros(e.target.value);
                      const f = formatearDUI(d);
                      setPatientForm(p => ({ ...p, dui: f }));
                    }}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-700">
                  <span>Numero de afiliacion</span>
                  <input
                    name="numero_afiliacion"
                    placeholder="00-0000-000"
                    value={patientForm.numero_afiliacion}
                    maxLength={11}
                    inputMode="numeric"
                    pattern="^[0-9]{2}-[0-9]{4}-[0-9]{3}$"
                    onChange={(e) => {
                      const d = soloNumeros9(e.target.value);
                      const f = formatearAfiliacion(d);
                      setPatientForm(p => ({ ...p, numero_afiliacion: f }));
                    }}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-700">
                  <span>Telefono fijo</span>
                  <input
                    name="telefono_fijo"
                    placeholder="0000-0000"
                    value={patientForm.telefono_fijo}
                    maxLength={9}
                    inputMode="numeric"
                    pattern="^\d{4}-\d{4}$"
                    onChange={(e) => {
                      const d = soloNumeros8(e.target.value);
                      const f = formatearTel(d);
                      setPatientForm(p => ({ ...p, telefono_fijo: f }));
                    }}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-700">
                  <span>Telefono celular</span>
                  <input
                    name="telefono_celular"
                    placeholder="0000-0000"
                    value={patientForm.telefono_celular}
                    maxLength={9}
                    inputMode="numeric"
                    pattern="^\d{4}-\d{4}$"
                    onChange={(e) => {
                      const d = soloNumeros8(e.target.value);
                      const f = formatearTel(d);
                      setPatientForm(p => ({ ...p, telefono_celular: f }));
                    }}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Edad aproximada
                  </p>
                  <p className="text-xs text-gray-500">
                    {computeAge(patientForm.fecha_nacimiento)} anos
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={patientConfirmed}
                    onChange={(event) =>
                      setPatientConfirmed(event.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                    disabled={patientFieldsDisabled}
                  />
                  <span>Datos verificados</span>
                </label>
              </div>
            </fieldset>
            <div className="flex items-center justify-end gap-2">
              {canEditPatient ? (
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  disabled={patientSaving || !patientHasChanges}
                >
                  {patientSaving ? "Guardando..." : "Guardar datos"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => goToStep("confirmar")}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
                disabled={canEditPatient ? !patientConfirmed : !selectedPatientId}
              >
                Continuar con la cita
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );

  const renderAppointmentStep = () => (
    <section className="space-y-4">
      {!selectedPatientId ? (
        <p className="text-sm text-gray-600">
          Selecciona y confirma un paciente antes de agendar.
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Citas del paciente
                </h3>
                <p className="text-xs text-gray-500">
                  Selecciona una cita existente o crea una nueva.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {canEditAppointmentDetails ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAppointmentId(null);
                      setSelectedAppointmentDetails(null);
                      resetFormsForNewAppointment();
                    }}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    Nueva cita
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {appointmentsLoading ? (
                <span className="text-sm text-gray-500">Cargando citas...</span>
              ) : appointments.length === 0 ? (
                <span className="text-sm text-gray-500">
                  Sin citas registradas
                </span>
              ) : (
                appointments.map((appointment, index) => {
                  const appointmentId = resolveAppointmentId(appointment);
                  const selected =
                    toId(appointmentId) === toId(selectedAppointmentId) &&
                    appointmentId !== null;
                  const label = `${appointment.servicio_nombre ?? appointment?.raw?.servicioNombre ?? "Servicio"} - ${formatDateForDisplay(appointment.turno_fecha ?? appointment.fecha_referencia ?? appointment?.raw?.turnoFecha ?? appointment?.raw?.fechaReferencia)}`;
                  return (
                    <button
                      key={appointmentId ?? `appointment-${index}`}
                      type="button"
                      onClick={() => {
                        const targetId = resolveAppointmentId(appointment);
                        if (targetId === null || targetId === undefined || targetId === "") {
                          notify("error", "No se pudo identificar la cita seleccionada.");
                          return;
                        }
                        const normalizedTarget =
                          toId(targetId) ?? String(targetId);
                        setSelectedAppointmentId(normalizedTarget);
                      }}
                      className={`${selected ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"} rounded-full px-4 py-1.5 text-sm font-medium transition-colors`}
                    >
                      {label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <form className="space-y-5" onSubmit={handleAppointmentSubmit}>
              <fieldset disabled={!canEditAppointmentDetails} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm text-gray-700">
                    <span>Centro de atencion *</span>
                    <select
                      name="idCentro_Atencion"
                      value={appointmentForm.idCentro_Atencion}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAppointmentForm((prev) => ({
                          ...prev,
                          idCentro_Atencion: value,
                          idServicio: "",
                          nombreServicio: "",
                          idContrato: "",
                        }));
                      }}
                      disabled={appointmentLocked}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                      required
                    >
                      <option value="">Seleccionar</option>
                      {centroOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-gray-700">
                    <span>Servicio *</span>
                    <select
                      name="idServicio"
                      value={appointmentForm.idServicio}
                      onChange={(event) => {
                        const value = event.target.value;
                        const option = servicioOptions.find(
                          (item) => item.value === value,
                        );
                        setAppointmentForm((prev) => ({
                          ...prev,
                          idServicio: value,
                          nombreServicio: option?.nombre ?? "",
                          idContrato: "",
                        }));
                      }}
                      disabled={
                        appointmentLocked ||
                        !appointmentForm.idCentro_Atencion ||
                        loadingServices
                      }
                      className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                      required
                    >
                      <option value="">Seleccionar</option>
                      {servicioOptions.map((option) => (
                        <option
                          key={`service-${option.servicioContratoId ?? option.value}`}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-gray-700">
                    <span>Contrato{contratoOptions.length > 1 ? " *" : ""}</span>
                    <select
                      name="idContrato"
                      value={appointmentForm.idContrato}
                      onChange={(event) => {
                        const value = event.target.value;
                        setAppointmentForm((prev) => ({
                          ...prev,
                          idContrato: value,
                        }));
                      }}
                      disabled={
                        appointmentLocked ||
                        loadingServices ||
                        (
                          !appointmentForm.idServicio &&
                          !appointmentForm.nombreServicio
                        ) ||
                        contratoOptions.length === 0
                      }
                      className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                      required={contratoOptions.length > 1}
                    >
                      <option value="">Seleccionar</option>
                      {contratoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-gray-700">
                    <span>Fase</span>
                    <select
                      name="idFase"
                      value={
                        appointmentForm.idFase != null
                          ? String(appointmentForm.idFase)
                          : String(defaultPhaseId)
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setAppointmentForm((prev) => ({
                          ...prev,
                          idFase: value ? toNumericId(value) : null,
                        }));
                      }}
                      disabled
                      className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                      required
                    >
                      <option value="">Seleccionar</option>
                      {selectOptions.fases.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-gray-700">
                    <span>Turno *</span>
                    <select
                      name="idTurno"
                      value={appointmentForm.idTurno}
                      onChange={(event) =>
                        setAppointmentForm((prev) => ({
                          ...prev,
                          idTurno: event.target.value,
                        }))
                      }
                      disabled={appointmentLocked || !appointmentForm.idContrato}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                      required
                    >
                      <option value="">Sin turno asignado</option>
                      {selectOptions.turnos.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-gray-700">
                    <span>Fecha de referencia *</span>
                    <input
                      type="date"
                      name="fecha_referencia"
                      value={appointmentForm.fecha_referencia ?? ""}
                      min={MIN_1Y}
                      max={TODAY}
                      onChange={(e) =>
                        setAppointmentForm((p) => ({ ...p, fecha_referencia: e.target.value }))
                      }
                      onBlur={(e) => {
                        const v = e.target.value; if (!v) return;
                        let nv = v;
                        if (v > TODAY) nv = TODAY;
                        if (v < MIN_1Y) nv = MIN_1Y;
                        if (nv !== v) {
                          e.target.value = nv;
                          setAppointmentForm((p) => ({ ...p, fecha_referencia: nv }));
                        }
                      }}
                      disabled={appointmentLocked}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                      required
                    />
                  </label>
                  <label className="space-y-1 text-sm text-gray-700">
                    <span>Medico referido</span>
                    <input
                      name="medico_referido"
                      value={appointmentForm.medico_referido}
                      onChange={(event) =>
                        setAppointmentForm((prev) => ({
                          ...prev,
                          medico_referido: event.target.value,
                        }))
                      }
                      disabled={appointmentLocked}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                      placeholder="Opcional"
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Confirmacion de cita
                    </p>
                    <p className="text-xs text-gray-500">
                      Al confirmar, la cita deja la fase Precita y pasa a Cita.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      name="confirmada"
                      checked={appointmentForm.confirmada}
                      onChange={(event) =>
                        setAppointmentForm((prev) => ({
                          ...prev,
                          confirmada: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                      disabled={!canConfirmAppointment || appointmentLocked}
                    />
                    <span>Confirmada</span>
                  </label>
                </div>
              </fieldset>
              <div className="flex items-center justify-end gap-2">
                {canEditAppointmentDetails ? (
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    disabled={appointmentSaving || appointmentLocked}
                  >
                    {appointmentSaving ? "Guardando..." : "Guardar cita"}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </>
      )}
    </section>
  );

  const renderRegistroStep = () => (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Resumen de cita</h3>
        {!currentCita ? (
          <p className="mt-2 text-sm text-gray-500">
            Selecciona una cita para continuar.
          </p>
        ) : (
          <dl className="mt-3 space-y-2 text-sm text-gray-700">
            <div>
              <dt className="font-medium">Paciente</dt>
              <dd>{fullName(currentPatient ?? {})}</dd>
            </div>
            <div>
              <dt className="font-medium">Servicio</dt>
              <dd>{currentCita.servicio_nombre || "-"}</dd>
            </div>
          </dl>
        )}
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {!selectedAppointmentId ? (
          <p className="text-sm text-gray-600">
            Selecciona o crea una cita antes de registrar el examen.
          </p>
        ) : (
          <form className="space-y-5" onSubmit={handlePhase1Submit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
                <span>Fecha programada de entrega *</span>
                <input
                  type="date"
                  name="fecha_programada_entrega"
                  value={phase1Form.fecha_programada_entrega ?? ""}
                  min={TODAY}
                  max={MAX_1Y}
                  onChange={(e) =>
                    setPhase1Form(p => ({ ...p, fecha_programada_entrega: e.target.value }))
                  }
                  onBlur={(e) => {
                    const v = e.target.value; if (!v) return;
                    let nv = v;
                    if (v < TODAY) nv = TODAY;
                    if (v > MAX_1Y) nv = MAX_1Y;
                    if (nv !== v) {
                      e.target.value = nv;
                      setPhase1Form(p => ({ ...p, fecha_programada_entrega: nv }));
                    }
                  }}
                  disabled={phase1ReadOnly}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  required
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
                <span>Licenciado encargado *</span>
                <select
                  name="idLic_encargada"
                  value={phase1Form.idLic_encargada}
                  onChange={(event) =>
                    setPhase1Form((prev) => ({
                      ...prev,
                      idLic_encargada: event.target.value,
                    }))
                  }
                  disabled={phase1ReadOnly}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  required
                >
                  <option value="">Seleccionar</option>
                  {selectOptions.licenciadas.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-end">
              {canPhaseRegister ? (
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  disabled={phase1Saving || phase1ReadOnly}
                >
                  {phase1Saving ? "Guardando..." : "Guardar registro"}
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </section>
  );

  // Formatear BIRADS
  const biradsSanitize = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 1);
    if (!d) return "";
    const n = Number(d);
    if (n < 1) return "1";
    if (n > 6) return "6";
    return String(n);
  };

  const renderLecturaStep = () => (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          Resumen del examen
        </h3>
        <dl className="mt-3 space-y-2 text-sm text-gray-700">
          <div>
            <dt className="font-medium">Paciente</dt>
            <dd>{fullName(currentPatient ?? {})}</dd>
          </div>
          <div>
            <dt className="font-medium">Servicio</dt>
            <dd>
              {selectedServiceName || currentCita?.servicio_nombre || "-"}
            </dd>
          </div>
        </dl>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {!selectedAppointmentId ? (
          <p className="text-sm text-gray-600">
            Selecciona una cita para registrar la lectura.
          </p>
        ) : (
          <form className="space-y-5" onSubmit={handlePhase2Submit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
                <span>Doctor que interpreta *</span>
                <select
                  name="idDoctor_Qlee"
                  value={phase2Form.idDoctor_Qlee}
                  onChange={(event) =>
                    setPhase2Form((prev) => ({
                      ...prev,
                      idDoctor_Qlee: event.target.value,
                    }))
                  }
                  disabled={phase2ReadOnly}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  required
                >
                  <option value="">Seleccionar</option>
                  {selectOptions.doctores.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {showBiradsField ? (
                <label className="space-y-1 text-sm text-gray-700">
                  <span>Clasificacion BIRADS (1-6) *</span>
                  <input
                    name="birads"
                    inputMode="numeric"
                    pattern="^[1-6]$"
                    maxLength={1}
                    placeholder="1–6"
                    value={phase2Form.birads}
                    onChange={(e) =>
                      setPhase2Form((p) => ({ ...p, birads: biradsSanitize(e.target.value) }))
                    }
                    onBlur={(e) => {
                      const v = biradsSanitize(e.target.value);
                      if (v !== e.target.value) {
                        e.target.value = v;
                        setPhase2Form((p) => ({ ...p, birads: v }));
                      }
                    }}
                    disabled={phase2ReadOnly}
                    autoComplete="off"
                    className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                    required
                  />
                </label>
              ) : null}
            </div>
            <div className="flex items-center justify-end">
              {canPhaseRead ? (
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  disabled={phase2Saving || phase2ReadOnly}
                >
                  {phase2Saving ? "Guardando..." : "Guardar lectura"}
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </section>
  );

  // Formatear fecha de entrega
  const MIN_1W = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalISODate(d);
  })();

  // Formatear nombre completo
  const limpiarNombre4Live = (v) => {
    let s = v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, "").replace(/ {2,}/g, " ");
    const trailing = s.endsWith(" ");
    const parts = s.trim().split(" ").filter(Boolean);
    if (parts.length > 4) s = parts.slice(0, 4).join(" ");
    else s = parts.join(" ") + (trailing && parts.length < 4 ? " " : "");
    return s;
  };

  const renderEntregaStep = () => (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          Resumen del proceso
        </h3>
        <dl className="mt-3 space-y-2 text-sm text-gray-700">
          <div>
            <dt className="font-medium">Paciente</dt>
            <dd>{fullName(currentPatient ?? {})}</dd>
          </div>
          <div>
            <dt className="font-medium">Entrega programada</dt>
            <dd>
              {formatDateForDisplay(
                phase1Form.fecha_programada_entrega ||
                selectedAppointmentDetails?.fase1?.fecha_programada_entrega ||
                selectedAppointmentDetails?.fase1?.fecha_entrega,
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Entrega registrada</dt>
            <dd>
              {formatDateForDisplay(
                phase3Form.fecha_entrega ||
                selectedAppointmentDetails?.fase3?.fecha_entrega,
              )}
            </dd>
          </div>
        </dl>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        {!selectedAppointmentId ? (
          <p className="text-sm text-gray-600">
            Selecciona una cita para registrar la entrega.
          </p>
        ) : (
          <form className="space-y-5" onSubmit={handlePhase3Submit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700">
                <span>Fecha de entrega *</span>
                <input
                  type="date"
                  name="fecha_entrega"
                  value={phase3Form.fecha_entrega ?? ""}
                  min={MIN_1W}
                  max={MAX_1Y}
                  onChange={(e) =>
                    setPhase3Form(p => ({ ...p, fecha_entrega: e.target.value }))
                  }
                  onBlur={(e) => {
                    const v = e.target.value; if (!v) return;
                    let nv = v;
                    if (v < MIN_1W) nv = MIN_1W;
                    if (v > MAX_1Y) nv = MAX_1Y;
                    if (nv !== v) {
                      e.target.value = nv;
                      setPhase3Form(p => ({ ...p, fecha_entrega: nv }));
                    }
                  }}
                  disabled={phase3ReadOnly}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  required
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span>DUI de quien recibe *</span>
                <input
                  name="dui"
                  placeholder="00000000-0"
                  value={phase3Form.dui}
                  inputMode="numeric"
                  pattern="^\d{8}-\d$"
                  maxLength={10}
                  onChange={(e) => {
                    const d = soloNumeros(e.target.value);
                    const f = formatearDUI(d);
                    setPhase3Form(p => ({ ...p, dui: f }));
                  }}
                  disabled={phase3ReadOnly || phase3Form.retirada_por_usuario}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  required
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
                <span>Persona que recibe *</span>
                <input
                  name="nombre"
                  minLength={20}
                  maxLength={80}
                  inputMode="text"
                  pattern="^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){3}$"
                  value={phase3Form.nombre}
                  onChange={(e) =>
                    setPhase3Form(p => ({ ...p, nombre: limpiarNombre4Live(e.target.value) }))
                  }
                  onBlur={(e) => {
                    const parts = e.target.value.trim().split(" ").filter(Boolean);
                    if (parts.length !== 4) {
                      e.target.setCustomValidity("Escribe exactamente 4 palabras (3 espacios).");
                      e.target.reportValidity();
                      return;
                    }
                    e.target.setCustomValidity("");
                    const nv = titleCase(parts.join(" "));
                    if (nv !== e.target.value) {
                      e.target.value = nv;
                      setPhase3Form(p => ({ ...p, nombre: nv }));
                    }
                  }}
                  disabled={phase3ReadOnly || phase3Form.retirada_por_usuario}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 focus:border-gray-400 focus:outline-none"
                  placeholder="Nombre completo"
                  required
                />
              </label>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="retirada_por_usuario"
                checked={phase3Form.retirada_por_usuario}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setPhase3Form((prev) => ({
                    ...prev,
                    retirada_por_usuario: checked,
                    nombre:
                      checked && currentPatient ? fullName(currentPatient) : "",
                    dui:
                      checked && currentPatient
                        ? (currentPatient.dui ?? "")
                        : "",
                  }));
                }}
                disabled={phase3ReadOnly}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
              />
              <span>Retirada por la paciente</span>
            </label>
            <div className="flex items-center justify-end">
              {canPhaseDeliver ? (
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  disabled={phase3Saving || phase3ReadOnly}
                >
                  {phase3Saving ? "Guardando..." : "Registrar entrega"}
                </button>
              ) : null}
            </div>
          </form>
        )}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">
          Gestion de citas
        </h1>
        <p className="text-sm text-gray-600">
          Sigue el flujo para validar datos del paciente, confirmar la cita y
          registrar cada fase del procedimiento.
        </p>
      </header>
      {renderNotice()}
      <div className="flex flex-wrap gap-2">
        {allowedSteps.map(stepButton)}
        {detailsLoading ? (
          <span className="text-sm text-gray-500">Cargando...</span>
        ) : null}
        {catalogsLoading ? (
          <span className="text-sm text-gray-500">
            Actualizando catalogos...
          </span>
        ) : null}
      </div>
      {activeStep === "actualizar" && renderPatientStep()}
      {activeStep === "confirmar" && renderAppointmentStep()}
      {activeStep === "registro" && renderRegistroStep()}
      {activeStep === "lectura" && renderLecturaStep()}
      {activeStep === "entrega" && renderEntregaStep()}
    </div>
  );
}
