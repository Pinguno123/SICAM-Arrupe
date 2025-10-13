const DEFAULT_TOKEN_TYPE = "Bearer";
const DEFAULT_EXPIRY_BUFFER = 60;

function firstValue(source, candidates = []) {
  if (!source || typeof source !== "object") return undefined;
  for (const candidate of candidates) {
    const path = candidate.split(".");
    let value = source;
    let found = true;
    for (const segment of path) {
      if (value && typeof value === "object" && segment in value) {
        value = value[segment];
      } else {
        found = false;
        break;
      }
    }
    if (found && value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function toStringValue(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toNumberValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toTimestamp(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : null;
    }
    const ms = Date.parse(trimmed);
    if (Number.isFinite(ms)) {
      return ms;
    }
  }
  return null;
}

function decodeJwtExpiration(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1];
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const base64 = normalized + padding;
    let json = "";
    if (typeof atob === "function") {
      json = atob(base64);
    } else if (typeof Buffer !== "undefined") {
      json = Buffer.from(base64, "base64").toString("utf8");
    } else {
      return null;
    }
    const data = JSON.parse(json);
    const exp = typeof data === "object" ? data.exp : null;
    return typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : null;
  } catch (_error) {
    return null;
  }
}

export function normalizeTokenResponse(payload) {
  if (!payload) {
    return {
      accessToken: "",
      refreshToken: "",
      tokenType: DEFAULT_TOKEN_TYPE,
      expiresIn: null,
      expiresAt: null,
      raw: payload,
    };
  }

  if (typeof payload === "string") {
    return {
      accessToken: payload.trim(),
      refreshToken: "",
      tokenType: DEFAULT_TOKEN_TYPE,
      expiresIn: null,
      expiresAt: null,
      raw: payload,
    };
  }

  const nested = typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object" ? payload.data : null;

  const accessToken = toStringValue(
    firstValue(payload, ["access_token", "accessToken", "token", "jwt", "id_token", "data.access_token"])
      ?? firstValue(nested, ["access_token", "accessToken", "token", "jwt", "id_token"])
  );

  const refreshToken = toStringValue(
    firstValue(payload, ["refresh_token", "refreshToken", "data.refresh_token"])
      ?? firstValue(nested, ["refresh_token", "refreshToken"])
  );

  const tokenType = toStringValue(
    firstValue(payload, ["token_type", "tokenType", "type", "data.token_type"])
      ?? firstValue(nested, ["token_type", "tokenType", "type"])
  ) || DEFAULT_TOKEN_TYPE;

  const expiresIn = toNumberValue(
    firstValue(payload, ["expires_in", "expiresIn", "expires", "ttl", "data.expires_in"])
      ?? firstValue(nested, ["expires_in", "expiresIn", "expires", "ttl"])
  );

  const expiresAtRaw = toTimestamp(
    firstValue(payload, ["expires_at", "expiresAt", "expiration", "data.expires_at"])
      ?? firstValue(nested, ["expires_at", "expiresAt", "expiration"])
  );

  const normalized = {
    accessToken,
    refreshToken,
    tokenType: tokenType || DEFAULT_TOKEN_TYPE,
    expiresIn,
    expiresAt: expiresAtRaw,
    raw: payload,
  };

  return normalized;
}

class TokenManager {
  constructor() {
    this.clear();
    this.refreshHandler = null;
    this.loginHandler = null;
    this.refreshInFlight = null;
    this.persistRefreshToken = false;
  }

  setHandlers({ refresh, login } = {}) {
    if (typeof refresh === "function") {
      this.refreshHandler = refresh;
    }
    if (typeof login === "function") {
      this.loginHandler = login;
    }
  }

