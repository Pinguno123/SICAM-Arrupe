import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { login as performLogin, logout as performLogout } from "../api/authService.js";
import tokenManager from "../api/tokenManager.js";
import { can as roleCan } from "../security/permissions";

const STORAGE_KEY = "clinic.auth.session";
const VALID_ROLES = new Set(["DIRECTOR", "ADMINISTRADOR", "RECEPCIONISTA", "LICENCIADO"]);

function safeAtob(input) {
  if (!input) {
    return "";
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.atob === "function") {
    return globalThis.atob(input);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(input, "base64").toString("utf8");
  }
  throw new Error("Base64 decoder not available in this environment");
}

function decodeJwtExpiry(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }
  const [, payload = ""] = token.split(".");
  if (!payload) {
    return null;
  }
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const decoded = safeAtob(normalized + padding);
    const data = JSON.parse(decoded);
    if (data && typeof data.exp === "number" && Number.isFinite(data.exp)) {
      return data.exp * 1000;
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function parseRole(rawRole) {
  if (typeof rawRole !== "string") {
    return null;
  }
  const tokens = rawRole
    .split(/[\s|,/]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  for (const token of tokens) {
    const normalized = token.startsWith("ROLE_") ? token.slice(5) : token;
    if (VALID_ROLES.has(normalized)) {
      return normalized;
    }
  }
  return null;
}

function extractUserId(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidates = [
    payload.userId,
    payload.user_id,
    payload.usuarioId,
    payload.idUsuario,
    payload?.user?.id,
    payload?.usuario?.id,
    payload?.data?.userId,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) {
      continue;
    }
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
}

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadStoredSession() {
  if (!hasStorage()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const token = typeof data.token === "string" && data.token ? data.token : "";
    const role = parseRole(data.role);
    const userId = extractUserId(data) ?? (Number.isFinite(Number(data.userId)) ? Number(data.userId) : null);
    const expiresAt = Number.isFinite(Number(data.expiresAt)) ? Number(data.expiresAt) : null;

    if (!token || !role || !Number.isFinite(userId ?? NaN)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (expiresAt && Date.now() > expiresAt) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      userId,
      role,
      token,
      expiresAt: expiresAt ?? null,
    };
  } catch (_error) {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persistSession(session) {
  if (!hasStorage()) {
    return;
  }
  if (!session || !session.token || !session.role || !session.userId) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const payload = JSON.stringify({
    userId: session.userId,
    role: session.role,
    token: session.token,
    expiresAt: session.expiresAt ?? null,
  });
  window.localStorage.setItem(STORAGE_KEY, payload);
}

function clearStoredSession() {
  if (hasStorage()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

function isSameSession(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.userId === b.userId &&
    a.role === b.role &&
    a.token === b.token &&
    (a.expiresAt ?? null) === (b.expiresAt ?? null)
  );
}

function deriveSessionFromTokens(normalized, previousSession) {
  const accessToken =
    normalized?.accessToken ||
    tokenManager.accessToken ||
    previousSession?.token ||
    "";
  if (!accessToken) {
    return null;
  }

  const raw =
    normalized && typeof normalized.raw === "object" && normalized.raw !== null
      ? normalized.raw
      : {};

  const role =
    parseRole(
      raw.rolNombre ??
        raw.rol ??
        raw.role ??
        raw.roleNombre ??
        raw.roleName ??
        raw.nombreRol,
    ) ?? previousSession?.role ?? null;

  const userId = extractUserId(raw) ?? previousSession?.userId ?? null;

  const expiresAt =
    decodeJwtExpiry(accessToken) ??
    normalized?.expiresAt ??
    tokenManager.expiresAt ??
    previousSession?.expiresAt ??
    null;

  if (!role || !userId) {
    if (!previousSession) {
      return null;
    }
    if (
      previousSession.token === accessToken &&
      (expiresAt == null || previousSession.expiresAt === expiresAt)
    ) {
      return previousSession;
    }
    return {
      ...previousSession,
      token: accessToken,
      expiresAt: expiresAt ?? previousSession.expiresAt ?? null,
    };
  }

  const nextSession = {
    userId,
    role,
    token: accessToken,
    expiresAt: expiresAt ?? null,
  };

  if (previousSession && isSameSession(previousSession, nextSession)) {
    return previousSession;
  }

  return nextSession;
}

function resolveLandingRoute(_role) {
  return "/panel";
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => loadStoredSession());
  const [loading, setLoading] = useState(false);
  const sessionRef = useRef(session);

  const applySession = useCallback((nextSession) => {
    setSession((prev) => {
      if (nextSession === null) {
        return null;
      }
      if (prev && isSameSession(prev, nextSession)) {
        return prev;
      }
      return nextSession;
    });
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!session || !session.token || !session.role || !session.userId) {
      clearStoredSession();
    } else {
      persistSession(session);
    }
  }, [session]);

  useEffect(() => {
    const originalSet = tokenManager.set.bind(tokenManager);
    const originalClear = tokenManager.clear.bind(tokenManager);

    function patchedSet(rawTokens, options) {
      const normalized = originalSet(rawTokens, options);
      const nextSession = deriveSessionFromTokens(normalized, sessionRef.current);
      if (nextSession || sessionRef.current) {
        applySession(nextSession);
      }
      return normalized;
    }

    function patchedClear(...args) {
      const result = originalClear(...args);
      applySession(null);
      return result;
    }

    tokenManager.set = patchedSet;
    tokenManager.clear = patchedClear;

    const existing = sessionRef.current;
    if (existing?.token) {
      try {
        patchedSet({ token: existing.token });
      } catch (_error) {
        originalClear();
        applySession(null);
      }
    }

    return () => {
      tokenManager.set = originalSet;
      tokenManager.clear = originalClear;
    };
  }, [applySession]);

  const login = useCallback(
    async ({ username, password, remember = true } = {}) => {
      const trimmedUser = username?.trim();
      if (!trimmedUser || !password) {
        const error = new Error("Credenciales incompletas");
        error.code = "INVALID_CREDENTIALS";
        throw error;
      }

      setLoading(true);
      try {
        const normalized = await performLogin({
          username: trimmedUser,
          password,
          rememberRefreshToken: remember,
          persistCredentials: true,
        });
        const nextSession = deriveSessionFromTokens(normalized, null);
        if (!nextSession || !nextSession.role || !nextSession.userId) {
          const error = new Error("No se pudo determinar el rol de la sesión");
          error.code = "INVALID_SESSION";
          throw error;
        }
        applySession(nextSession);
        return nextSession;
      } catch (error) {
        applySession(null);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [applySession],
  );

  const logout = useCallback(
    async ({ withServerRevoke = true } = {}) => {
      try {
        await performLogout({ withServerRevoke });
      } finally {
        applySession(null);
      }
    },
    [applySession],
  );

  const currentRole = session?.role ?? null;
  const isAuthenticated = Boolean(session?.token);

  const hasPermission = useCallback(
    (permission) => {
      if (!permission) {
        return true;
      }
      if (!currentRole) {
        return false;
      }
      return roleCan(currentRole, permission);
    },
    [currentRole],
  );

  const hasAllPermissions = useCallback(
    (permissions) => {
      if (!permissions || permissions.length === 0) {
        return true;
      }
      if (!currentRole) {
        return false;
      }
      return permissions.every((permission) => roleCan(currentRole, permission));
    },
    [currentRole],
  );

  const hasAnyPermissions = useCallback(
    (permissions) => {
      if (!permissions || permissions.length === 0) {
        return false;
      }
      if (!currentRole) {
        return false;
      }
      return permissions.some((permission) => roleCan(currentRole, permission));
    },
    [currentRole],
  );

  const value = useMemo(
    () => ({
      status: isAuthenticated ? "authenticated" : "anonymous",
      isAuthenticated,
      isLoading: loading,
      login,
      logout,
      token: session?.token ?? tokenManager.accessToken ?? null,
      userId: session?.userId ?? null,
      role: currentRole,
      expiresAt: session?.expiresAt ?? null,
      can: hasPermission,
      hasPermission,
      hasAllPermissions,
      hasAnyPermissions,
      landingRoute: resolveLandingRoute(currentRole),
    }),
    [
      currentRole,
      hasAllPermissions,
      hasAnyPermissions,
      hasPermission,
      isAuthenticated,
      loading,
      login,
      logout,
      session?.expiresAt,
      session?.token,
      session?.userId,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
