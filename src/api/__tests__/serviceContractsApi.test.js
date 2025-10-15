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
const serviceContractsApiModule = await import("../serviceContractsApi.js");

const apiClient = apiClientModule.default;
const { listServiceContracts, createServiceContract, updateServiceContract, deleteServiceContract } = serviceContractsApiModule;

describe("serviceContractsApi", () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.patch.mockReset();
    apiClient.delete.mockReset();
  });

  it("listServiceContracts normalizes payload", async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        idservicio_contrato: 9,
        cantidad: 15,
        contratoCentroAtencion: {
          id: 42,
          contrato: { id: 2, nombre: "Contrato A" },
          centroAtencion: { id: 5, nombre: "Centro Norte" },
        },
        servicio: { id: 5, nombre: "Radiograf?a" },
      },
    ]);

    const { serviceContracts, raw } = await listServiceContracts();

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.get.mock.calls[0];
    expect(url).toMatch(/\/api\/servicio-contratos$/);
    expect(options).toEqual({ signal: undefined, query: undefined });
    expect(raw).toHaveLength(1);
    expect(serviceContracts).toEqual([
      {
        idServicioContrato: 9,
        contratoId: 2,
        servicioId: 5,
        contratoCentroAtencionId: 42,
        centroId: 5,
        contratoNombre: "Contrato A",
        servicioNombre: "Radiograf?a",
        centroNombre: "Centro Norte",
        cantidad: 15,
      },
    ]);
  });

  it("createServiceContract sends payload", async () => {
    apiClient.post.mockResolvedValueOnce({
      idservicio_contrato: 10,
      cantidad: 20,
      contratoCentroAtencion: {
        id: 42,
        contrato: { id: 1, nombre: "Contrato A" },
        centroAtencion: { id: 3, nombre: "Centro Norte" },
      },
      servicio: { id: 3, nombre: "Ultrasonido" },
    });

    const { serviceContract } = await createServiceContract({ contractCenterId: 42, servicioId: 3, cantidad: 20 });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.post.mock.calls[0];
    expect(url).toMatch(/\/api\/servicio-contratos$/);
    expect(options.data).toEqual({
      contratoCentroAtencionId: 42,
      servicioId: 3,
      cantidad: 20,
    });
    expect(serviceContract).toMatchObject({ contratoCentroAtencionId: 42, servicioId: 3, cantidad: 20 });
  });

  it("updateServiceContract forwards data", async () => {
    apiClient.patch.mockResolvedValueOnce({
      idservicio_contrato: 11,
      cantidad: 25,
      contratoCentroAtencion: {
        id: 42,
        contrato: { id: 1 },
        centroAtencion: { id: 3 },
      },
      servicio: { id: 3 },
    });

    const { serviceContract } = await updateServiceContract(11, { contractCenterId: 42, cantidad: 25 });

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.patch.mock.calls[0];
    expect(url).toMatch(/\/api\/servicio-contratos\/11$/);
    expect(options.data).toEqual({
      contratoCentroAtencionId: 42,
      cantidad: 25,
    });
    expect(serviceContract).toMatchObject({ idServicioContrato: 11, contratoCentroAtencionId: 42, cantidad: 25 });
  });

  it("deleteServiceContract removes relation", async () => {
    apiClient.delete.mockResolvedValueOnce(undefined);
    await deleteServiceContract(12);
    expect(apiClient.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/servicio-contratos\/12$/), { signal: undefined });
  });
});
