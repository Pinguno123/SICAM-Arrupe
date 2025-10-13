const DEFAULT_API_BASE_URL = "http://localhost:8080";
const DEFAULT_API_PREFIX = "api";
const DEFAULT_AUTH_PREFIX = "auth";

const DEFAULT_AUTH_ENDPOINTS = {
  login: { path: "auth/login", method: "POST", body: "form" },
  refresh: { path: "", method: "POST", body: "json" },
  logout: { path: "auth/logout", method: "POST", body: null },
};

function readEnvValue(name) {
  if (typeof import.meta !== "undefined" && import.meta.env && Object.prototype.hasOwnProperty.call(import.meta.env, name)) {
    const value = import.meta.env[name];
    if (typeof value === "string") {
      return value;
    }
  }

  if (typeof process !== "undefined" && process.env && Object.prototype.hasOwnProperty.call(process.env, name)) {
    const value = process.env[name];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function sanitiseBaseUrl(url) {
  if (url === undefined || url === null) {
    return "";
  }

  const raw = String(url).trim();
  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, "");
  }

  if (raw.startsWith("/")) {
    return raw.replace(/\/+$/, "");
  }

  return raw.replace(/\/+$/, "");
}

function sanitisePrefix(value, fallback) {
  const source = value !== undefined && value !== null ? value : fallback ?? "";
  if (source === undefined || source === null) {
    return "";
  }
  const trimmed = String(source).trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
}

function sanitisePath(value, fallback = "") {
  const rawValue = value !== undefined && value !== null ? String(value).trim() : "";
  if (rawValue && /^(none|null)$/i.test(rawValue)) {
    return "";
  }

  const candidate = rawValue || (fallback !== undefined && fallback !== null ? String(fallback).trim() : "");
  if (!candidate) {
    return "";
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate.replace(/\/+$/, "");
  }

  return candidate.replace(/^\/+/, "").replace(/\/+$/, "");
}

function parseMethod(value, fallback = "GET") {
  const rawValue = value !== undefined && value !== null ? String(value).trim() : "";
  if (rawValue) {
    return rawValue.toUpperCase();
  }
  if (!fallback) {
    return undefined;
  }
  return String(fallback).trim().toUpperCase();
}

function parseBodyMode(value, fallback = null) {
  const rawValue = value !== undefined && value !== null ? String(value).trim().toLowerCase() : "";
  if (rawValue) {
    if (rawValue === "json" || rawValue === "form") {
      return rawValue;
    }
    if (rawValue === "none" || rawValue === "empty") {
      return null;
    }
  }
  return fallback ?? null;
}

function resolveEnvBaseUrl() {
  const value = readEnvValue("VITE_API_BASE_URL");
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return sanitiseBaseUrl(trimmed);
}

function toBooleanFlag(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalised = String(value).trim();
  if (!normalised) {
    return fallback;
  }
  if (/^(1|true|yes|on)$/i.test(normalised)) {
    return true;
  }
  if (/^(0|false|no|off)$/i.test(normalised)) {
    return false;
  }
  return fallback;
}

