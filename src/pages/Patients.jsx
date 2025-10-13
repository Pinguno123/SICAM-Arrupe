import { useEffect, useMemo, useState } from "react";
import { HttpError } from "../api/httpClient.js";
import { listPatients, createPatient, updatePatient, deletePatient } from "../api/patientsApi.js";

const TODAY = new Date().toISOString().slice(0, 10);

const EMPTY_PATIENT = {
  nombre: "",
  apellido: "",
  genero: "",
  fecha_nacimiento: "",
  dui: "",
  numero_afiliacion: "",
  telefono_fijo: "",
  telefono_celular: "",
};

function ConfirmDeleteDialog({ patient, onConfirm, onCancel, busy = false }) {
  if (!patient) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Eliminar paciente</h2>
        <p className="mt-2 text-sm text-gray-600">
          Estas seguro que deseas eliminar a <strong>{patient.nombre} {patient.apellido}</strong>? Esta accion no se puede deshacer.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(patient)}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PatientForm({ mode, initialData = EMPTY_PATIENT, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_PATIENT, ...initialData }));
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({ ...EMPTY_PATIENT, ...initialData });
    setError(null);
  }, [initialData]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.nombre.trim() || !form.apellido.trim()) {
      setError("Nombre y apellido son obligatorios");
      return;
    }

    if (!form.genero) {
      setError("Selecciona el genero");
      return;
    }

    if (form.genero && !["M", "F"].includes(form.genero)) {
      setError("Genero debe ser M o F");
      return;
    }

    if (form.fecha_nacimiento && form.fecha_nacimiento > TODAY) {
      setError("La fecha de nacimiento no puede ser futura");
      return;
    }

    setError(null);
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <header className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === "edit" ? "Editar paciente" : "Nuevo paciente"}
          </h2>
          <p className="text-sm text-gray-500">
            Completa los campos requeridos y guarda los cambios.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm text-gray-700">
              <span>Nombre *</span>
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span>Apellido *</span>
              <input
                name="apellido"
                value={form.apellido}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span>Genero</span>
              <select
                name="genero"
                value={form.genero ?? ""}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
              >
                <option value="">Seleccionar</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span>Fecha de nacimiento</span>
              <input
                type="date"
                name="fecha_nacimiento"
                value={form.fecha_nacimiento ?? ""}
                max={TODAY}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span>DUI</span>
              <input
                name="dui"
                value={form.dui ?? ""}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span>No. afiliacion</span>
              <input
                name="numero_afiliacion"
                value={form.numero_afiliacion ?? ""}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span>Telefono fijo</span>
              <input
                name="telefono_fijo"
                value={form.telefono_fijo ?? ""}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-sm text-gray-700">
              <span>Telefono celular</span>
              <input
                name="telefono_celular"
                value={form.telefono_celular ?? ""}
                onChange={handleChange}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [modalMode, setModalMode] = useState(null);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const refreshData = () => setReloadToken((token) => token + 1);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadPatientsData() {
      setLoading(true);
      setError(null);
      try {
        const { patients: loadedPatients } = await listPatients({
          signal: controller.signal,
        });
        if (!cancelled) {
          setPatients(loadedPatients);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cancelled) {
          const message = err instanceof HttpError && err.payload?.message ? err.payload.message : err.message || "Error al cargar pacientes";
          setError(message);
          setPatients([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPatientsData();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadToken]);

  useEffect(() => {
    const bump = () => setReloadToken((token) => token + 1);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };

    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((patient) =>
      [
        patient.nombre,
        patient.apellido,
        patient.genero,
        patient.fecha_nacimiento,
        patient.telefono_celular,
        patient.telefono_fijo,
        patient.numero_afiliacion,
        patient.dui,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [patients, search]);

  const openCreate = () => {
    setSelected(null);
    setModalMode("create");
  };

  const openEdit = (patient) => {
    setSelected(patient);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setSubmitting(false);
  };

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      const patientId = selected?.idPaciente;
      if (modalMode === "edit" && (patientId === null || patientId === undefined)) {
        throw new Error("Paciente sin identificador");
      }

      const response = modalMode === "edit"
        ? await updatePatient(patientId, form)
        : await createPatient(form);

      const normalized = response?.patient ?? null;
      let updatedLocally = false;

      if (modalMode === "edit" && selected) {
        const replacement = normalized && normalized.idPaciente !== null && normalized.idPaciente !== undefined
          ? normalized
          : { ...selected, ...form };
        setPatients((prev) =>
          prev.map((item) => (item.idPaciente === selected.idPaciente ? replacement : item)),
        );
        updatedLocally = true;
      } else if (modalMode !== "edit") {
        if (normalized && normalized.idPaciente !== null && normalized.idPaciente !== undefined) {
          setPatients((prev) => {
            const exists = prev.some((item) => item.idPaciente === normalized.idPaciente);
            return exists
              ? prev.map((item) => (item.idPaciente === normalized.idPaciente ? normalized : item))
              : [normalized, ...prev];
          });
          updatedLocally = true;
        }
      }

      if (!updatedLocally) {
        refreshData();
      }

      setFeedback(modalMode === "edit" ? "Paciente actualizado" : "Paciente creado");
      closeModal();
    } catch (err) {
      const message = err instanceof HttpError && err.payload?.message ? err.payload.message : err.message || "No se pudo guardar";
      setFeedback(message);
      setSubmitting(false);
    }
  };

  const requestDelete = (patient) => {
    setConfirming(patient);
    setFeedback(null);
  };

  const cancelDelete = () => {
    setConfirming(null);
    setDeleting(false);
  };

  const confirmDelete = async (patient) => {
    if (!patient) return;
    setDeleting(true);

    try {
      await deletePatient(patient.idPaciente);

      setPatients((prev) => prev.filter((item) => item.idPaciente !== patient.idPaciente));
      setFeedback("Paciente eliminado");
      setConfirming(null);
      setDeleting(false);
    } catch (err) {
      const message = err instanceof HttpError && err.payload?.message ? err.payload.message : err.message || "No se pudo eliminar";
      setFeedback(message);
      setDeleting(false);
    }
  };


  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Pacientes</h1>
        <p className="text-sm text-gray-600">
          Gestiona el registro, actualizacion y eliminacion de pacientes.
        </p>
      </header>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 md:flex-row md:items-center">
          <div className="flex flex-1 gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar paciente..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={refreshData}
              className="hidden rounded-md border px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 md:inline-flex"
              disabled={loading}
            >
              Actualizar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {loading ? "Cargando..." : error ? `Error: ${error}` : `${filteredPatients.length} registros`}
            </span>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Nuevo paciente
            </button>
          </div>
        </div>

        {feedback ? (
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm text-gray-600">{feedback}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-700">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Genero</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Nacimiento</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Contacto</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Afiliacion</th>
                <th className="px-4 py-3 text-right" aria-label="Acciones">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {!loading && filteredPatients.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                    Sin pacientes
                  </td>
                </tr>
              ) : null}

              {filteredPatients.map((patient) => (
                <tr key={patient.idPaciente} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {patient.nombre} {patient.apellido}
                    </div>
                    <div className="text-xs text-gray-500">DUI: {patient.dui || "-"}</div>
                  </td>
                  <td className="px-4 py-3">{patient.genero || "-"}</td>
                  <td className="px-4 py-3">{patient.fecha_nacimiento || "-"}</td>
                  <td className="px-4 py-3">
                    <div>{patient.telefono_celular || "Sin celular"}</div>
                    <div className="text-xs text-gray-500">{patient.telefono_fijo || "Sin fijo"}</div>
                  </td>
                  <td className="px-4 py-3">{patient.numero_afiliacion || "-"}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEdit(patient)}
                      className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDelete(patient)}
                      className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                    Cargando pacientes...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {modalMode ? (
        <PatientForm
          mode={modalMode}
          initialData={modalMode === "edit" ? selected : EMPTY_PATIENT}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          submitting={submitting}
        />
      ) : null}

      <ConfirmDeleteDialog
        patient={confirming}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        busy={deleting}
      />
    </div>
  );
}
