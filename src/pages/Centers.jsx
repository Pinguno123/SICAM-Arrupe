import { useEffect, useMemo, useState } from "react";
import { createCenter, deleteCenter, listCenters, updateCenter } from "../api/centersApi.js";
import { HttpError } from "../api/httpClient.js";

const EMPTY_FORM = {
  nombre: "",
  administrador: "",
  director: "",
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

function normaliseKey(value) {
  return (value || "").trim().toLowerCase();
}

export default function Centers() {
  const [centers, setCenters] = useState([]);
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
        const { centers: items } = await listCenters({ signal: controller.signal });
        setCenters(items);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(normalizeError(err));
        setCenters([]);
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  const filteredCenters = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return centers;
    }
    return centers.filter((center) => {
      const haystack = [center.nombre, center.administrador, center.director]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [centers, search]);

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
      setFeedback("El nombre es obligatorio");
      return;
    }

    const exists = centers.some((center) => {
      if (editing && center.idCentro === editing.idCentro) {
        return false;
      }
      return normaliseKey(center.nombre) === normaliseKey(nombre);
    });

    if (exists) {
      setFeedback("Ya existe un centro con ese nombre");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        const { center } = await updateCenter(editing.idCentro, {
          nombre,
          administrador: form.administrador,
          director: form.director,
        });
        if (center) {
          setCenters((prev) => prev.map((item) => (item.idCentro === center.idCentro ? center : item)));
        }
        setFeedback("Centro actualizado correctamente");
      } else {
        const { center } = await createCenter({
          nombre,
          administrador: form.administrador,
          director: form.director,
        });
        if (center) {
          setCenters((prev) => [center, ...prev]);
        }
        setFeedback("Centro creado correctamente");
      }
      resetForm();
    } catch (err) {
      setFeedback(normalizeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (center) => {
    setEditing(center);
    setForm({
      nombre: center.nombre || "",
      administrador: center.administrador || "",
      director: center.director || "",
    });
    setFeedback(null);
  };

  const handleDelete = async (center) => {
    if (!center?.idCentro) return;
    const confirmed = window.confirm(`Eliminar centro "${center.nombre}"?`);
    if (!confirmed) return;

    try {
      await deleteCenter(center.idCentro);
      setCenters((prev) => prev.filter((item) => item.idCentro !== center.idCentro));
      setFeedback("Centro eliminado correctamente");
      if (editing && editing.idCentro === center.idCentro) {
        resetForm();
      }
    } catch (err) {
      setFeedback(normalizeError(err));
    }
  };

  // Title Case
  const titleCase = (v) =>
    v.replace(/\b([A-Za-zÁÉÍÓÚÜÑáéíóúüñ])([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]*)/g,
      (_, a, b) => a.toUpperCase() + b.toLowerCase());

  // Máx. N palabras, solo letras + espacio. No símbolos.
  const limpiarNPalabrasLive = (v, max = 4) => {
    let s = v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, "").replace(/ {2,}/g, " ");
    const trailing = s.endsWith(" ");
    const parts = s.trim().split(" ").filter(Boolean);
    if (parts.length > max) s = parts.slice(0, max).join(" ");
    else s = parts.join(" ") + (trailing && parts.length < max ? " " : "");
    return s;
  };

  // Texto básico para "Nombre" del centro: letras, números y espacio.
  const limpiarCentroLive = (v) =>
    v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]/g, "").replace(/ {2,}/g, " ");

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Centros de atención</h1>
        <p className="text-sm text-gray-600">
          Gestiona centros registrando o editando el nombre, administrador y director.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[24rem_1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">{isEditing ? "Editar centro" : "Nuevo centro"}</h2>
          <p className="mt-1 text-sm text-gray-500">Todos los campos son obligatorios.</p>

          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label htmlFor="nombre" className="text-sm font-medium text-gray-700">Nombre *</label>
              <input
                id="nombre"
                name="nombre"
                placeholder="Centro principal"
                value={form.nombre ?? ""}
                minLength={3}
                maxLength={60}
                inputMode="text"
                pattern="^(?=.{3,60}$)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)*$"
                onChange={(e) => {
                  e.target.value = limpiarCentroLive(e.target.value);
                  handleChange(e);
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  e.target.value = v;
                  handleChange(e);
                }}
                disabled={submitting}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="administrador" className="text-sm font-medium text-gray-700">Administrador *</label>
              <input
                id="administrador"
                name="administrador"
                placeholder="Nombre del administrador"
                value={form.administrador ?? ""}
                minLength={3}
                maxLength={60}
                inputMode="text"
                pattern="^(?=.{3,60}$)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,3}$"
                onChange={(e) => {
                  e.target.value = limpiarNPalabrasLive(e.target.value, 4);
                  handleChange(e);
                }}
                onBlur={(e) => {
                  e.target.value = titleCase(e.target.value.trim());
                  handleChange(e);
                }}
                disabled={submitting}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="director" className="text-sm font-medium text-gray-700">Director *</label>
              <input
                id="director"
                name="director"
                placeholder="Nombre del director"
                value={form.director ?? ""}
                minLength={3}
                maxLength={60}
                inputMode="text"
                pattern="^(?=.{3,60}$)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,3}$"
                onChange={(e) => {
                  e.target.value = limpiarNPalabrasLive(e.target.value, 4);
                  handleChange(e);
                }}
                onBlur={(e) => {
                  e.target.value = titleCase(e.target.value.trim());
                  handleChange(e);
                }}
                disabled={submitting}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                disabled={submitting}
              >
                {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear centro"}
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
            <h2 className="text-base font-semibold text-gray-900 sm:flex-1">Centros registrados</h2>
            <div className="flex flex-1 gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, administrador o director"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
              />
            </div>
            <span className="text-sm text-gray-500">
              {loading ? "Cargando..." : error ? `Error: ${error}` : `${filteredCenters.length} centros`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-700">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Administrador</th>
                  <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Director</th>
                  <th className="px-4 py-3 text-right font-medium uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {!loading && filteredCenters.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                      Sin centros registrados
                    </td>
                  </tr>
                ) : null}

                {filteredCenters.map((center) => (
                  <tr key={center.idCentro ?? center.nombre} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{center.nombre || "-"}</td>
                    <td className="px-4 py-3">{center.administrador || "-"}</td>
                    <td className="px-4 py-3">{center.director || "-"}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(center)}
                        className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(center)}
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
                      Cargando centros...
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
