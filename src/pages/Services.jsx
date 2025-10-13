import { useEffect, useMemo, useState } from "react";
import { createService, deleteService, listServices, updateService } from "../api/servicesApi.js";
import { HttpError } from "../api/httpClient.js";

const EMPTY_FORM = {
  nombre: "",
  precio: "",
};

function normalizeError(error) {
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

function parsePrice(value) {
  if (value === undefined || value === null) {
    return { valid: false, number: null };
  }
  const trimmed = String(value).trim().replace(/,/g, "");
  if (!trimmed) {
    return { valid: false, number: null };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { valid: false, number: null };
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { valid: false, number: null };
  }
  return { valid: true, number: Math.round(numeric * 100) / 100 };
}

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Services() {
  const [services, setServices] = useState([]);
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

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { services: items } = await listServices({ signal: controller.signal });
        setServices(items);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(normalizeError(err));
        setServices([]);
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const filteredServices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return services;
    }
    return services.filter((service) => {
      const haystack = [service.nombre, service.precio != null ? String(service.precio) : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [services, search]);

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
      setFeedback("El nombre del servicio es obligatorio");
      return;
    }

    const exists = services.some((service) => {
      if (editing && service.idServicio === editing.idServicio) {
        return false;
      }
      return toKey(service.nombre) === toKey(nombre);
    });

    if (exists) {
      setFeedback("Ya existe un servicio con ese nombre");
      return;
    }

    const { valid, number } = parsePrice(form.precio);
    if (!valid) {
      setFeedback("El precio debe ser un número positivo con hasta dos decimales");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        const { service } = await updateService(editing.idServicio, { nombre, precio: number });
        if (service) {
          setServices((prev) => prev.map((item) => (item.idServicio === service.idServicio ? service : item)));
        }
        setFeedback("Servicio actualizado correctamente");
      } else {
        const { service } = await createService({ nombre, precio: number });
        if (service) {
          setServices((prev) => [service, ...prev]);
        }
        setFeedback("Servicio creado correctamente");
      }
      resetForm();
    } catch (err) {
      setFeedback(normalizeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (service) => {
    setEditing(service);
    setForm({
      nombre: service.nombre || "",
      precio: service.precio != null ? service.precio.toFixed(2) : "",
    });
    setFeedback(null);
  };

  const handleDelete = async (service) => {
    if (!service?.idServicio) return;
    const confirmed = window.confirm(`Eliminar servicio "${service.nombre}"?`);
    if (!confirmed) return;

    try {
      await deleteService(service.idServicio);
      setServices((prev) => prev.filter((item) => item.idServicio !== service.idServicio));
      setFeedback("Servicio eliminado correctamente");
      if (editing && editing.idServicio === service.idServicio) {
        resetForm();
      }
    } catch (err) {
      setFeedback(normalizeError(err));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Servicios</h1>
        <p className="text-sm text-gray-600">Registra y actualiza servicios indicando el nombre y el precio.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[24rem_1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{isEditing ? "Editar servicio" : "Nuevo servicio"}</h2>
          <p className="mt-1 text-sm text-gray-500">Ambos campos son obligatorios. El precio admite hasta dos decimales.</p>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="nombre" className="text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                id="nombre"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                placeholder="Consulta general"
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="precio" className="text-sm font-medium text-gray-700">
                Precio *
              </label>
              <input
                id="precio"
                name="precio"
                value={form.precio}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                placeholder="0.00"
                inputMode="decimal"
                disabled={submitting}
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear servicio"}
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
            <h2 className="text-base font-semibold text-gray-900 sm:flex-1">Servicios registrados</h2>
            <div className="flex flex-1 gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre o precio"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
              />
            </div>
            <span className="text-sm text-gray-500">
              {loading ? "Cargando..." : error ? `Error: ${error}` : `${filteredServices.length} servicios`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-700">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Precio</th>
                  <th className="px-4 py-3 text-right font-medium uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {!loading && filteredServices.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={3}>
                      Sin servicios registrados
                    </td>
                  </tr>
                ) : null}

                {filteredServices.map((service) => (
                  <tr key={service.idServicio ?? service.nombre} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{service.nombre || "-"}</td>
                    <td className="px-4 py-3">{formatPrice(service.precio)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(service)}
                        className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(service)}
                        className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}

                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={3}>
                      Cargando servicios...
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
