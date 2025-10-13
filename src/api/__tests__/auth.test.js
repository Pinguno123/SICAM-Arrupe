import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { login, logout } from "../authService.js";
import apiClient from "../httpClient.js";
import tokenManager from "../tokenManager.js";

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function statusResponse(status) {
  return new Response(null, { status });
}

let originalRefreshHandler;
let originalLoginHandler;

beforeEach(() => {
  originalRefreshHandler = tokenManager.refreshHandler;
  originalLoginHandler = tokenManager.loginHandler;
  tokenManager.clear({ keepCredentials: false });
  global.fetch = vi.fn();
});

afterEach(() => {
  tokenManager.clear({ keepCredentials: false });
  tokenManager.setRefreshHandler(originalRefreshHandler);
  tokenManager.setLoginHandler(originalLoginHandler);
  vi.restoreAllMocks();
});

describe("auth flow", () => {
  it("logs in and stores tokens", async () => {
    const mock = global.fetch;
    mock.mockResolvedValueOnce(
      jsonResponse({
        access_token: "token-123",
        refresh_token: "refresh-xyz",
        expires_in: 3600,
        token_type: "Bearer",
      })
    );

    const tokens = await login({ username: "admin", password: "secret" });

    expect(mock).toHaveBeenCalledTimes(1);
    const [url, init] = mock.mock.calls[0];
    expect(url).toContain("/auth/login");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("username=admin&password=secret");
    expect(tokens.accessToken).toBe("token-123");
    expect(tokenManager.getAuthHeader()).toBe("Bearer token-123");
  });

  it("attaches Authorization header on apiClient requests", async () => {
    tokenManager.set({
      access_token: "abc-token",
      refresh_token: "refresh",
      expires_in: 3600,
    });

    const mock = global.fetch;
    mock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await apiClient.get("https://api.example.com/data");

    expect(mock).toHaveBeenCalledTimes(1);
    const [, init] = mock.mock.calls[0];
    expect(init.headers.get("Authorization")).toBe("Bearer abc-token");
    expect(result).toEqual({ ok: true });
  });

  it("refreshes token once on 401 responses", async () => {
    tokenManager.set({
      access_token: "old-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
    });

    tokenManager.setRefreshHandler(async () => {
      return tokenManager.set({
        access_token: "new-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
      });
    });

    const mock = global.fetch;
    mock
      .mockResolvedValueOnce(statusResponse(401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const payload = await apiClient.get("https://api.example.com/protected");

    expect(mock).toHaveBeenCalledTimes(2);
    const firstCallHeaders = mock.mock.calls[0][1].headers;
    expect(firstCallHeaders.get("Authorization")).toBe("Bearer old-token");
    const secondCallHeaders = mock.mock.calls[1][1].headers;
    expect(secondCallHeaders.get("Authorization")).toBe("Bearer new-token");
    expect(payload).toEqual({ ok: true });
  });

  it("clears tokens on logout", async () => {
    tokenManager.set({
      access_token: "logout-token",
      refresh_token: "refresh",
      expires_in: 3600,
    });

    expect(tokenManager.getAuthHeader()).toBe("Bearer logout-token");

    await logout({ withServerRevoke: false });

    expect(tokenManager.getAuthHeader()).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
