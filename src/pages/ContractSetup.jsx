import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { listContracts } from "../api/contractsApi.js";
import { listCenters } from "../api/centersApi.js";
import { listServices } from "../api/servicesApi.js";
import {
  createContractCenter,
  deleteContractCenter,
  listContractCenters,
} from "../api/contractCentersApi.js";
import {
  createServiceContract,
  deleteServiceContract,
  listServiceContracts,
  updateServiceContract,
} from "../api/serviceContractsApi.js";
import { HttpError } from "../api/httpClient.js";

const DEFAULT_SERVICE_FORM = { serviceId: "", contractCenterId: "", quantity: "" };

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

function parsePositiveInteger(value) {
  if (value === undefined || value === null) {
    return { valid: false, number: null };
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return { valid: false, number: null };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, number: null };
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { valid: false, number: null };
  }
  return { valid: true, number: numeric };
}

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("es-SV", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function asMapKey(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export default function ContractSetup() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [contracts, setContracts] = useState([]);
  const [centers, setCenters] = useState([]);
  const [services, setServices] = useState([]);

  const [contractCenters, setContractCenters] = useState([]);
  const [serviceContracts, setServiceContracts] = useState([]);

  const [selectedContractId, setSelectedContractId] = useState("");

  const [centerForm, setCenterForm] = useState({ centerId: "" });
  const [serviceForm, setServiceForm] = useState(DEFAULT_SERVICE_FORM);

  const [submittingCenter, setSubmittingCenter] = useState(false);
  const [submittingService, setSubmittingService] = useState(false);
  const [editingServiceContract, setEditingServiceContract] = useState(null);
  const isEditing = Boolean(editingServiceContract);

  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [contractsData, centersData, servicesData, contractCentersData, serviceContractsData] =
          await Promise.all([
            listContracts({ signal: controller.signal }),
            listCenters({ signal: controller.signal }),
            listServices({ signal: controller.signal }),
            listContractCenters({ signal: controller.signal }),
            listServiceContracts({ signal: controller.signal }),
          ]);

        setContracts(contractsData.contracts);
        setCenters(centersData.centers);
        setServices(servicesData.services);
        setContractCenters(contractCentersData.contractCenters);
        setServiceContracts(serviceContractsData.serviceContracts);

        if (contractsData.contracts.length > 0) {
          setSelectedContractId(String(contractsData.contracts[0].idContrato));
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(normalizeError(err));
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

  const centersByKey = useMemo(() => {
    const map = new Map();
    centers.forEach((center) => {
      const key = asMapKey(center?.idCentro);
      if (!key) {
        return;
      }
      map.set(key, center);
    });
    return map;
  }, [centers]);

  const resolveCenterName = useCallback(
    (id, fallback = "") => {
      const key = asMapKey(id);
      if (!key) {
        return fallback || "Centro";
      }
      const center = centersByKey.get(key);
      const rawName = typeof center?.nombre === "string" ? center.nombre.trim() : "";
      if (rawName) {
        return rawName;
      }
      if (fallback) {
        return fallback;
      }
      return `Centro ${key}`;
    },
    [centersByKey],
  );

  const serviceInfoMap = useMemo(() => {
    const map = new Map();
    services.forEach((service) => {
      map.set(service.idServicio, {
        nombre: service.nombre || "Servicio",
        precio: service.precio ?? null,
      });
    });
    return map;
  }, [services]);

  const contractCenterMap = useMemo(() => {
    const map = new Map();
    contractCenters.forEach((item) => {
      const mapKey = asMapKey(item?.idContratoCentro);
      if (!mapKey) {
        return;
      }
      const centroRawId = item?.centroId ?? item?.centroAtencionId;
      const centroId = toNumberOrNull(centroRawId);
      const centroNombre = (() => {
        const rawName = typeof item?.centroNombre === "string" ? item.centroNombre.trim() : "";
        if (rawName) {
          return rawName;
        }
        return resolveCenterName(centroId ?? centroRawId);
      })();
      const contratoId = toNumberOrNull(item?.contratoId);
      map.set(mapKey, {
        ...item,
        idContratoCentro: toNumberOrNull(item?.idContratoCentro) ?? item?.idContratoCentro ?? null,
        contratoId,
        centroId,
        centroNombre,
      });
    });
    return map;
  }, [contractCenters, resolveCenterName]);

  const contractCentersForContract = useMemo(() => {
    const contractId = Number(selectedContractId);
    if (!contractId) {
      return [];
    }
    return Array.from(contractCenterMap.values())
      .filter((item) => item.contratoId === contractId)
      .map((item) => ({
        ...item,
        centroNombre: item.centroNombre || resolveCenterName(item.centroId),
      }));
  }, [selectedContractId, contractCenterMap, resolveCenterName]);

  useEffect(() => {
    if (!isEditing) {
      const defaultCenterId = contractCentersForContract[0]?.idContratoCentro;
      setServiceForm((prev) => ({
        ...prev,
        contractCenterId: defaultCenterId ? String(defaultCenterId) : "",
      }));
    }
  }, [contractCentersForContract, isEditing]);

  const serviceContractsForContract = useMemo(() => {
    const contractId = Number(selectedContractId);
    if (!contractId) {
      return [];
    }
    return serviceContracts
      .filter((item) => {
        if (item.contratoId === contractId) {
          return true;
        }
        const contractCenter = contractCenterMap.get(asMapKey(item.contratoCentroAtencionId));
        return contractCenter?.contratoId === contractId;
      })
      .map((item) => {
        const serviceInfo = serviceInfoMap.get(item.servicioId) || {};
        const contractCenter = contractCenterMap.get(asMapKey(item.contratoCentroAtencionId));
        const centroNombre =
          item.centroNombre ||
          contractCenter?.centroNombre ||
          resolveCenterName(contractCenter?.centroId ?? item.centroId ?? item.centroAtencionId);
        return {
          ...item,
          contractCenterId: contractCenter?.idContratoCentro ?? item.contratoCentroAtencionId ?? null,
          centroNombre,
          servicioNombre: item.servicioNombre || serviceInfo.nombre || "",
          precioBase: serviceInfo.precio ?? null,
        };
      });
  }, [serviceContracts, selectedContractId, contractCenterMap, serviceInfoMap, resolveCenterName]);

  const selectedServiceInfo = useMemo(() => {
    const serviceId = Number(serviceForm.serviceId || (isEditing ? editingServiceContract?.servicioId : ""));
    if (!serviceId) {
      return null;
    }
    return serviceInfoMap.get(serviceId) || null;
  }, [serviceForm.serviceId, isEditing, editingServiceContract, serviceInfoMap]);

  const selectedServicePrice = selectedServiceInfo?.precio ?? null;

  const handleChangeContract = (event) => {
    setSelectedContractId(event.target.value);
    setCenterForm({ centerId: "" });
    setServiceForm(DEFAULT_SERVICE_FORM);
    setEditingServiceContract(null);
  };

  const handleCenterSubmit = async (event) => {
    event.preventDefault();
    if (submittingCenter) return;

    const contractId = Number(selectedContractId);
    const centroId = Number(centerForm.centerId);

    if (!contractId) {
      setFeedback("Selecciona un contrato");
      return;
    }
    if (!centroId) {
      setFeedback("Selecciona un Centro");
      return;
    }

    const duplicate = contractCentersForContract.some((item) => item.centroId === centroId);
    if (duplicate) {
      setFeedback("El Centro ya est� asociado al contrato");
      return;
    }

    setSubmittingCenter(true);
    try {
      const { contractCenter } = await createContractCenter({ contratoId: contractId, centroId });
      if (contractCenter) {
        const enriched = { ...contractCenter, centroId: contractCenter.centroId ?? centroId };
        setContractCenters((prev) => [enriched, ...prev]);
      }
      setCenterForm({ centerId: "" });
      setFeedback("Centro vinculado correctamente");
    } catch (err) {
      setFeedback(normalizeError(err));
    } finally {
      setSubmittingCenter(false);
    }
  };

  const handleCenterDelete = async (item) => {
    if (!item?.idContratoCentro) return;
    const confirmed = window.confirm(`Eliminar Centro "${item.centroNombre || resolveCenterName(item.centroId) || item.centroId}" del contrato?`);
    if (!confirmed) return;

    try {
      await deleteContractCenter(item.idContratoCentro);
      setContractCenters((prev) => prev.filter((row) => row.idContratoCentro !== item.idContratoCentro));
      setFeedback("Centro desvinculado");
    } catch (err) {
      setFeedback(normalizeError(err));
    }
  };

  const handleServiceSubmit = async (event) => {
    event.preventDefault();
    if (submittingService) return;

    const contractId = Number(selectedContractId);
    if (!contractId) {
      setFeedback("Selecciona un contrato");
      return;
    }

    const serviceId = Number(serviceForm.serviceId || (isEditing ? editingServiceContract?.servicioId : ""));
    if (!serviceId) {
      setFeedback("Selecciona un servicio");
      return;
    }

    const contractCenterId = Number(serviceForm.contractCenterId || (isEditing ? editingServiceContract?.contractCenterId : ""));
    if (!contractCenterId) {
      setFeedback("Selecciona un Centro vinculado");
      return;
    }

    const { valid, number } = parsePositiveInteger(serviceForm.quantity);
    if (!valid) {
      setFeedback("La cantidad debe ser un entero positivo");
      return;
    }

    const duplicate = serviceContractsForContract.some((item) => item.servicioId === serviceId && item.contractCenterId === contractCenterId);
    if (!isEditing && duplicate) {
      setFeedback("El servicio ya est� asociado a este Centro en el contrato");
      return;
    }

    setSubmittingService(true);
    try {
      if (isEditing && editingServiceContract) {
        const { serviceContract } = await updateServiceContract(editingServiceContract.idServicioContrato, {
          contractCenterId,
          contratoId: contractId,
          servicioId: serviceId,
          cantidad: number,
        });
        if (serviceContract) {
          setServiceContracts((prev) =>
            prev.map((row) => (row.idServicioContrato === serviceContract.idServicioContrato ? serviceContract : row)),
          );
        }
        setFeedback("Servicio actualizado correctamente");
      } else {
        const { serviceContract } = await createServiceContract({
          contractCenterId,
          contratoId: contractId,
          servicioId: serviceId,
          cantidad: number,
        });
        if (serviceContract) {
          setServiceContracts((prev) => [serviceContract, ...prev]);
        }
        setFeedback("Servicio agregado al contrato");
      }
      setServiceForm(DEFAULT_SERVICE_FORM);
      setEditingServiceContract(null);
    } catch (err) {
      setFeedback(normalizeError(err));
    } finally {
      setSubmittingService(false);
    }
  };

  const startServiceEdit = (item) => {
    setEditingServiceContract(item);
    setServiceForm({
      serviceId: String(item.servicioId),
      contractCenterId: item.contractCenterId ? String(item.contractCenterId) : "",
      quantity: item.cantidad != null ? String(item.cantidad) : "",
    });
  };

  const cancelServiceEdit = () => {
    setEditingServiceContract(null);
    setServiceForm(DEFAULT_SERVICE_FORM);
  };

  const handleServiceDelete = async (item) => {
    if (!item?.idServicioContrato) return;
    const confirmed = window.confirm(`Eliminar Centro "${item.centroNombre || resolveCenterName(item.centroId) || item.centroId}" del contrato?`);
    if (!confirmed) return;

    try {
      await deleteServiceContract(item.idServicioContrato);
      setServiceContracts((prev) => prev.filter((row) => row.idServicioContrato !== item.idServicioContrato));
      setFeedback("Servicio eliminado del contrato");
      if (editingServiceContract && editingServiceContract.idServicioContrato === item.idServicioContrato) {
        cancelServiceEdit();
      }
    } catch (err) {
      setFeedback(normalizeError(err));
    }
  };

  const contractOptions = contracts.map((contract) => ({
    id: contract.idContrato,
    label: contract.nombre || contract.codigo || Contrato,
  }));

  const centerOptions = centers.map((center) => ({
    id: center.idCentro,
    label: resolveCenterName(center.idCentro),
  }));

  const serviceOptions = services.map((service) => ({
    id: service.idServicio,
    label: service.nombre || "Servicio",
  }));

  const serviceContractCenterOptions = contractCentersForContract.map((item) => ({
    id: item.idContratoCentro,
    label: item.centroNombre,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Armar contratos</h1>
        <p className="text-sm text-gray-600">
          Selecciona un contrato para vincular Centros de atenci�n y servicios con su cantidad incluida.
        </p>
      </header>

      {loading ? (
        <div className="rounded-xl border border-gray-100 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Cargando informaci�n...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-600 shadow-sm">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <Fragment>
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-700" htmlFor="contract-select">
              Contrato
            </label>
            <select
              id="contract-select"
              value={selectedContractId}
              onChange={handleChangeContract}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            >
              {contractOptions.length === 0 ? <option value="">Sin contratos</option> : null}
              {contractOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {feedback ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700 shadow-sm" role="status">
              {feedback}
            </div>
          ) : null}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Centros vinculados</h2>
              <p className="mt-1 text-sm text-gray-500">
                Asocia Centros de atenci�n al contrato seleccionado. No se permiten duplicados.
              </p>

              <form className="mt-4 space-y-3" onSubmit={handleCenterSubmit}>
                <select
                  name="centerId"
                  value={centerForm.centerId}
                  onChange={(event) => setCenterForm({ centerId: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  disabled={!selectedContractId || submittingCenter}
                >
                  <option value="">Selecciona un Centro</option>
                  {centerOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  disabled={!selectedContractId || submittingCenter}
                >
                  {submittingCenter ? "Agregando..." : "Agregar Centro"}
                </button>
              </form>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-700">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Centro</th>
                      <th className="px-4 py-3 text-right font-medium uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {contractCentersForContract.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-gray-500" colSpan={2}>
                          Sin Centros asociados
                        </td>
                      </tr>
                    ) : (
                      contractCentersForContract.map((item) => (
                        <tr key={item.idContratoCentro} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{item.centroNombre}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleCenterDelete(item)}
                              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Servicios contratados</h2>
              <p className="mt-1 text-sm text-gray-500">
                Define los servicios incluidos y la cantidad de estudios. El precio base del cat�logo se muestra autom�ticamente.
              </p>

              <form className="mt-4 space-y-3" onSubmit={handleServiceSubmit}>
                <select
                  name="serviceId"
                  value={serviceForm.serviceId}
                  onChange={(event) => setServiceForm((prev) => ({ ...prev, serviceId: event.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  disabled={!selectedContractId || submittingService || isEditing}
                >
                  <option value="">Selecciona un servicio</option>
                  {serviceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  name="contractCenterId"
                  value={serviceForm.contractCenterId}
                  onChange={(event) => setServiceForm((prev) => ({ ...prev, contractCenterId: event.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  disabled={!selectedContractId || submittingService || contractCentersForContract.length === 0}
                >
                  <option value="">Selecciona un Centro vinculado</option>
                  {serviceContractCenterOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <input
                  value={selectedServicePrice != null ? formatPrice(selectedServicePrice) : "-"}
                  readOnly
                  className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600"
                  aria-label="Precio del servicio"
                />

                <input
                  name="quantity"
                  value={serviceForm.quantity}
                  onChange={(event) => setServiceForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                  placeholder="Cantidad de estudios"
                  inputMode="numeric"
                  disabled={!selectedContractId || submittingService}
                  required
                />

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    disabled={!selectedContractId || submittingService}
                  >
                    {submittingService
                      ? "Guardando..."
                      : isEditing
                        ? "Guardar cambios"
                        : "Agregar servicio"}
                  </button>
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={cancelServiceEdit}
                      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                      disabled={submittingService}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-700">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Servicio</th>
                      <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Centro</th>
                      <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Precio base</th>
                      <th className="px-4 py-3 text-left font-medium uppercase tracking-wider">Cantidad</th>
                      <th className="px-4 py-3 text-right font-medium uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {serviceContractsForContract.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                          Sin servicios asociados
                        </td>
                      </tr>
                    ) : (
                      serviceContractsForContract.map((item) => (
                        <tr key={item.idServicioContrato} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{item.servicioNombre}</td>
                          <td className="px-4 py-3">{item.centroNombre || "-"}</td>
                          <td className="px-4 py-3">{formatPrice(item.precioBase)}</td>
                          <td className="px-4 py-3">{item.cantidad ?? "-"}</td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => startServiceEdit(item)}
                              className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleServiceDelete(item)}
                              className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </Fragment>
      ) : null}
    </div>
  );
}


