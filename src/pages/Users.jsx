import { useCallback, useEffect, useMemo, useState } from "react";
import { HttpError } from "../api/httpClient.js";
import { createUser, deleteUser, listUsers, updateUser } from "../api/usersApi.js";

const EMPTY_FORM = {
  username: "",
  password: "",
  nombre: "",
  apellido: "",
  telefono: "",
  rolId: "",
};

function normalizeError(error) {
  if (!error) {
    return "Error de red";
  }
  if (error instanceof HttpError) {
    if (error.payload && typeof error.payload === "object") {
      if (typeof error.payload.message === "string" && error.payload.message.trim()) {
        return error.payload.message.trim();
      }
      if (typeof error.payload.error === "string" && error.payload.error.trim()) {
        return error.payload.error.trim();
      }
    }
    if (error.message) {
      return error.message;
    }
    if (error.status) {
      return `Solicitud rechazada (${error.status})`;
    }
    return "Error al comunicarse con el servidor";
  }
  if (error && error.message) {
    return error.message;
  }
  return "Ocurrio un error inesperado";
}


function normaliseRoleId(value) {

  if (value === undefined || value === null) {

    return null;

  }

  if (typeof value === "number" && Number.isFinite(value)) {

    return value;

  }

  const trimmed = String(value).trim();

  if (!trimmed) {

    return null;

  }

  const numeric = Number(trimmed);

  return Number.isNaN(numeric) ? trimmed : numeric;

}



function toRoleKey(role) {

  if (!role || typeof role !== "object") {

    return null;

  }

  const id = normaliseRoleId(role.idRol ?? role.id ?? role.codigo);

  if (id === null || id === undefined) {

    return null;

  }

  return String(id);

}



function deriveRolesFromUsers(source = []) {

  const map = new Map();

  source.forEach((user) => {

    if (!user) return;

    const id = normaliseRoleId(user.rolId ?? user.rol?.id);

    if (id === null || id === undefined) return;

    const key = String(id);

    if (map.has(key)) return;

    const nombre = (user.rolNombre ?? user.rol?.nombre ?? "").trim();

    map.set(key, {

      idRol: id,

      nombre: nombre || `Rol ${id}`,

    });

  });

  return Array.from(map.values());

}


