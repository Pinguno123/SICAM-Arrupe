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

function toNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

function normalisePrice(value) {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }
  const rounded = Math.round(numeric * 100) / 100;
  return rounded;
}

export function mapServiceFromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const id =
    data.idservicio ??
    data.idServicio ??
    data.id ??
    data.servicioId ??
    null;

  const nombre = firstNonEmpty(data.nombre, data.name, data.descripcion);
  const precio = normalisePrice(data.precio ?? data.price ?? data.costo ?? data.monto);

  return {
    idServicio: id,
    nombre,
    precio,
  };
}

export function mapServicesFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapServiceFromApi)
    .filter((item) => item && item.idServicio !== null && item.idServicio !== undefined);
}

export function mapServiceToApi(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  const payload = {};

  if (Object.prototype.hasOwnProperty.call(data, "nombre")) {
    const nombre = TRIM(data.nombre ?? data.name);
    if (nombre) {
      payload.nombre = nombre;
    }
  }

  if (Object.prototype.hasOwnProperty.call(data, "precio")) {
    const precio = normalisePrice(data.precio ?? data.price);
    if (precio !== null) {
      payload.precio = precio;
    }
  }

  return payload;
}
