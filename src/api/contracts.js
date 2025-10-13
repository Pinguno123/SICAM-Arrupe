function toTrimmedString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const candidate = toTrimmedString(value);
    if (candidate) {
      return candidate;
    }
  }
  return "";
}

export function mapContractFromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const id =
    data.idContrato ??
    data.id ??
    data.contratoId ??
    data.contractId ??
    null;

  const codigo = firstNonEmpty(
    data.codigo,
    data.code,
    data.contractCode,
    data.numeroContrato,
  );

  const nombre = firstNonEmpty(
    data.nombre,
    data.name,
    data.titulo,
    codigo,
  );

  const estado = firstNonEmpty(
    data.estado,
    data.status,
    data.estadoContrato,
  );

  const descripcion = firstNonEmpty(
    data.descripcion,
    data.description,
    data.detalle,
  );

  const fechaInicio = firstNonEmpty(
    data.fechaInicio,
    data.fecha_inicio,
    data.startDate,
    data.inicioVigencia,
  );

  const fechaFin = firstNonEmpty(
    data.fechaFin,
    data.fecha_fin,
    data.endDate,
    data.finVigencia,
  );

  return {
    idContrato: id,
    nombre,
    codigo: codigo || nombre,
    estado,
    descripcion,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
  };
}

export function mapContractsFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapContractFromApi)
    .filter((item) => item && item.idContrato !== null && item.idContrato !== undefined);
}

export function mapContractToApi(data, { mode = "generic" } = {}) {
  if (!data || typeof data !== "object") {
    return {};
  }

  const trimmedNombre = toTrimmedString(data.nombre ?? data.codigo ?? data.name);
  const payload = {};

  if (mode === "create") {
    if (!trimmedNombre) {
      throw new Error("mapContractToApi: nombre is required for create");
    }
    payload.codigo = trimmedNombre;
    payload.nombre = trimmedNombre;
    payload.estado = "activo";
    return payload;
  }

  if (trimmedNombre) {
    payload.nombre = trimmedNombre;
  }

  const trimmedCodigo = toTrimmedString(data.codigo);
  if (trimmedCodigo) {
    payload.codigo = trimmedCodigo;
  }

  if (data.estado !== undefined && data.estado !== null) {
    payload.estado = String(data.estado).trim();
  }

  if (data.idContrato !== undefined && data.idContrato !== null) {
    payload.idContrato = data.idContrato;
  }

  return payload;
}
