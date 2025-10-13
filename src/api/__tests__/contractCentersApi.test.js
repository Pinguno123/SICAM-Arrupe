import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../httpClient.js", () => {
  const httpClient = {
    get: vi.fn(),
    post: vi.fn(),
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
const contractCentersApiModule = await import("../contractCentersApi.js");

const apiClient = apiClientModule.default;
const { listContractCenters, createContractCenter, deleteContractCenter } = contractCentersApiModule;

describe("contractCentersApi", () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.delete.mockReset();
  });

  it("listContractCenters normalizes payload", async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        idcontrato_centro: 5,
        contrato: { id: 2, nombre: "Contrato A" },
        centroAtencion: { id: 8, nombre: "Centro Norte" },
        activo: true,
      },
    ]);

    const { contractCenters, raw } = await listContractCenters();

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.get.mock.calls[0];
    expect(url).toMatch(/\/api\/contrato-centros$/);
    expect(options).toEqual({ signal: undefined, query: undefined });
    expect(raw).toHaveLength(1);
    expect(contractCenters).toEqual([
      {
        idContratoCentro: 5,
        contratoId: 2,
        centroId: 8,
        contratoNombre: "Contrato A",
        centroNombre: "Centro Norte",
        activo: true,
      },
    ]);
  });

  it("createContractCenter sends nested payload", async () => {
    apiClient.post.mockResolvedValueOnce({
      idcontrato_centro: 6,
      contrato: { id: 2, nombre: "Contrato A" },
      centroAtencion: { id: 3, nombre: "Centro Norte" },
      activo: true,
    });

    const { contractCenter } = await createContractCenter({ contratoId: 2, centroId: 3 });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.post.mock.calls[0];
    expect(url).toMatch(/\/api\/contrato-centros$/);
    expect(options.data).toEqual({
      contrato: { id: 2 },
      contratoId: 2,
      centroAtencion: { id: 3 },
      centroId: 3,
      activo: true,
    });
    expect(contractCenter).toMatchObject({ contratoId: 2, centroId: 3 });
  });

  it("deleteContractCenter removes relation", async () => {
    apiClient.delete.mockResolvedValueOnce(undefined);
    await deleteContractCenter(4);
    expect(apiClient.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/contrato-centros\/4$/), { signal: undefined });
  });
});
