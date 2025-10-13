import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../httpClient.js", () => {
  const httpClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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
const contractsApiModule = await import("../contractsApi.js");

const apiClient = apiClientModule.default;
const { listContracts, createContract, updateContract, deleteContract } = contractsApiModule;

describe("contractsApi", () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.put.mockReset();
    apiClient.patch.mockReset();
    apiClient.delete.mockReset();
  });

  it("listContracts normalizes results", async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        id: 5,
        codigo: "CON-05",
        nombre: "Contrato Demo",
        estado: "ACTIVO",
      },
    ]);

    const { contracts, raw } = await listContracts();

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.get.mock.calls[0];
    expect(url).toMatch(/\/api$/);
    expect(options).toEqual({ signal: undefined, query: undefined });
    expect(raw).toHaveLength(1);
    expect(contracts).toEqual([
      {
        idContrato: 5,
        nombre: "Contrato Demo",
        codigo: "CON-05",
        estado: "ACTIVO",
        descripcion: "",
        fecha_inicio: "",
        fecha_fin: "",
      },
    ]);
  });

  it("createContract sends sanitized name and default state", async () => {
    apiClient.post.mockResolvedValueOnce({
      idContrato: 12,
      codigo: "CON-12",
      nombre: "CON-12",
      estado: "activo",
    });

    const { contract } = await createContract({ nombre: "  CON-12  " });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.post.mock.calls[0];
    expect(url).toMatch(/\/api$/);
    expect(options.data).toEqual({
      codigo: "CON-12",
      nombre: "CON-12",
      estado: "activo",
    });
    expect(contract).toEqual({
      idContrato: 12,
      nombre: "CON-12",
      codigo: "CON-12",
      estado: "activo",
      descripcion: "",
      fecha_inicio: "",
      fecha_fin: "",
    });
  });

  it("updateContract forwards provided fields", async () => {
    apiClient.patch.mockResolvedValueOnce({
      idContrato: 33,
      codigo: "CON-33",
      nombre: "Contrato 33",
      estado: "suspendido",
    });

    const { contract } = await updateContract(33, {
      nombre: "Contrato 33",
      estado: "suspendido",
    });

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.patch.mock.calls[0];
    expect(url).toMatch(/\/api\/33$/);
    expect(options.data).toEqual({
      nombre: "Contrato 33",
      estado: "suspendido",
    });
    expect(contract).toMatchObject({ idContrato: 33, estado: "suspendido" });
  });

  it("deleteContract removes resource", async () => {
    apiClient.delete.mockResolvedValueOnce(undefined);
    await deleteContract(44);
    expect(apiClient.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/44$/), { signal: undefined });
  });
});
