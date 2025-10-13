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
const patientsApiModule = await import("../patientsApi.js");

const apiClient = apiClientModule.default;
const { createPatient, deletePatient, listPatients, updatePatient } = patientsApiModule;

describe("patientsApi", () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.put.mockReset();
    apiClient.patch.mockReset();
    apiClient.delete.mockReset();
  });

  it("listPatients normalizes response arrays", async () => {
    apiClient.get.mockResolvedValueOnce([
      {
        id: 10,
        primerNombre: "Maria",
        apellidos: "Perez",
        genero: "f",
        fechaNacimiento: "1991-05-10",
        telefono: "2222-3333",
      },
    ]);

    const { patients, raw } = await listPatients();

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.get.mock.calls[0];
    expect(url).toMatch(/\/api\/pacientes$/);
    expect(options).toEqual({ signal: undefined, query: undefined });
    expect(raw).toHaveLength(1);
    expect(patients).toEqual([
      {
        idPaciente: 10,
        nombre: "Maria",
        apellido: "Perez",
        genero: "F",
        fecha_nacimiento: "1991-05-10",
        dui: "",
        numero_afiliacion: "",
        telefono_fijo: "2222-3333",
        telefono_celular: "",
        correo_electronico: "",
        direccion: "",
      },
    ]);
  });

  it("createPatient sends normalized payload and returns mapped patient", async () => {
    apiClient.post.mockResolvedValueOnce({
      idPaciente: 12,
      nombre: "Luis",
      apellido: "Gomez",
      correoElectronico: "luis@example.com",
      telefonoCelular: "7777-8888",
    });

    const { patient } = await createPatient({
      nombre: "Luis",
      apellido: "Gomez",
      genero: "M",
      correo_electronico: "luis@example.com",
      telefono_celular: "7777-8888",
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, options] = apiClient.post.mock.calls[0];
    expect(url).toMatch(/\/api\/pacientes$/);
    expect(options.data).toEqual({
      nombre: "Luis",
      apellido: "Gomez",
      genero: "M",
      fechaNacimiento: null,
      dui: null,
      numeroAfiliacion: null,
      telefonoFijo: null,
      telefonoCelular: "7777-8888",
      correoElectronico: "luis@example.com",
      direccion: null,
    });
    expect(patient).toMatchObject({
      idPaciente: 12,
      nombre: "Luis",
      apellido: "Gomez",
      correo_electronico: "luis@example.com",
      telefono_celular: "7777-8888",
    });
  });

  it("updatePatient calls PATCH with patient id", async () => {
    apiClient.patch.mockResolvedValueOnce({
      idPaciente: 99,
      nombre: "Ana",
      apellido: "Lopez",
    });

    const { patient } = await updatePatient(99, {
      nombre: "Ana",
      apellido: "Lopez",
    });

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    const [url] = apiClient.patch.mock.calls[0];
    expect(url).toMatch(/\/api\/pacientes\/99$/);
    expect(patient).toMatchObject({ idPaciente: 99, nombre: "Ana" });
  });

  it("deletePatient removes resource", async () => {
    apiClient.delete.mockResolvedValueOnce(undefined);
    await deletePatient(5);
    expect(apiClient.delete).toHaveBeenCalledWith(expect.stringMatching(/\/api\/pacientes\/5$/), { signal: undefined });
  });
});
