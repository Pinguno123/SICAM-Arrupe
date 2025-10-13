import { buildAuthUrl, getAuthEndpointConfig } from "./config.js";
import tokenManager, { normalizeTokenResponse } from "./tokenManager.js";

const REFRESH_COOKIE_NAME = "clinic_refresh_token";

const LOGIN_CONFIG = getAuthEndpointConfig("login") ?? {};
const REFRESH_CONFIG = getAuthEndpointConfig("refresh") ?? {};
const LOGOUT_CONFIG = getAuthEndpointConfig("logout") ?? {};

const LOGIN_PATH = LOGIN_CONFIG.path || "auth/login";
const LOGIN_METHOD = (LOGIN_CONFIG.method || "POST").toUpperCase();
const LOGIN_BODY_MODE = normaliseBodyMode(LOGIN_CONFIG.body, "form");

const REFRESH_PATH = REFRESH_CONFIG.path || "";
const REFRESH_METHOD = (REFRESH_CONFIG.method || "POST").toUpperCase();
const REFRESH_BODY_MODE = normaliseBodyMode(REFRESH_CONFIG.body, "json");

const LOGOUT_PATH = LOGOUT_CONFIG.path || "";
const LOGOUT_METHOD = (LOGOUT_CONFIG.method || "POST").toUpperCase();

function normaliseBodyMode(mode, fallback) {
  if (!mode) {
    return fallback;
  }
  const value = String(mode).trim().toLowerCase();
  if (value === "form" || value === "json") {
    return value;
  }
  return fallback;
}

function urlSearchParamsFromObject(values = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  return params;
}

function appendQueryString(url, params = {}) {
  const query = urlSearchParamsFromObject(params).toString();
  if (!query) {
    return url;
  }
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

async function readJson(response) {
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_ignored) {
    return { message: text };
  }
}

function buildLoginUrl() {
  return buildAuthUrl(LOGIN_PATH);
}

function buildRefreshUrl() {
  if (!REFRESH_PATH) {
    return null;
  }
  return buildAuthUrl(REFRESH_PATH);
}

function buildLogoutUrl() {
  if (!LOGOUT_PATH) {
    return null;
  }
  return buildAuthUrl(LOGOUT_PATH);
}

function createAuthError(message, response, payload) {
  const error = new Error(message || "Authentication failed");
  error.status = response?.status;
  if (payload && typeof payload === "object") {
    error.payload = payload;
  }
  return error;
}

async function performLoginRequest({ username, password, persistCredentials = true, rememberRefreshToken = true, signal } = {}) {
  if (!username || !password) {
    throw new Error("login: username and password are required");
  }

  if (LOGIN_METHOD === "GET" || LOGIN_METHOD === "HEAD") {
    throw new Error("login: configured HTTP method does not support a request body");
  }

  const url = buildLoginUrl();
  const headers = {};
  let body;

  if (LOGIN_BODY_MODE === "form") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = urlSearchParamsFromObject({ username, password }).toString();
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ username, password });
  }

  const response = await fetch(url, {
    method: LOGIN_METHOD,
    headers,
    body,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const payload = await readJson(response);
    throw createAuthError(payload?.message || "Login request failed", response, payload);
  }

  const payload = await readJson(response);
  const tokens = tokenManager.set(payload, {
    credentials: persistCredentials ? { username, password } : undefined,
    persistRefreshToken: rememberRefreshToken,
    refreshCookieName: REFRESH_COOKIE_NAME,
  });

  return tokens;
}

async function performRefreshRequest({ force = false, signal } = {}) {
  const refreshUrl = buildRefreshUrl();
  const refreshToken = tokenManager.refreshToken;

  if (!refreshUrl || !refreshToken) {
    if (tokenManager.canReauthenticate()) {
      return performLoginRequest({
        ...tokenManager.credentials,
        persistCredentials: true,
        rememberRefreshToken: tokenManager.persistRefreshToken,
        signal,
      });
    }
    throw new Error("No refresh endpoint available and no stored credentials to re-login");
  }

  const payload = {
    refresh_token: refreshToken,
  };

  if (tokenManager.accessToken) {
    payload.access_token = tokenManager.accessToken;
  }

  if (force) {
    payload.force = REFRESH_BODY_MODE === "form" ? "1" : true;
  }

  const headers = {};
  let url = refreshUrl;
  let body;

  if (REFRESH_METHOD === "GET" || REFRESH_METHOD === "HEAD") {
    url = appendQueryString(url, payload);
  } else if (REFRESH_BODY_MODE === "form") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = urlSearchParamsFromObject(payload).toString();
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(payload);
  }

  const response = await fetch(url, {
    method: REFRESH_METHOD,
    headers,
    body,
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const errorPayload = await readJson(response);
    if (tokenManager.canReauthenticate()) {
      return performLoginRequest({
        ...tokenManager.credentials,
        persistCredentials: true,
        rememberRefreshToken: tokenManager.persistRefreshToken,
        signal,
      });
    }
    throw createAuthError(errorPayload?.message || "Refresh token request failed", response, errorPayload);
  }

  const data = await readJson(response);
  const tokens = tokenManager.set(data, {
    persistRefreshToken: tokenManager.persistRefreshToken,
    refreshCookieName: REFRESH_COOKIE_NAME,
  });
  return tokens;
}

export async function login(options) {
  return performLoginRequest(options);
}

export async function refreshAccessToken(options) {
  return performRefreshRequest(options);
}

export async function logout({ signal, withServerRevoke = true } = {}) {
  const logoutUrl = withServerRevoke ? buildLogoutUrl() : null;

  if (logoutUrl) {
    try {
      const authHeader = tokenManager.getAuthHeader();
      const headers = authHeader ? { Authorization: authHeader } : {};
      await fetch(logoutUrl, {
        method: LOGOUT_METHOD,
        credentials: "include",
        headers,
        signal,
      });
    } catch (_error) {
      // Ignore network errors when best-effort logout fails.
    }
  }

  tokenManager.clear({ keepCredentials: false, refreshCookieName: REFRESH_COOKIE_NAME });
}

tokenManager.setRefreshHandler(({ force, signal }) => performRefreshRequest({ force, signal }));
tokenManager.setLoginHandler(({ username, password, signal }) =>
  performLoginRequest({
    username,
    password,
    persistCredentials: true,
    rememberRefreshToken: tokenManager.persistRefreshToken,
    signal,
  }),
);

export function getNormalizedAuthConfig() {
  return {
    login: LOGIN_PATH
      ? {
          method: LOGIN_METHOD,
          path: LOGIN_PATH,
          body: LOGIN_BODY_MODE,
          url: buildAuthUrl(LOGIN_PATH),
        }
      : null,
    refresh: REFRESH_PATH
      ? {
          method: REFRESH_METHOD,
          path: REFRESH_PATH,
          body: REFRESH_BODY_MODE,
          url: buildAuthUrl(REFRESH_PATH),
        }
      : null,
    logout: LOGOUT_PATH
      ? {
          method: LOGOUT_METHOD,
          path: LOGOUT_PATH,
          url: buildAuthUrl(LOGOUT_PATH),
        }
      : null,
  };
}

export function previewLoginResponse(payload) {
  return normalizeTokenResponse(payload);
}