function isLocalhostUrl(url) {
  if (!url) {
    return false;
  }
  try {
    const candidate = url.startsWith("http://") || url.startsWith("https://") ? new URL(url) : new URL(url, "http://localhost");
    const hostname = candidate.hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch (_error) {
    return false;
  }
}

function basePathSegments(base) {
  if (!base) {
    return [];
  }
  try {
    const parsed = base.startsWith("http://") || base.startsWith("https://") ? new URL(base) : new URL(base, "http://localhost");
    return parsed.pathname.split("/").filter(Boolean);
  } catch (_error) {
    return String(base).split("/").filter(Boolean);
  }
}

function shouldUseProxy(baseUrl) {
  const explicit = readEnvValue("VITE_USE_API_PROXY");
  if (explicit !== undefined) {
    return toBooleanFlag(explicit, false);
  }

  const isDev = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
  if (!isDev) {
    return false;
  }

  return baseUrl === "" || isLocalhostUrl(baseUrl);
}

function readAuthEndpoint(key, defaults) {
  const upper = key.toUpperCase();
  const path = sanitisePath(readEnvValue(`VITE_AUTH_${upper}_PATH`), defaults.path);
  const method = parseMethod(readEnvValue(`VITE_AUTH_${upper}_METHOD`), defaults.method);
  const body = parseBodyMode(readEnvValue(`VITE_AUTH_${upper}_BODY`), defaults.body);
  return { path, method, body };
}

const ENV_BASE_URL = resolveEnvBaseUrl();
const RAW_API_BASE_URL = ENV_BASE_URL !== undefined ? ENV_BASE_URL : DEFAULT_API_BASE_URL;
const USE_PROXY = shouldUseProxy(RAW_API_BASE_URL);

export const API_BASE_URL = USE_PROXY ? "" : RAW_API_BASE_URL || "";
export const IS_API_PROXY_ENABLED = USE_PROXY;

export const API_PREFIX = sanitisePrefix(readEnvValue("VITE_API_PREFIX"), DEFAULT_API_PREFIX);
export const AUTH_PREFIX = sanitisePrefix(readEnvValue("VITE_AUTH_PREFIX"), DEFAULT_AUTH_PREFIX);

const AUTH_ENDPOINTS_INTERNAL = {
  login: readAuthEndpoint("login", DEFAULT_AUTH_ENDPOINTS.login),
  refresh: readAuthEndpoint("refresh", DEFAULT_AUTH_ENDPOINTS.refresh),
  logout: readAuthEndpoint("logout", DEFAULT_AUTH_ENDPOINTS.logout),
};

export const AUTH_ENDPOINTS = Object.freeze(
  Object.fromEntries(
    Object.entries(AUTH_ENDPOINTS_INTERNAL).map(([key, value]) => [key, Object.freeze({ ...value })]),
  ),
);

function shouldAddPrefix(pathWithoutLeadingSlash, prefix, base) {
  if (!prefix) {
    return false;
  }
  const lowerPath = pathWithoutLeadingSlash.toLowerCase();
  const lowerPrefix = prefix.toLowerCase();
  if (!lowerPath || lowerPath === lowerPrefix || lowerPath.startsWith(`${lowerPrefix}/`)) {
    return false;
  }
  const segments = basePathSegments(base);
  if (segments.length && segments[segments.length - 1].toLowerCase() === lowerPrefix) {
    return false;
  }
  return true;
}

function buildUrl(path = "", { prefix } = {}) {
  if (path && /^https?:\/\//i.test(path)) {
    return path;
  }

  const base = API_BASE_URL;
  const cleanPrefix = sanitisePrefix(prefix, "");

  if (!path) {
    if (!base) {
      return cleanPrefix ? `/${cleanPrefix}` : "/";
    }
    if (/^https?:\/\//i.test(base)) {
      return cleanPrefix ? `${base}/${cleanPrefix}` : base;
    }
    const normalisedBase = base.startsWith("/") ? base.replace(/\/+$/, "") : `/${base.replace(/\/+$/, "")}`;
    return cleanPrefix ? `${normalisedBase}/${cleanPrefix}` : normalisedBase || "/";
  }

  const trimmed = String(path).trim();
  const withoutLeadingSlash = trimmed.replace(/^\/+/, "");
  const segments = [];

  if (shouldAddPrefix(withoutLeadingSlash, cleanPrefix, base)) {
    segments.push(cleanPrefix);
  }

  segments.push(withoutLeadingSlash);
  const suffix = segments.filter(Boolean).join("/");

  if (!base) {
    return `/${suffix}`;
  }

  if (/^https?:\/\//i.test(base)) {
    return `${base}/${suffix}`;
  }

  const normalisedBase = base.startsWith("/") ? base.replace(/\/+$/, "") : `/${base.replace(/\/+$/, "")}`;
  return `${normalisedBase}/${suffix}`.replace(/\/+/g, "/");
}

export function buildApiUrl(path = "", options = {}) {
  return buildUrl(path, { prefix: API_PREFIX, ...options });
}

export function buildAuthUrl(path = "", options = {}) {
  return buildUrl(path, { prefix: AUTH_PREFIX, ...options });
}

export function getBaseUrl() {
  return API_BASE_URL;
}

export function getAuthEndpointConfig(name) {
  return AUTH_ENDPOINTS[name] ?? null;
}
