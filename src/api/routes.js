import { buildApiUrl } from "./config.js";

const RESOURCE_PATHS = {
  auth: "/auth",
  authLogin: "/auth/login",
  centers: "/api/centros",
  appointments: "/api/citas",
  phase1: "/api/fase1",
  phase2: "/api/fase2",
  phase3: "/api/fase3",
  contractCenters: "/api/contrato-centros",
  serviceContracts: "/api/servicio-contratos",
  contracts: "/api/contratos",
  doctorHorarios: "/api/doctor-horarios",
  doctorTurnos: "/api/doctor-turnos",
  filters: "/api/filtros",
  patients: "/api/pacientes",
  roles: "/api/roles",
  services: "/api/servicios",
  users: "/api/usuarios",
};

function assertResource(key) {
  const path = RESOURCE_PATHS[key];
  if (!path) {
    throw new Error(`api/routes: unknown resource key "${key}"`);
  }
  return path;
}

function sanitiseSegment(segment) {
  if (segment === undefined || segment === null) {
    return null;
  }
  const value = String(segment).trim();
  if (!value) {
    return null;
  }
  return value.replace(/^\/+|\/+$/g, "");
}

function normaliseBase(base) {
  const trimmed = String(base).trim();
  const stripped = trimmed.replace(/\/+$/g, "");
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

function joinPath(base, segments) {
  const extras = segments
    .map(sanitiseSegment)
    .filter(Boolean);
  const normalisedBase = normaliseBase(base);
  if (!extras.length) {
    return normalisedBase;
  }
  return `${normalisedBase}/${extras.join("/")}`;
}

export function apiPath(resourceKey, ...segments) {
  return joinPath(assertResource(resourceKey), segments);
}

export function apiUrl(resourceKey, ...segments) {
  return buildApiUrl(apiPath(resourceKey, ...segments));
}