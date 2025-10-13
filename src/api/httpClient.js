import tokenManager from "./tokenManager.js";
import { buildApiUrl } from "./config.js";

const HeadersClass = typeof Headers !== "undefined" ? Headers : class SimpleHeaders {
  constructor(init) {
    this.store = new Map();
    if (init && typeof init === "object") {
      if (init instanceof Map) {
        init.forEach((value, key) => this.set(key, value));
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.set(key, value));
      } else {
        Object.entries(init).forEach(([key, value]) => this.set(key, value));
      }
    }
  }

  set(key, value) {
    this.store.set(String(key).toLowerCase(), String(value));
  }

  get(key) {
    const value = this.store.get(String(key).toLowerCase());
    return value === undefined ? null : value;
  }

  has(key) {
    return this.store.has(String(key).toLowerCase());
  }

  forEach(callback) {
    for (const [key, value] of this.store.entries()) {
      callback(value, key);
    }
  }
};

function isHeadersLike(value) {
  if (!value) return false;
  if (typeof Headers !== "undefined" && value instanceof Headers) {
    return true;
  }
  return value instanceof HeadersClass;
}

export class HttpError extends Error {
  constructor(message, response, payload) {
    super(message);
    this.name = "HttpError";
    this.status = response?.status;
    this.payload = payload;
    this.response = response;
  }
}

const DEFAULT_OPTIONS = {
  auth: true,
  parse: "json",
  throwOnError: true,
  credentials: "include",
  retry: false,
};

function normaliseHeaders(input) {
  const headers = new HeadersClass();
  if (!input) {
    return headers;
  }
  if (isHeadersLike(input)) {
    input.forEach((value, key) => {
      if (value !== undefined && value !== null) {
        headers.set(key, value);
      }
    });
    return headers;
  }
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null) {
      headers.set(key, value);
    }
  }
  return headers;
}

function appendQueryString(url, query) {
  if (!query || typeof query !== "object") {
    return url;
  }
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)));
    } else {
      searchParams.append(key, String(value));
    }
  }
  if ([...searchParams.entries()].length === 0) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${searchParams.toString()}`;
}

async function parseResponseBody(response, mode) {
  if (mode === "response") {
    return response;
  }

  if (response.status === 204) {
    return null;
  }

  const contentLength = response.headers?.get?.("content-length");
  if (contentLength === "0") {
    return null;
  }

  const contentType = response.headers?.get?.("content-type") ?? "";
  const text = await response.text();
  if (!text) {
    return null;
  }
  if (mode === "text" || !contentType.includes("json")) {
    return text;
  }
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error("Failed to parse JSON response");
  }
}

function resolveUrl(path) {
  if (!path) {
    return buildApiUrl("");
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return buildApiUrl(path);
}

function ensureMethod(value = "GET") {
  return String(value || "GET").toUpperCase();
}

async function request(path, options = {}) {
  const {
    method = "GET",
    headers,
    data,
    body,
    query,
    auth,
    parse,
    throwOnError,
    credentials,
    retry,
    signal,
    refreshSkew = 60,
  } = { ...DEFAULT_OPTIONS, ...options, method: ensureMethod(options.method ?? method) };

  let url = resolveUrl(path);
  if (query) {
    url = appendQueryString(url, query);
  }

  const requestHeaders = normaliseHeaders(headers);

  if (parse === "json" && !requestHeaders.has("accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  let requestBody = body;
  const upperMethod = ensureMethod(method);

  if (data !== undefined) {
    if (upperMethod === "GET" || upperMethod === "HEAD") {
      url = appendQueryString(url, data);
    } else {
      if (!requestHeaders.has("content-type")) {
        requestHeaders.set("Content-Type", "application/json");
      }
      requestBody = JSON.stringify(data);
    }
  }

  if (auth) {
    await tokenManager.refreshIfNeeded({ skewSeconds: refreshSkew });
    const authHeader = tokenManager.getAuthHeader();
    if (authHeader) {
      requestHeaders.set("Authorization", authHeader);
    }
  }

  const response = await fetch(url, {
    method: upperMethod,
    headers: requestHeaders,
    body: requestBody,
    credentials,
    signal,
  });

  if (auth && !retry && response.status === 401) {
    try {
      await tokenManager.refresh({ force: true });
    } catch (refreshError) {
      tokenManager.clear({ keepCredentials: false });
      throw new HttpError(refreshError.message || "Authentication expired", response, null);
    }
    return request(path, { ...options, retry: true });
  }

  const payload = await parseResponseBody(response, parse);

  if (!response.ok) {
    if (throwOnError) {
      const message = payload && typeof payload === "object" && payload !== null && payload.message ? payload.message : `Request failed with status ${response.status}`;
      throw new HttpError(message, response, payload);
    }
    return { ok: false, status: response.status, data: payload, response };
  }

  if (parse === "response") {
    return response;
  }

  return payload;
}

function createMethod(method) {
  return (path, options = {}) => request(path, { ...options, method });
}

export const apiClient = {
  request,
  get: createMethod("GET"),
  post: createMethod("POST"),
  put: createMethod("PUT"),
  patch: createMethod("PATCH"),
  delete: createMethod("DELETE"),
  del: createMethod("DELETE"),
};

export default apiClient;
