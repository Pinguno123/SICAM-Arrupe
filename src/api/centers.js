const TRIM = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
};

function firstNonEmpty(...values) {
  for (const value of values) {
    const candidate = TRIM(value);
    if (candidate) {
      return candidate;
    }
  }
  return "";
}

export function mapCenterFromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const id =
    data.idcentro_atencion ??
    data.idCentroAtencion ??
    data.idCentro ??
    data.id ??
    data.centroId ??
    null;

  const nombre = firstNonEmpty(data.nombre, data.name, data.descripcion, data.titulo);
  const administrador = firstNonEmpty(data.administrador, data.admin, data.responsable);
  const director = firstNonEmpty(data.director, data.directora, data.encargado);

  return {
    idCentro: id,
    nombre,
    administrador,
    director,
  };
}

export function mapCentersFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapCenterFromApi)
    .filter((item) => item && item.idCentro !== null && item.idCentro !== undefined);
}

function normaliseNullable(value) {
  const trimmed = TRIM(value);
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

export function mapCenterToApi(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  const payload = {};

  if (data.nombre !== undefined) {
    const nombre = TRIM(data.nombre);
    if (nombre) {
      payload.nombre = nombre;
    } else {
      payload.nombre = "";
    }
  }

  if (data.administrador !== undefined) {
    payload.administrador = normaliseNullable(data.administrador);
  }

  if (data.director !== undefined) {
    payload.director = normaliseNullable(data.director);
  }

  return payload;
}
