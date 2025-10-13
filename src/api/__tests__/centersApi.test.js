import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../httpClient.js", () => {
  const httpClient = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
  class HttpError extends Error {
    constructor(message, response, payload) {
      super(message);
      this.response = response;
      this.payload = payload;
    }
  }
  return {
    default: httpClient,
    apiClient: httpClient,
    HttpError,
  };
});

const apiClientModule = await import("../httpClient.js");
const centersApiModule = await import("../centersApi.js");

const apiClient = apiClientModule.default;
const { listCenters, createCenter, updateCenter, deleteCenter } = centersApiModule;

describe("centersApi", () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.patch.mockReset();
    apiClient.delete.mockReset();
  });

  it("listCenters normalizes payload", async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        idcentro_atencion: 1,
        nombre: "Centro Norte",
        administrador: "Ana",
        director: "Luis",
      },
    ]);

    const { centers, raw } = await listCenters();

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.get.mock.calls[0];
    expect(url).toMatch(/\/api\/centros$/);
    expect(options).toEqual({ signal: undefined, query: undefined });
    expect(raw).toHaveLength(1);
    expect(centers).toEqual([
      {
        idCentro: 1,
        nombre: "Centro Norte",
        administrador: "Ana",
        director: "Luis",
      },
    ]);
  });

  it("createCenter trims fields and requires nombre", async () => {
    apiClient.post.mockResolvedValueOnce({
      idcentro_atencion: 10,
      nombre: "Centro Norte",
      administrador: null,
      director: "Juan",
    });

    const { center } = await createCenter({
      nombre: "  Centro Norte  ",
      administrador: " ",
      director: " Juan ",
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.post.mock.calls[0];
    expect(url).toMatch(/\/api\/centros$/);
    expect(options.data).toEqual({
      nombre: "Centro Norte",
      administrador: null,
      director: "Juan",
    });
    expect(center).toEqual({
      idCentro: 10,
      nombre: "Centro Norte",
      administrador: "",
      director: "Juan",
    });
  });

  it("updateCenter uses PATCH and forwards trimmed data", async () => {
    apiClient.patch.mockResolvedValueOnce({
      idcentro_atencion: 7,
      nombre: "Centro Sur",
      administrador: "Maria",
      director: "Pedro",
    });

    const { center } = await updateCenter(7, {
      administrador: " Maria ",
      director: null,
    });

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.patch.mock.calls[0];
    expect(url).toMatch(/\/api\/centros\/7$/);
    expect(options.data).toEqual({
      administrador: "Maria",
      director: null,
    });
    expect(center).toMatchObject({ idCentro: 7, administrador: "Maria" });
  });

  it("deleteCenter removes resource", async () => {
    apiClient.delete.mockResolvedValueOnce(undefined);
    await deleteCenter(5);
    expect(apiClient.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/centros\/5$/), { signal: undefined });
  });
});
