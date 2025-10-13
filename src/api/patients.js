export function mapPatientFromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const id = data.idPaciente ?? data.id ?? data.pacienteId ?? data.codigo ?? null;

  const firstName =
    data.nombre ??
    data.primerNombre ??
    data.firstName ??
    data.nombres ??
    "";

  const lastName =
    data.apellido ??
    data.apellidos ??
    data.segundoApellido ??
    data.lastName ??
    "";

  const birthDate =
    data.fecha_nacimiento ??
    data.fechaNacimiento ??
    data.fechaNacimientoPaciente ??
    "";

  return {
    idPaciente: id,
    nombre: firstName,
    apellido: lastName,
    genero: normalizeGender(data.genero ?? data.sexo),
    fecha_nacimiento: birthDate || "",
    dui: data.dui ?? data.documento ?? data.numeroDocumento ?? "",
    numero_afiliacion:
      data.numero_afiliacion ?? data.numeroAfiliacion ?? data.afiliacion ?? "",
    telefono_fijo:
      data.telefono_fijo ?? data.telefonoFijo ?? data.telefono ?? "",
    telefono_celular:
      data.telefono_celular ?? data.telefonoCelular ?? data.celular ?? "",
    correo_electronico:
      data.correo_electronico ?? data.correoElectronico ?? data.email ?? "",
    direccion: data.direccion ?? data.domicilio ?? "",
  };
}

export function mapPatientsFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapPatientFromApi)
    .filter((item) => item && item.idPaciente !== null && item.idPaciente !== undefined);
}

export function mapPatientToApi(data) {
  if (!data || typeof data !== "object") {
    return {};
  }
  const payload = {
    nombre: data.nombre ?? "",
    apellido: data.apellido ?? "",
    genero: normalizeGender(data.genero) ?? "",
    fechaNacimiento: data.fecha_nacimiento || data.fechaNacimiento || null,
    dui: data.dui || null,
    numeroAfiliacion: data.numero_afiliacion || data.numeroAfiliacion || null,
    telefonoFijo: data.telefono_fijo || data.telefonoFijo || null,
    telefonoCelular: data.telefono_celular || data.telefonoCelular || null,
    correoElectronico: data.correo_electronico || data.correoElectronico || data.email || null,
    direccion: data.direccion || null,
  };
  if (data.idPaciente !== undefined && data.idPaciente !== null) {
    payload.idPaciente = data.idPaciente;
  }
  return payload;
}

function normalizeGender(value) {
  if (!value) return "";
  const upper = String(value).trim().toUpperCase();
  if (upper === "F" || upper === "M") {
    return upper;
  }
  return value;
}
