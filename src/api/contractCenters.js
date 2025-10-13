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

export function mapContractCenterFromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const contrato = data.contrato ?? data.contract ?? data.contratoCentro?.contrato ?? null;
  const centro = data.centroAtencion ?? data.centro ?? data.centro_atencion ?? data.contratoCentro?.centroAtencion ?? null;

  const id =
    data.idContratoCentro ??
    data.id ??
    data.contratoCentroId ??
    data.idcontrato_centro ??
    null;

  const contratoId = toId(
    data.idContrato ??
      data.contratoId ??
      data.idcontrato ??
      contrato?.id ??
      contrato?.idContrato ??
      data.contratoCentroContratoId,
  );

  const centroId = toId(
    data.centroAtencionId ??
      data.idCentroAtencion ??
      data.idCentro ??
      data.centroId ??
      data.idcentro_atencion ??
      centro?.id ??
      centro?.idCentro ??
      data.contratoCentroCentroId,
  );

  const contratoNombre = TRIM(
    data.contratoNombre ??
      contrato?.nombre ??
      contrato?.codigo ??
      data.nombreContrato,
  );

  const centroNombre = TRIM(
    data.centroNombre ??
      data.centroAtencionNombre ??
      data.centro_atencion_nombre ??
      centro?.nombre ??
      data.nombreCentro,
  );

  const activo = typeof data.activo === "boolean" ? data.activo : undefined;

  return {
    idContratoCentro: id,
    contratoId,
    centroId,
    contratoNombre,
    centroNombre,
    activo,
  };
}

export function mapContractCentersFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapContractCenterFromApi)
    .filter((item) => item && item.idContratoCentro !== null && item.idContratoCentro !== undefined);
}

export function mapContractCenterToApi(data, { active = true } = {}) {
  if (!data || typeof data !== "object") {
    return {};
  }

  const contratoId = toId(data.contratoId ?? data.idContrato ?? data.contrato?.id);
  const centroId = toId(data.centroId ?? data.idCentroAtencion ?? data.centroAtencion?.id ?? data.idCentro);

  const payload = {};

  if (contratoId !== null) {
    payload.contrato = { id: contratoId };
    payload.contratoId = contratoId;
  }

  if (centroId !== null) {
    payload.centroAtencion = { id: centroId };
    payload.centroId = centroId;
    payload.centroAtencionId = centroId;
  }

  if (active !== undefined) {
    payload.activo = Boolean(active);
  }

  return payload;
}
