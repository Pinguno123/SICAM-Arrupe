import { useEffect, useMemo, useState } from "react";
import { createContract, deleteContract, listContracts, updateContract } from "../api/contractsApi.js";
import { HttpError } from "../api/httpClient.js";

const EMPTY_FORM = {
  nombre: "",
};

function normalizeErrorMessage(error) {
  if (!error) return "Error de red";
  if (error instanceof HttpError && error.payload?.message) {
    return error.payload.message;
  }
  if (error.message) {
    return error.message;
  }
  return "Error de red";
}

function toKey(value) {
  return (value || "").trim().toLowerCase();
}

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editing, setEditing] = useState(null);

  const isEditing = Boolean(editing);

  useEffect(() => {
    const controller = new AbortController();

    async function loadContracts() {
      setLoading(true);
      setError(null);
      try {
        const { contracts: items } = await listContracts({ signal: controller.signal });
        setContracts(items);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(normalizeErrorMessage(err));
        setContracts([]);
      } finally {
        setLoading(false);
      }
    }

    loadContracts();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const id = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(id);
  }, [feedback]);

  const filteredContracts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return contracts;
    }
    return contracts.filter((contract) => {
      const haystack = [contract.nombre, contract.codigo, contract.estado]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [contracts, search]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);

    const nombre = form.nombre.trim();

    if (!nombre) {
      setFeedback("El nombre del contrato es obligatorio");
      return;
    }

    const normalised = toKey(nombre);
    const conflict = contracts.some((contract) => {
      if (editing && contract.idContrato === editing.idContrato) {
        return false;
      }
      return toKey(contract.nombre ?? contract.codigo) === normalised;
    });

    if (conflict) {
      setFeedback("Ya existe un contrato con ese nombre");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        const { contract } = await updateContract(editing.idContrato, { codigo: nombre });
        if (contract) {
          setContracts((prev) =>
            prev.map((item) => (item.idContrato === contract.idContrato ? contract : item)),
          );
        }
        setFeedback("Contrato actualizado correctamente");
      } else {
        const { contract } = await createContract({ nombre });
        if (contract) {
          setContracts((prev) => [contract, ...prev]);
        }
        setFeedback("Contrato creado correctamente");
      }
      resetForm();
    } catch (err) {
      setFeedback(normalizeErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (contract) => {
    setEditing(contract);
    setForm({ nombre: contract.nombre || contract.codigo || "" });
    setFeedback(null);
  };

  const handleDelete = async (contract) => {
    if (!contract?.idContrato) return;
    const confirmed = window.confirm(`Eliminar contrato "${contract.nombre || contract.codigo}"?`);
    if (!confirmed) return;

    try {
      await deleteContract(contract.idContrato);
      setContracts((prev) => prev.filter((item) => item.idContrato !== contract.idContrato));
      setFeedback("Contrato eliminado correctamente");
      if (editing && editing.idContrato === contract.idContrato) {
        resetForm();
      }
    } catch (err) {
      setFeedback(normalizeErrorMessage(err));
    }
  };

  // helpers
  const codeLive = (v) => {
    const L = v.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);
    const N = v.replace(/\D/g, "").slice(0, 3);
    if (!L) return "";
    if (L.length < 4) return L;
    return `${L}-${N}`;
  };

  const codeBlur = (v) => {
    const L = v.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4);
    if (L.length !== 4) return null;
    const N = v.replace(/\D/g, "").slice(0, 3);
    return `${L}-${N.padStart(3, "0")}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Contratos globales</h1>
        <p className="text-sm text-gray-600">
          Crea y actualiza contratos globales usando solo el nombre. El nombre se usa como código y se activa automáticamente.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[24rem_1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{isEditing ? "Editar contrato" : "Nuevo contrato"}</h2>
          <p className="mt-1 text-sm text-gray-500">
            El nombre es obligatorio y debe ser único. Se utilizará como código interno.
          </p>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="nombre" className="text-sm font-medium text-gray-700">Nombre *</label>
              <input
                id="nombre"
                name="nombre"
                placeholder="ABCD-001"
                value={form.nombre ?? ""}
                maxLength={8}
                inputMode="text"
                pattern="^[A-Z]{4}-\d{3}$"
                onChange={(e) => { e.target.value = codeLive(e.target.value); handleChange(e); }}
                onBlur={(e) => {
                  const nv = codeBlur(e.target.value);
                  if (!nv) { e.target.setCustomValidity("Usa 4 letras y 3 números: AAAA-000"); e.target.reportValidity(); return; }
                  e.target.setCustomValidity(""); if (nv !== e.target.value) { e.target.value = nv; handleChange(e); }
                }}
                disabled={submitting}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear contrato"}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                  disabled={submitting}
                >
                  Cancelar
                </button>
              ) : null}
            </div>

            {feedback ? (
              <div className="text-sm text-gray-600" role="status">
                {feedback}
              </div>
            ) : null}
          </form>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center">
            <h2 className="text-base font-semibold text-gray-900 sm:flex-1">Contratos registrados</h2>
            <div className="flex flex-1 gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre o código"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
              />
            </div>
            <span className="text-sm text-gray-500">
              {loading ? "Cargando..." : error ? `Error: ${error}` : `${filteredContracts.length} contratos`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-700">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Código</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-right font-medium uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {!loading && filteredContracts.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                      Sin contratos registrados
                    </td>
                  </tr>
                ) : null}

                {filteredContracts.map((contract) => (
                  <tr key={contract.idContrato ?? contract.codigo ?? contract.nombre} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{contract.nombre || "-"}</td>
                    <td className="px-4 py-3">{contract.codigo || contract.nombre || "-"}</td>
                    <td className="px-4 py-3">{contract.estado || "activo"}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(contract)}
                        className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(contract)}
                        className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}

                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                      Cargando contratos...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
