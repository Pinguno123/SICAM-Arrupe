import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../httpClient.js", () => {
  const httpClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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
const servicesApiModule = await import("../servicesApi.js");

const apiClient = apiClientModule.default;
const { listServices, createService, updateService, deleteService } = servicesApiModule;

describe("servicesApi", () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.put.mockReset();
    apiClient.delete.mockReset();
  });

  it("listServices normalizes response", async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        idservicio: 2,
        nombre: "Radiografía",
        precio: "45.50",
      },
    ]);

    const { services, raw } = await listServices();

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.get.mock.calls[0];
    expect(url).toMatch(/\/api\/servicios$/);
    expect(options).toEqual({ signal: undefined, query: undefined });
    expect(raw).toHaveLength(1);
    expect(services).toEqual([
      {
        idServicio: 2,
        nombre: "Radiografía",
        precio: 45.5,
      },
    ]);
  });

  it("createService trims and validates payload", async () => {
    apiClient.post.mockResolvedValueOnce({
      idservicio: 7,
      nombre: "Ultrasonido",
      precio: 30,
    });

    const { service } = await createService({ nombre: "  Ultrasonido  ", precio: "30.00" });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.post.mock.calls[0];
    expect(url).toMatch(/\/api\/servicios$/);
    expect(options.data).toEqual({ nombre: "Ultrasonido", precio: 30 });
    expect(service).toEqual({ idServicio: 7, nombre: "Ultrasonido", precio: 30 });
  });

  it("updateService forwards fields", async () => {
    apiClient.put.mockResolvedValueOnce({
      idservicio: 11,
      nombre: "Mamografía",
      precio: 55.5,
    });

    const { service } = await updateService(11, { precio: "55.50" });

    expect(apiClient.put).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.put.mock.calls[0];
    expect(url).toMatch(/\/api\/servicios\/11$/);
    expect(options.data).toEqual({ precio: 55.5 });
    expect(service).toMatchObject({ idServicio: 11, precio: 55.5 });
  });

  it("deleteService removes resource", async () => {
    apiClient.delete.mockResolvedValueOnce(undefined);
    await deleteService(4);
    expect(apiClient.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/servicios\/4$/), { signal: undefined });
  });
});
