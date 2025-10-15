const TRIM = (value) => (value === undefined || value === null ? "" : String(value).trim());

function toId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return value;
}

function toQuantity(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(0, Math.trunc(numeric));
}

export function mapServiceContractFromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const contractCenter =
    data.contratoCentroAtencion ??
    data.contratoCentro ??
    data.contratoCentroAtencionDTO ??
    null;

  const contratoBase = contractCenter?.contrato ?? data.contrato ?? null;
  const servicioBase = data.servicio ?? contractCenter?.servicio ?? null;
  const centroBase = contractCenter?.centroAtencion ?? data.centroAtencion ?? data.centro ?? null;

  const id =
    data.idServicioContrato ??
    data.id ??
    data.servicioContratoId ??
    data.idservicio_contrato ??
    null;

  const contratoId = toId(
    data.idContrato ??
      data.contratoId ??
      data.idcontrato ??
      contratoBase?.id ??
      contratoBase?.idContrato ??
      data.servicioContratoContratoId,
  );

  const servicioId = toId(
    data.idServicio ??
      data.servicioId ??
      data.idservicio ??
      servicioBase?.id ??
      servicioBase?.idServicio ??
      data.servicioContratoServicioId,
  );

  const contractCenterId = toId(
    data.contratoCentroAtencionId ??
      data.idContratoCentroAtencion ??
      data.idContratoCentro ??
      contractCenter?.id ??
      null,
  );

  const centroId = toId(
    data.centroId ??
      data.idCentro ??
      centroBase?.id ??
      centroBase?.idCentro ??
      null,
  );

  const cantidad = toQuantity(data.cantidad ?? data.quantity ?? data.numeroEstudios);

  const contratoNombre = TRIM(
    data.contratoNombre ??
      contratoBase?.nombre ??
      contratoBase?.codigo ??
      data.nombreContrato,
  );

  const servicioNombre = TRIM(
    data.servicioNombre ??
      servicioBase?.nombre ??
      data.nombreServicio,
  );

  const centroNombre = TRIM(
    data.centroNombre ??
      centroBase?.nombre ??
      data.nombreCentro,
  );

  return {
    idServicioContrato: id,
    contratoId,
    servicioId,
    contratoCentroAtencionId: contractCenterId,
    centroId,
    cantidad,
    contratoNombre,
    servicioNombre,
    centroNombre,
  };
}

export function mapServiceContractsFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapServiceContractFromApi)
    .filter((item) => item && item.idServicioContrato !== null && item.idServicioContrato !== undefined);
}

export function mapServiceContractToApi(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  const payload = {};

  const contractCenterId = toId(
    data.contractCenterId ??
      data.contratoCentroAtencionId ??
      data.contratoCentroAtencion?.id ??
      data.contratoCentroId ??
      null,
  );
  if (contractCenterId !== null) {
    payload.contratoCentroAtencionId = contractCenterId;
  }

  const servicioId = toId(data.servicioId ?? data.idServicio ?? data.servicio?.id);
  if (servicioId !== null) {
    payload.servicioId = servicioId;
  }

  const cantidad = toQuantity(data.cantidad ?? data.quantity ?? data.numeroEstudios);
  if (cantidad !== null) {
    payload.cantidad = cantidad;
  }

  return payload;
}