  set(rawTokens, options = {}) {
    const now = Date.now();
    const normalized = normalizeTokenResponse(rawTokens);
    if (!normalized.accessToken) {
      throw new Error("TokenManager.set: missing access token in response");
    }

    this.accessToken = normalized.accessToken;
    this.refreshToken = normalized.refreshToken || "";
    this.tokenType = normalized.tokenType || DEFAULT_TOKEN_TYPE;
    this.rawTokens = normalized.raw;

    let expiresAt = normalized.expiresAt ?? null;
    if (typeof expiresAt === "number" && expiresAt < 1e12) {
      expiresAt = expiresAt * 1000;
    }

    if (!expiresAt && typeof normalized.expiresIn === "number" && normalized.expiresIn >= 0) {
      const buffer = options.expiryBufferSeconds ?? DEFAULT_EXPIRY_BUFFER;
      const effective = Math.max(0, normalized.expiresIn - buffer);
      expiresAt = now + effective * 1000;
    }

    if (!expiresAt) {
      expiresAt = decodeJwtExpiration(this.accessToken);
      if (expiresAt) {
        const buffer = options.expiryBufferSeconds ?? DEFAULT_EXPIRY_BUFFER;
        expiresAt = Math.max(0, expiresAt - buffer * 1000);
      }
    }

    this.expiresAt = typeof expiresAt === "number" && Number.isFinite(expiresAt) ? expiresAt : null;

    if (options.credentials && typeof options.credentials === "object") {
      this.credentials = { ...options.credentials };
    }

    this.persistRefreshToken = options.persistRefreshToken === true;
    if (this.persistRefreshToken && this.refreshToken) {
      persistRefreshCookie(this.refreshToken, options.refreshCookieName);
    } else {
      clearRefreshCookie(options?.refreshCookieName);
    }

    return normalized;
  }

  getAuthHeader() {
    if (!this.accessToken) return null;
    const scheme = this.tokenType || DEFAULT_TOKEN_TYPE;
    return `${scheme} ${this.accessToken}`.trim();
  }

  isExpired(skewSeconds = DEFAULT_EXPIRY_BUFFER) {
    if (!this.accessToken) return true;
    if (!this.expiresAt) return false;
    const skew = Math.max(0, skewSeconds) * 1000;
    return Date.now() + skew >= this.expiresAt;
  }

  hasRefreshToken() {
    return Boolean(this.refreshToken);
  }

  setRefreshHandler(handler) {
    this.refreshHandler = typeof handler === "function" ? handler : null;
  }

  setLoginHandler(handler) {
    this.loginHandler = typeof handler === "function" ? handler : null;
  }

  setCredentials(credentials) {
    if (credentials && typeof credentials === "object") {
      this.credentials = { ...credentials };
    }
  }

  canReauthenticate() {
    return Boolean(this.credentials && this.loginHandler);
  }

  async refreshIfNeeded({ skewSeconds = DEFAULT_EXPIRY_BUFFER, force = false } = {}) {
    if (!this.accessToken) {
      return false;
    }

    if (!force && !this.isExpired(skewSeconds)) {
      return false;
    }

    return this.refresh({ force });
  }

  async refresh({ force = false, reauthenticateOnFail = true } = {}) {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const task = async () => {
      let lastError = null;

      if (this.refreshHandler) {
        try {
          const result = await this.refreshHandler({ tokenManager: this, force });
          if (result) {
            return result;
          }
        } catch (error) {
          lastError = error;
          if (!reauthenticateOnFail || !this.canReauthenticate()) {
            throw error;
          }
        }
      }

      if (reauthenticateOnFail && this.canReauthenticate()) {
        return this.loginHandler({ ...this.credentials, reason: force ? "force-refresh" : "refresh" });
      }

      if (lastError) {
        throw lastError;
      }

      throw new Error("TokenManager.refresh: no refresh handler or credentials available");
    };

    this.refreshInFlight = task().finally(() => {
      this.refreshInFlight = null;
    });

    return this.refreshInFlight;
  }

  clear({ keepCredentials = false, refreshCookieName } = {}) {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenType = DEFAULT_TOKEN_TYPE;
    this.expiresAt = null;
    this.rawTokens = null;
    this.refreshInFlight = null;
    if (!keepCredentials) {
      this.credentials = null;
    }
    clearRefreshCookie(refreshCookieName);
  }
}

function persistRefreshCookie(value, cookieName = "refresh_token") {
  if (typeof document === "undefined" || typeof document.cookie !== "string") {
    return;
  }
  const safeValue = encodeURIComponent(value);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${cookieName}=${safeValue}; Expires=${expires}; Path=/; Secure; SameSite=Lax`;
}

function clearRefreshCookie(cookieName = "refresh_token") {
  if (typeof document === "undefined" || typeof document.cookie !== "string") {
    return;
  }
  document.cookie = `${cookieName}=; Max-Age=0; Path=/; Secure; SameSite=Lax`;
}

export const tokenManager = new TokenManager();

export default tokenManager;