function ConfirmDeleteDialog({ user, onConfirm, onCancel, busy = false, error = null }) {
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Eliminar usuario</h2>
          <p className="mt-1 text-sm text-gray-600">
            Estas por eliminar la cuenta de <strong>{user.username}</strong>. Esta accion no se puede deshacer.
          </p>
        </div>

        {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
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
            onClick={() => onConfirm(user)}
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

function UserForm({ mode, initialData = EMPTY_FORM, roles, onSubmit, onCancel, submitting, error }) {
  const buildFormState = useCallback((data) => {
    const source = data && typeof data === "object" ? data : {};
    const { rolId, correo: _ignoredCorreo, password: _ignoredPassword, ...rest } = source;
    return {
      ...EMPTY_FORM,
      ...rest,
      password: "",
      rolId: rolId != null && rolId !== "" ? String(rolId) : "",
    };
  }, []);

  const [form, setForm] = useState(() => buildFormState(initialData));
  const [validationError, setValidationError] = useState(null);

  useEffect(() => {
    setForm(buildFormState(initialData));
    setValidationError(null);
  }, [initialData, mode, buildFormState]);

  const roleOptions = useMemo(
    () =>
      roles.map((role) => ({
        value: role.idRol != null ? String(role.idRol) : role.id != null ? String(role.id) : "",
        label: role.nombre || (role.idRol != null ? `Rol ${role.idRol}` : "Rol"),
      })),
    [roles],
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const username = form.username.trim();
    if (!username) {
      setValidationError("El nombre de usuario es obligatorio");
      return;
    }

    const password = form.password.trim();
    if (mode !== "edit" && !password) {
      setValidationError("La contraseña es obligatoria");
      return;
    }

    if (!form.rolId) {
      setValidationError("Selecciona un rol");
      return;
    }

    const payload = {
      username,
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      telefono: form.telefono.trim(),
      rolId: Number(form.rolId),
    };

    if (mode === "edit") {
      if (password) {
        payload.password = password;
      }
    } else {
      payload.password = password;
    }

    setValidationError(null);

    await onSubmit(payload);
  };

  // Formateo del formulario
  const PARTICULAS = ["de", "del", "la", "las", "los", "y"];

  const limpiarCompuestoLive = (v, max = 4) => {
    let s = v.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, "").replace(/ {2,}/g, " ");
    const trailing = s.endsWith(" ");
    const parts = s.trim().split(" ").filter(Boolean).slice(0, max);
    return parts.join(" ") + (trailing && parts.length < max ? " " : "");
  };

  const titleCaseConParticulas = (v) =>
    v.trim().split(/\s+/).map((w, i) => {
      const wl = w.toLowerCase();
      if (i > 0 && PARTICULAS.includes(wl)) return wl;
      return wl.charAt(0).toUpperCase() + wl.slice(1);
    }).join(" ");

  const telLive = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`;
  };

  const usernameLive = (v) => {
    let s = v.toLowerCase().replace(/[^a-z0-9._-]/g, "");
    s = s.replace(/[._-]{2,}/g, m => m[0]);           // sin repetidos
    s = s.replace(/^[._-]+|[._-]+$/g, "");            // no extremos
    return s.slice(0, 20);
  };

  const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <header className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === "edit" ? "Editar usuario" : "Nuevo usuario"}
          </h2>
          <p className="text-sm text-gray-500">Completa los datos necesarios y guarda los cambios.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{validationError}</p> : null}
          {!validationError && error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Usuario */}
            <label className="space-y-1 text-sm text-gray-700">
              <span>Usuario *</span>
              <input
                name="username"
                placeholder="Username"
                value={form.username ?? ""}
                inputMode="text"
                maxLength={20}
                pattern="^(?=.{3,20}$)[a-z](?:[a-z0-9._-]*[a-z0-9])?$"
                title="3–20 chars, minúsculas, números, . _ -, empieza y termina con letra/número"
                onChange={(e) => { e.target.value = usernameLive(e.target.value); handleChange(e); }}
                disabled={submitting}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
              />
            </label>

            {/* Contraseña */}
            <label className="space-y-1 text-sm text-gray-700">
              <span>{mode === "edit" ? "Contraseña (opcional)" : "Contraseña *"}</span>
              <input
                type="password"
                name="password"
                value={form.password ?? ""}
                autoComplete={mode === "edit" ? "current-password" : "new-password"}
                maxLength={64}
                placeholder={mode === "edit" ? "Dejar en blanco para mantener" : "Contraseña segura"}
                onChange={(e) => {
                  e.target.value = e.target.value.slice(0, 64);
                  handleChange(e);
                }}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (mode !== "edit" && v && !PASSWORD_RE.test(v)) {
                    e.target.setCustomValidity("8–64, mayúscula, minúscula, número y símbolo.");
                    e.target.reportValidity();
                    return;
                  }
                  e.target.setCustomValidity("");
                }}
                disabled={submitting}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />

            </label>

            <label className="space-y-1 text-sm text-gray-700">
              <span>Nombre</span>
              <input
                name="nombre"
                placeholder="Patricia del Carmen"
                value={form.nombre ?? ""}
                minLength={3}
                maxLength={60}
                pattern="^(?=.{3,60}$)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: (?:de|del|la|las|los|y) [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+| [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,3}$"
                onChange={(e) => { e.target.value = limpiarCompuestoLive(e.target.value, 4); handleChange(e); }}
                onBlur={(e) => { e.target.value = titleCaseConParticulas(e.target.value); handleChange(e); }}
                disabled={submitting}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm text-gray-700">
              <span>Apellido</span>
              <input
                name="apellido"
                placeholder="Rosa de Mendez"
                value={form.apellido ?? ""}
                minLength={3}
                maxLength={60}
                pattern="^(?=.{3,60}$)[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: (?:de|del|la|las|los|y) [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+| [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,3}$"
                onChange={(e) => { e.target.value = limpiarCompuestoLive(e.target.value, 4); handleChange(e); }}
                onBlur={(e) => { e.target.value = titleCaseConParticulas(e.target.value); handleChange(e); }}
                disabled={submitting}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>

            <label className="space-y-1 text-sm text-gray-700">
              <span>Telefono</span>
              <input
                name="telefono"
                placeholder="0000-0000"
                value={form.telefono ?? ""}
                inputMode="numeric"
                maxLength={9}
                pattern="^[0-9]{4}-[0-9]{4}$"
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 8);
                  e.target.value = d.length <= 4 ? d : `${d.slice(0, 4)}-${d.slice(4)}`;
                  handleChange(e);
                }}
                disabled={submitting}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>

            {/* Rol */}
            <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
              <span>Rol *</span>
              <select
                name="rolId"
                value={form.rolId}
                onChange={handleChange}
                disabled={submitting || roleOptions.length === 0}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                required
              >
                <option value="">Selecciona un rol</option>
                {roleOptions.map(o => (
                  <option key={o.value || o.label} value={o.value}>{o.label}</option>
                ))}
              </select>
              {roleOptions.length === 0 ? (
                <span className="text-xs text-gray-500">No hay roles disponibles. Revisa el catalogo de roles.</span>
              ) : null}
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear usuario"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              disabled={submitting}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [derivedRoles, setDerivedRoles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState(null);

  const [modalMode, setModalMode] = useState(null);
  const [selected, setSelected] = useState(null);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const availableRoles = useMemo(() => {
    return [...derivedRoles].sort((a, b) => {
      const labelA = (a?.nombre ?? '').toLowerCase();
      const labelB = (b?.nombre ?? '').toLowerCase();
      return labelA.localeCompare(labelB, 'es');
    });
  }, [derivedRoles]);

  const applyUsersUpdate = useCallback((updater) => {
    setUsers((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const normalized = Array.isArray(next) ? next : [];
      setDerivedRoles(deriveRolesFromUsers(normalized));
      return normalized;
    });
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeout = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const loadUsers = useCallback(
    async ({ signal, silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const { users: items } = await listUsers({ signal });
        applyUsersUpdate(Array.isArray(items) ? items : []);
        if (!silent) {
          setError(null);
        }
        return items;
      } catch (err) {
        if (err.name === "AbortError") {
          return null;
        }
        const message = normalizeError(err);
        applyUsersUpdate([]);
        setError(message);
        return null;
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadUsers({ signal: controller.signal });
    return () => controller.abort();
  }, [loadUsers]);

  const roleNameById = useMemo(() => {
    const map = new Map();
    availableRoles.forEach((role) => {
      const key = toRoleKey(role);
      if (!key) return;
      const id = normaliseRoleId(role.idRol ?? role.id) ?? key;
      map.set(key, role.nombre || `Rol ${id}`);
    });
    return map;
  }, [availableRoles]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return users;
    }
    return users.filter((user) => {
      const haystack = [
        user.username,
        user.nombre,
        user.apellido,
        user.telefono,
        user.rolNombre || (user.rolId != null ? roleNameById.get(String(user.rolId)) : ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [users, search, roleNameById]);

  const openCreate = () => {
    setModalMode("create");
    setSelected(null);
    setFormError(null);
  };

  const openEdit = (user) => {
    setModalMode("edit");
    setSelected(user);
    setFormError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setFormError(null);
  };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    setFormError(null);
    try {
      if (modalMode === "edit" && selected) {
        const requestData = { ...formData };
        if (!requestData.password && selected.password) {
          requestData.password = selected.password;
        }
        const { user } = await updateUser(selected.idUsuario, requestData);
        if (!user || user.idUsuario === undefined || user.idUsuario === null) {
          await loadUsers({ silent: true });
        } else {
          applyUsersUpdate((prev) => prev.map((item) => (item.idUsuario === selected.idUsuario ? user : item)));
        }
        setFeedback("Usuario actualizado correctamente");
      } else {
        const { user } = await createUser(formData);
        if (!user || user.idUsuario === undefined || user.idUsuario === null) {
          await loadUsers({ silent: true });
        } else {
          applyUsersUpdate((prev) => {
            const next = [...prev, user];
            return next.sort((a, b) => {
              const keyA = (a.username || "").toLowerCase();
              const keyB = (b.username || "").toLowerCase();
              return keyA.localeCompare(keyB, "es");
            });
          });
        }
        setFeedback("Usuario creado correctamente");
      }
      closeModal();
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      setFormError(normalizeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = (user) => {
    setConfirming(user);
    setDeleteError(null);
  };

  const cancelDelete = () => {
    setConfirming(null);
    setDeleteError(null);
  };

  const confirmDelete = async (user) => {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteUser(user.idUsuario);
      applyUsersUpdate((prev) => prev.filter((item) => item.idUsuario !== user.idUsuario));
      setFeedback(`Usuario ${user.username} eliminado correctamente`);
      setConfirming(null);
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      setDeleteError(normalizeError(err));
    } finally {
      setDeleting(false);
    }
  };

  const refreshData = () => {
    loadUsers();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Usuarios</h1>
        <p className="text-sm text-gray-600">Administra las cuentas de acceso a la plataforma.</p>

      </header>

      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 md:flex-row md:items-center">
          <div className="flex flex-1 gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por usuario, nombre o rol"
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {loading ? "Cargando..." : error ? `Error: ${error}` : `${filteredUsers.length} registros`}
            </span>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              disabled={submitting}
            >
              Nuevo usuario
            </button>
          </div>
        </div>

        {feedback ? <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm text-gray-600">{feedback}</div> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-700">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Usuario</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Nombre</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Telefono</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Rol</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {!loading && filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                    Sin usuarios registrados
                  </td>
                </tr>
              ) : null}

              {filteredUsers.map((user) => {
                const roleNameKey = user.rolId != null ? String(user.rolId) : null;

                const roleName = user.rolNombre || (roleNameKey ? roleNameById.get(roleNameKey) : "");
                return (
                  <tr key={user.idUsuario ?? user.username} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{user.username || "-"}</div>
                      <div className="text-xs text-gray-500">ID: {user.idUsuario ?? "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{`${user.nombre ?? ""} ${user.apellido ?? ""}`.trim() || "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      {user.telefono || "Sin telefono"}
                    </td>
                    <td className="px-4 py-3">{roleName || "-"}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(user)}
                        className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                    Cargando usuarios...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {modalMode ? (
        <UserForm
          mode={modalMode}
          initialData={modalMode === "edit" ? selected : EMPTY_FORM}
          roles={availableRoles}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          submitting={submitting}
          error={formError}
        />
      ) : null}

      <ConfirmDeleteDialog
        user={confirming}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        busy={deleting}
        error={deleteError}
      />
    </div>
  );
}






