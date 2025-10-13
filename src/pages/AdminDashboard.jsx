import { useEffect, useMemo, useState } from "react";
import { apiClient, HttpError } from "../api/httpClient.js";
import { normaliseListPayload } from "../api/utils.js";

const SORTABLE_COLUMNS = [
  { key: "patient", label: "Paciente" },
  { key: "study", label: "Estudio" },
  //{ key: "doctor", label: "Profesional" },
  { key: "status", label: "Estado" },
  { key: "date", label: "Fecha" },
];

const fullName = (first, last) => [first, last].filter(Boolean).join(" ").trim();

function normalizeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function generateRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Math.random().toString(36).slice(2, 11)}`;
}

function formatDisplayDate(value) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("es-SV", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function AdminDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "patient", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [reloadToken, setReloadToken] = useState(0);

  const refreshData = () => setReloadToken((token) => token + 1);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAppointments() {
      setLoading(true);
      setError(null);

      try {
        let partialError = null;

        const safeFetch = async (path) => {
          try {
            return await apiClient.get(path, { signal: controller.signal });
          } catch (requestError) {
            if (requestError.name === "AbortError") {
              throw requestError;
            }
            const message =
              requestError instanceof HttpError && requestError.payload?.message
                ? requestError.payload.message
                : requestError.message || "Error de red";
            console.error(`Error cargando ${path}:`, requestError);
            partialError = partialError ?? message;
            return [];
          }
        };

        const [
          apptsPayload,
          pacientesPayload,
          turnosPayload,
          horariosPayload,
          usuariosPayload,
        ] = await Promise.all([
          safeFetch("/api/citas"),
          safeFetch("/api/pacientes"),
          safeFetch("/api/doctor-turnos"),
          safeFetch("/api/doctor-horarios"),
          safeFetch("/api/usuarios"),
        ]);

        const appts = normaliseListPayload(apptsPayload);
        const pacientes = normaliseListPayload(pacientesPayload);
        const turnos = normaliseListPayload(turnosPayload);
        const horarios = normaliseListPayload(horariosPayload);
        const usuarios = normaliseListPayload(usuariosPayload);

        console.info({
          appts: appts.length,
          pacientes: pacientes.length,
          turnos: turnos.length,
          horarios: horarios.length,
          usuarios: usuarios.length,
        });

        const patientsById = Object.fromEntries(
          pacientes
            .filter((p) => p && typeof p.id !== "undefined")
            .map((p) => {
              const nombre = fullName(p.nombre, p.apellido);
              return [p.id, nombre || undefined];
            }),
        );

        const horariosDoctorIdById = Object.fromEntries(
          horarios
            .filter((h) => h && typeof h.id !== "undefined")
            .map((h) => [h.id, h.doctor?.id]),
        );

        const userNameById = Object.fromEntries(
          usuarios
            .filter((u) => u && typeof u.id !== "undefined")
            .map((u) => {
              const nombre = fullName(u.nombre, u.apellido);
              return [u.id, nombre || undefined];
            }),
        );

        const turnoToDoctorNombre = Object.fromEntries(
          turnos
            .filter((t) => t && typeof t.id !== "undefined")
            .map((t) => {
              const docHorarioId = t.doctorHorario?.id;
              const doctorId = typeof docHorarioId !== "undefined" ? horariosDoctorIdById[docHorarioId] : undefined;
              const doctorName = doctorId ? userNameById[doctorId] : undefined;
              return [t.id, doctorName];
            }),
        );

        const rows = appts.map((appointment) => {
          const patientDictionaryName = patientsById[appointment.pacienteId];
          const patientName =
            (typeof patientDictionaryName === "string" && patientDictionaryName.trim().length > 0
              ? patientDictionaryName.trim()
              : null) ??
            (appointment.pacienteId ? `Paciente #${appointment.pacienteId}` : "Sin asignar");

          const doctorDictionaryName =
            appointment.doctorAsignadoNombre ??
            turnoToDoctorNombre[appointment.doctorTurnoId];
          const doctorName =
            (typeof doctorDictionaryName === "string" && doctorDictionaryName.trim().length > 0
              ? doctorDictionaryName.trim()
              : null) ??
            (appointment.doctorTurnoId ? `Profesional turno #${appointment.doctorTurnoId}` : "Sin asignar");
          const normalizedDate = normalizeDate(appointment.fechaReferencia);

          return {
            id: appointment.id ?? appointment.idCita ?? generateRowId(),
            patient: patientName,
            doctor: doctorName ?? "Sin asignar",
            study: appointment.servicioNombre ?? "Sin servicio",
            status: appointment.confirmada ? "Confirmada" : "Pendiente",
            date: normalizedDate || null,
            raw: appointment,
          };
        });

        setAppointments(rows);

        if (partialError) {
          setError(partialError);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        const message = err instanceof HttpError && err.payload?.message ? err.payload.message : err.message || "Error de red";
        setError(message);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    }

    loadAppointments();

    return () => controller.abort();
  }, [reloadToken]);

  useEffect(() => {
    const bump = () => setReloadToken((token) => token + 1);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        bump();
      }
    };

    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const rows = useMemo(
    () =>
      appointments.filter((row) => row && row.id !== undefined && row.id !== null),
    [appointments],
  );

  const stats = useMemo(() => {
    const today = normalizeDate(new Date());
    const patientIds = new Set();
    let mammografias = 0;
    let todaysAppointments = 0;
    let confirmed = 0;
    let pending = 0;
    const upcoming = [];

    appointments.forEach((row) => {
      const raw = row.raw ?? {};
      const patientId = raw.pacienteId ?? raw.idPaciente ?? null;
      if (patientId !== null && patientId !== undefined) {
        patientIds.add(String(patientId));
      } else if (row.patient) {
        patientIds.add(String(row.patient).toLowerCase());
      }

      const serviceName = String(row.study ?? "").toLowerCase();
      if (serviceName.includes("mamog")) {
        mammografias += 1;
      }

      const appointmentDate = normalizeDate(
        raw.fechaReferencia ?? raw.turnoFecha ?? row.date,
      );
      if (appointmentDate === today) {
        todaysAppointments += 1;
      }

      if (row.status === "Confirmada") {
        confirmed += 1;
      } else {
        pending += 1;
        if (appointmentDate) {
          upcoming.push({
            id: row.id ?? generateRowId(),
            patient: row.patient || "Paciente sin asignar",
            service: row.study || "Procedimiento",
            date: appointmentDate,
          });
        }
      }
    });

    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    const total = appointments.length;
    const confirmedPct = total ? Math.round((confirmed / total) * 100) : 0;
    const pendingPct = total ? Math.round((pending / total) * 100) : 0;

    const upcomingFormatted = upcoming.slice(0, 3).map((item) => ({
      ...item,
      dateLabel: formatDisplayDate(item.date),
    }));

    return {
      total,
      patients: patientIds.size,
      mammografias,
      today: todaysAppointments,
      confirmed,
      pending,
      confirmedPct,
      pendingPct,
      upcoming: upcomingFormatted,
    };
  }, [appointments]);

  const statCards = useMemo(
    () => [
      { id: "stat-pacientes", label: "Pacientes atendidos", value: stats.patients },
      { id: "stat-mamografias", label: "Mamografias programadas", value: stats.mammografias },
      { id: "stat-citas", label: "Citas del dia", value: stats.today },
    ],
    [stats],
  );

  const filteredRows = useMemo(() => {
    if (!debouncedSearch) return rows;
    return rows.filter((row) =>
      [row.patient, row.study, row.doctor, row.status, row.date]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(debouncedSearch)),
    );
  }, [rows, debouncedSearch]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const { key, dir } = sort;
    copy.sort((a, b) => {
      const aValue = String(a[key] ?? "").toLowerCase();
      const bValue = String(b[key] ?? "").toLowerCase();
      if (aValue < bValue) return dir === "asc" ? -1 : 1;
      if (aValue > bValue) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filteredRows, sort]);

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
    setPage(1);
  };

  const statusText = useMemo(() => {
    if (loading) return "Cargando...";
    if (error) return `Error: ${error}`;
    if (total === stats.total) {
      return `${total} registros`;
    }
    return `${total} de ${stats.total} registros`;
  }, [loading, error, total, stats.total]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Panel administrativo</h1>
        <p className="text-sm text-gray-600">Resumen rapido de las atenciones y procedimientos programados.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <div key={stat.id} className="rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value.toLocaleString("es-SV")}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm xl:col-span-2">
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none md:w-72"
            />
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={refreshData}
                className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60"
                disabled={loading}
                title="Actualizar"
              >
                Actualizar
              </button>
              <div className="text-sm text-gray-600">{statusText}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-700">
              <thead className="bg-gray-50">
                <tr>
                  {SORTABLE_COLUMNS.map((column) => (
                    <th key={column.key} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort(column.key)}
                        disabled={loading}
                        title="Ordenar"
                      >
                        {column.label}
                        {sort.key === column.key ? (sort.dir === "asc" ? "^" : "v") : null}
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3" aria-label="Acciones" />
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {!loading && paginatedRows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={SORTABLE_COLUMNS.length + 1}>
                      Sin resultados
                    </td>
                  </tr>
                )}

                {paginatedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{row.patient}</td>
                    <td className="px-4 py-3">{row.study}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${row.status === "Confirmada"
                          ? "bg-green-100 text-green-700"
                          : row.status === "Pendiente"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                          }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.date || ""}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100"
                        title="Mas opciones"
                      >
                        ?
                      </button>
                    </td>
                  </tr>
                ))}

                {loading && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={SORTABLE_COLUMNS.length + 1}>
                      Cargando...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 border-t border-gray-100 px-4 py-3">
            <div className="text-sm text-gray-600">
              Pagina {page} de {totalPages}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={loading || page <= 1}
              >
                Anterior
              </button>
              <button
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={loading || page >= totalPages}
              >
                Siguiente
              </button>

              <select
                className="ml-2 rounded-md border px-2 py-1 text-sm"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                disabled={loading}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / pagina
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Proximas tareas</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            {stats.upcoming.length === 0 ? (
              <li className="rounded-lg bg-gray-50 px-3 py-2 text-gray-500">
                Sin tareas pendientes generadas automaticamente.
              </li>
            ) : (
              stats.upcoming.map((task) => (
                <li key={task.id} className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex items-center justify-between text-sm text-gray-800">
                    <span className="font-medium">{task.patient}</span>
                    <span className="text-xs text-gray-500">{task.dateLabel}</span>
                  </div>
                  <div className="text-xs text-gray-500">{task.service}</div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Resumen de estados</h3>
          <dl className="mt-3 space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <dt>Total de citas</dt>
              <dd className="font-semibold text-gray-900">{stats.total.toLocaleString("es-SV")}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Confirmadas</dt>
              <dd className="font-semibold text-emerald-600">{stats.confirmed.toLocaleString("es-SV")}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Pendientes</dt>
              <dd className="font-semibold text-amber-600">{stats.pending.toLocaleString("es-SV")}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Indicadores</h3>
          <div className="mt-3 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Confirmadas</span>
                <span>{stats.confirmedPct}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${stats.confirmedPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Pendientes</span>
                <span>{stats.pendingPct}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${stats.pendingPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Notas internas</h3>
          <p className="mt-3 text-sm text-gray-600">
            No hay notas internas registradas. Utiliza este espacio para compartir recordatorios con tu equipo.
          </p>
        </div>
      </section>
    </div>
  );
}
