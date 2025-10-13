import collection from "../PostmanCollection/Clinica API.postman_collection.json" assert { type: "json" };

function toKeyValueArray(list = []) {
  return Array.isArray(list)
    ? list
        .filter((entry) => entry && typeof entry.key === "string")
        .map((entry) => ({ key: entry.key, value: entry.value ?? "" }))
    : [];
}

function createVariableIndex(vars = []) {
  const index = {};
  for (const entry of toKeyValueArray(vars)) {
    const key = entry.key.trim();
    if (key && !(key in index)) {
      index[key] = entry.value;
    }
  }
  return index;
}

function stripBaseVariable(rawUrl = "") {
  if (!rawUrl) return "";
  return rawUrl
    .replace(/\{\{\s*base_url\s*\}\}/gi, "")
    .replace(/\{\{\s*baseUrl\s*\}\}/gi, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^[^/]*\//, "/")
    .replace(/\/+/g, "/")
    .replace(/\/?$/, (match) => (match === "/" ? "/" : ""));
}

function normalisePath(rawUrl = "") {
  if (!rawUrl) return "";
  const stripped = stripBaseVariable(rawUrl);
  if (!stripped.startsWith("/")) {
    return `/${stripped}`.replace(/\/+/g, "/");
  }
  return stripped.replace(/\/+/g, "/");
}

function flattenItems(items = [], parent = []) {
  const output = [];
  for (const item of items) {
    if (!item) continue;
    const current = parent.concat(item.name ? String(item.name) : "");
    if (Array.isArray(item.item)) {
      output.push(...flattenItems(item.item, current));
    } else if (item.request) {
      output.push({
        name: item.name ?? "",
        namePath: current,
        request: item.request,
        responses: item.response ?? [],
      });
    }
  }
  return output;
}

function summariseRequest(entry) {
  if (!entry || !entry.request) return null;
  const { request } = entry;
  const headers = toKeyValueArray(request.header);
  const body = request.body ?? null;
  const url = request.url ?? {};
  const rawUrl = typeof url === "string" ? url : url.raw ?? "";

  return {
    name: entry.name ?? "",
    group: entry.namePath ?? [],
    method: (request.method || "GET").toUpperCase(),
    url: rawUrl,
    path: normalisePath(rawUrl),
    headers,
    body,
    description: request.description ?? entry.description ?? "",
  };
}

function findAuthEntries(flatItems) {
  const authGroup = flatItems.filter((item) =>
    item.namePath.some((segment) => typeof segment === "string" && segment.toLowerCase().includes("autentic"))
  );
  const login = authGroup.find((item) => /login/i.test(item.name));
  const refresh = authGroup.find((item) => /refresh|renueva|token/i.test(item.name));
  const logout = authGroup.find((item) => /logout|revoke|cerrar/i.test(item.name));

  return {
    login: summariseRequest(login),
    refresh: summariseRequest(refresh),
    logout: summariseRequest(logout),
  };
}

const POSTMAN_VARIABLES = createVariableIndex(collection.variable ?? []);

const FLAT_ITEMS = flattenItems(collection.item ?? []);

const AUTH_ENDPOINTS = findAuthEntries(FLAT_ITEMS);

const DEFAULT_AUTH_HEADER = collection.auth?.type === "bearer" ? "Bearer" : collection.auth?.type ?? null;

export const postmanVariables = POSTMAN_VARIABLES;

export const authEndpoints = {
  login: AUTH_ENDPOINTS.login,
  refresh: AUTH_ENDPOINTS.refresh,
  logout: AUTH_ENDPOINTS.logout,
  expectedAuthHeader: DEFAULT_AUTH_HEADER,
};

export function getPostmanEndpointSummary() {
  const rows = [];
  for (const key of ["login", "refresh", "logout"]) {
    const entry = AUTH_ENDPOINTS[key];
    if (!entry) continue;
    rows.push({
      type: key,
      name: entry.name,
      method: entry.method,
      url: entry.url,
      path: entry.path,
      description: entry.description ?? "",
    });
  }
  return rows;
}

export function resolveAuthPath(defaultPath) {
  const loginPath = AUTH_ENDPOINTS.login?.path;
  if (loginPath) return loginPath;
  return normalisePath(defaultPath ?? "/auth/login");
}

export function resolveLogoutPath(defaultPath) {
  const logoutPath = AUTH_ENDPOINTS.logout?.path;
  if (logoutPath) return logoutPath;
  return normalisePath(defaultPath ?? "/auth/logout");
}
