import { mapPatientFromApi } from "./patients.js";
import { mapServiceFromApi } from "./services.js";
import { mapContractFromApi } from "./contracts.js";
import { mapCenterFromApi } from "./centers.js";
import { mapUserFromApi } from "./users.js";

const TRIM = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(TRIM(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const toId = (value) => {
  const numeric = toNumber(value);
  if (numeric !== null) {
    return numeric;
  }
  const trimmed = TRIM(value);
  return trimmed || null;
};

const toBooleanFlag = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === undefined || value === null) {
    return null;
  }
  const normalised = TRIM(value).toLowerCase();
  if (!normalised) {
    return null;
  }
  if (["1", "true", "yes", "si", "on"].includes(normalised)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalised)) {
    return false;
  }
  return null;
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const normaliseDateOutput = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }
  const trimmed = TRIM(value);
  if (!trimmed) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  if (trimmed.length >= 10) {
    return trimmed.slice(0, 10);
  }
  return trimmed;
};

const normaliseDateForRead = (value) => normaliseDateOutput(value) ?? "";

const mergeNames = (first, last) => {
  const f = TRIM(first);
  const l = TRIM(last);
  return [f, l].filter(Boolean).join(" ");
};

const pickName = (value) => {
  const trimmed = TRIM(value);
  if (trimmed) {
    return trimmed;
  }
  return "";
};

const asPatient = (source) => {
  if (!source || typeof source !== "object") {
    return null;
  }
  return mapPatientFromApi(source);
};

const asContract = (source) => {
  if (!source || typeof source !== "object") {
    return null;
  }
  return mapContractFromApi(source);
};

const asService = (source) => {
  if (!source || typeof source !== "object") {
    return null;
  }
  return mapServiceFromApi(source);
};

const asCenter = (source) => {
  if (!source || typeof source !== "object") {
    return null;
  }
  return mapCenterFromApi(source);
};

const asUser = (source) => {
  if (!source || typeof source !== "object") {
    return null;
  }
  return mapUserFromApi(source);
};

export const DEFAULT_PHASES = [
  { idFase: "0", nombre: "Precita" },
  { idFase: "1", nombre: "Cita" },
  { idFase: "2", nombre: "Registro" },
  { idFase: "3", nombre: "Lectura" },
  { idFase: "4", nombre: "Entrega" },
];

export function mapDoctorTurnoFromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }
  const id = toId(data.idDoctorTurno ?? data.id ?? data.turnoId ?? data.doctorTurnoId);
  const fecha = normaliseDateForRead(data.fecha ?? data.fechaTurno ?? data.turnoFecha ?? data.fecha_turno);
  const hora = TRIM(data.hora ?? data.horaTurno ?? data.turnoHora ?? data.horaInicio ?? data.hora_turno);
  const doctorSource =
    data.doctor ??
    data.doctorHorario?.doctor ??
    data.usuario ??
    data.doctorAsignado ??
    data.medico ??
    null;
  const doctor = asUser(doctorSource);
  const doctorId =
    doctor?.idUsuario ??
    toId(
      data.doctorId ??
        data.idDoctor ??
        data.idMedico ??
        data.doctorHorario?.doctorId ??
        data.usuarioEntregaId,
    );
  const doctorNombre = doctor ? mergeNames(doctor.nombre, doctor.apellido) : mergeNames(data.doctorNombre, data.doctorApellido);
  const cupo = toNumber(
    data.pacientesAsignados ?? data.cuposAsignados ?? data.capacidad ?? data.cupo ?? null,
  );
  return {
    idTurno: id,
    fecha,
    hora,
    doctor_id: doctorId,
    doctor_nombre: doctor?.nombre ?? pickName(data.doctorNombre),
    doctor_apellido: doctor?.apellido ?? pickName(data.doctorApellido),
    doctor_nombre_completo: doctorNombre,
    cupo,
    raw: data,
  };
}

export function mapDoctorTurnosFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapDoctorTurnoFromApi)
    .filter((item) => item && item.idTurno !== null);
}

const resolveDoctorTurno = (data) => {
  if (!data) {
    return null;
  }
  if (data.idTurno !== undefined && data.fecha !== undefined) {
    return data;
  }
  return mapDoctorTurnoFromApi(data);
};

export function mapAppointmentFromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const id = toId(data.idCita ?? data.id ?? data.citaId ?? data.codigo);
  if (id === null) {
    return null;
  }

  const paciente =
    asPatient(data.paciente ?? data.patient ?? data.pacienteDto ?? null) ??
    (data.pacienteId ? { idPaciente: toId(data.pacienteId) } : null);
  const contratoSource =
    data.contrato ??
    data.contract ??
    data.contratoDto ??
    (data.idContrato || data.contratoId || data.contratoNombre
      ? { idContrato: data.idContrato ?? data.contratoId, nombre: data.contratoNombre }
      : null);
  const servicioSource =
    data.servicio ??
    data.service ??
    data.servicioDto ??
    (data.idServicio || data.servicioId || data.servicioNombre
      ? { idServicio: data.idServicio ?? data.servicioId, nombre: data.servicioNombre ?? data.servicio }
      : null);
  const centroSource =
    data.centroAtencion ??
    data.centro ??
    data.centroDto ??
    (data.idCentroAtencion || data.centroId || data.centroNombre
      ? { idCentro_Atencion: data.idCentroAtencion ?? data.centroId, nombre: data.centroNombre }
      : null);

  const contrato = asContract(contratoSource);
  const servicio = asService(servicioSource);
  const centro = asCenter(centroSource);
  const turno = resolveDoctorTurno(
    data.doctorTurno ??
      data.turno ??
      data.turnoAsignado ??
      data.citaTurno ??
      data.turnoDto ??
      null,
  );
  const doctorAsignado =
    asUser(
      data.doctorAsignado ??
        data.doctor ??
        data.medicoAsignado ??
        data.professional ??
        data.usuarioEntrega ??
        null,
    ) ?? (data.doctorAsignadoId ? { idUsuario: toId(data.doctorAsignadoId) } : null);
  const faseSource = data.fase ?? data.estado ?? data.faseDto ?? null;
  const faseId = toId(faseSource?.id ?? data.idFase ?? data.faseId ?? data.estadoFaseId);
  const faseNombre = pickName(
    faseSource?.nombre ??
      faseSource?.name ??
      data.faseNombre ??
      data.estadoFase ??
      data.nombreFase,
  );
  const fechaReferencia = normaliseDateForRead(
    data.fechaReferencia ??
      data.fecha_referencia ??
      data.fechaReferenciaCita ??
      data.fecha ??
      data.fechaCita,
  );
  const medicoReferido = TRIM(
    data.medicoReferido ??
      data.medico_referido ??
      data.medicoReferencia ??
      data.doctorReferido ??
      data.referido,
  );
  const confirmadaFlag = toBooleanFlag(data.confirmada ?? data.estadoConfirmada ?? data.citaConfirmada);
  const confirmada = confirmadaFlag === null ? Boolean(data.confirmada) : confirmadaFlag;

  return {
    idCita: id,
    idPaciente: paciente?.idPaciente ?? toId(data.idPaciente ?? data.pacienteId),
    paciente_nombre:
      paciente?.nombre ||
      TRIM(data.pacienteNombre) ||
      TRIM(data.nombrePaciente) ||
      TRIM(data.paciente_nombre) ||
      TRIM(data.pacienteNombreCompleto) ||
      "",
    paciente_apellido:
      paciente?.apellido ||
      TRIM(data.pacienteApellido) ||
      TRIM(data.apellidoPaciente) ||
      TRIM(data.paciente_apellido) ||
      TRIM(data.pacienteApellidoCompleto) ||
      "",
    idContrato: contrato?.idContrato ?? toId(data.idContrato ?? data.contratoId),
    contrato_nombre:
      contrato?.nombre ?? (
        TRIM(data.contratoNombre) ||
        TRIM(data.nombreContrato) ||
        ""
      ),
    idCentro_Atencion: centro?.idCentro ?? centro?.idCentro_Atencion ?? toId(data.idCentroAtencion ?? data.centroId),
    centro_nombre:
      centro?.nombre ?? (
        TRIM(data.centroNombre) ||
        TRIM(data.nombreCentro) ||
        ""
      ),
    idServicio:
      servicio?.idServicio ??
      toId(
        data.idServicio ??
          data.servicioId ??
          data.servicioContratoId ??
          data.idServicioContrato,
      ),
    servicio_nombre:
      servicio?.nombre ?? (
        TRIM(data.servicioNombre) ||
        TRIM(data.nombreServicio) ||
        TRIM(data.servicioDescripcion) ||
        TRIM(data.estudio) ||
        TRIM(data.servicio) ||
        ""
      ),
    idFase: faseId,
    fase_nombre: faseNombre,
    idTurno: turno?.idTurno ?? toId(data.idTurno ?? data.turnoId ?? data.doctorTurnoId),
    turno_fecha: turno?.fecha ?? normaliseDateForRead(data.turnoFecha ?? data.fechaTurno),
    turno_hora: turno?.hora ?? TRIM(data.turnoHora ?? data.horaTurno),
    turno_doctor_nombre: turno?.doctor_nombre_completo ?? mergeNames(data.turnoDoctorNombre, data.turnoDoctorApellido),
    fecha_referencia: fechaReferencia,
    medico_referido: medicoReferido,
    confirmada,
    paciente,
    contrato,
    servicio,
    centro,
    doctorTurno: turno ?? null,
    doctorAsignado: doctorAsignado ?? null,
    raw: data,
  };
}

export function mapAppointmentsFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapAppointmentFromApi)
    .filter((item) => item && item.idCita !== null);
}

const buildEntityReference = (id) => {
  const normalised = toId(id);
  return normalised === null ? null : { id: normalised };
};

const maybeAssign = (target, key, value) => {
  if (value === undefined) {
    return;
  }
  target[key] = value;
};

export function buildAppointmentApiPayload(data = {}) {
  const payload = {};
  const pacienteRef = buildEntityReference(data.pacienteId ?? data.idPaciente);
  if (pacienteRef) {
    payload.paciente = pacienteRef;
  }

  const servicioRef = buildEntityReference(data.servicioId ?? data.idServicio);
  if (servicioRef) {
    payload.servicio = servicioRef;
  }

  const contratoRef = buildEntityReference(data.contratoId ?? data.idContrato);
  if (contratoRef) {
    payload.contrato = contratoRef;
  }

  const centroRef = buildEntityReference(
    data.centroAtencionId ?? data.idCentro_Atencion ?? data.idCentroAtencion,
  );
  if (centroRef) {
    payload.centroAtencion = centroRef;
  }

  const faseRef = buildEntityReference(data.faseId ?? data.idFase);
  if (faseRef) {
    payload.fase = faseRef;
  }

  const turnoRef = buildEntityReference(data.turnoId ?? data.idTurno);
  if (turnoRef) {
    payload.doctorTurno = turnoRef;
  }

  const doctorAsignadoRef = buildEntityReference(
    data.doctorAsignadoId ?? data.idDoctorAsignado,
  );
  if (doctorAsignadoRef) {
    payload.doctorAsignado = doctorAsignadoRef;
  }

  if (hasOwn(data, "confirmada")) {
    const flag = toBooleanFlag(data.confirmada);
    payload.confirmada = flag === null ? Boolean(data.confirmada) : flag;
  }

  if (hasOwn(data, "medico_referido") || hasOwn(data, "medicoReferido")) {
    const refer = TRIM(data.medicoReferido ?? data.medico_referido);
    payload.medicoReferido = refer || null;
  }

  if (hasOwn(data, "fechaReferencia") || hasOwn(data, "fecha_referencia")) {
    const fecha = normaliseDateOutput(data.fechaReferencia ?? data.fecha_referencia);
    payload.fechaReferencia = fecha ?? null;
  }

  return payload;
}

export function buildAppointmentCreatePayload(data = {}) {
  const basePayload = buildAppointmentApiPayload(data);
  const allowedKeys = new Set([
    "paciente",
    "servicio",
    "contrato",
    "centroAtencion",
    "fase",
    "doctorTurno",
    "doctorAsignado",
    "confirmada",
    "medicoReferido",
    "fechaReferencia",
  ]);
  const payload = Object.entries(basePayload).reduce((acc, [key, value]) => {
    if (!allowedKeys.has(key)) {
      return acc;
    }
    if (value === undefined || value === null) {
      return acc;
    }
    if (typeof value === "string" && value.trim() === "") {
      return acc;
    }
    if (typeof value === "object") {
      const isEmpty = Array.isArray(value)
        ? value.length === 0
        : Object.keys(value).length === 0;
      if (isEmpty) {
        return acc;
      }
    }
    acc[key] = value;
    return acc;
  }, {});
  if (!payload.paciente?.id) {
    throw new Error("buildAppointmentCreatePayload: pacienteId es obligatorio");
  }
  if (!payload.servicio?.id) {
    throw new Error("buildAppointmentCreatePayload: servicioId es obligatorio");
  }
  if (!payload.contrato?.id) {
    throw new Error("buildAppointmentCreatePayload: contratoId es obligatorio");
  }
  if (!payload.centroAtencion?.id) {
    throw new Error("buildAppointmentCreatePayload: centroAtencionId es obligatorio");
  }
  if (!payload.fase?.id) {
    throw new Error("buildAppointmentCreatePayload: faseId es obligatorio");
  }
  if (!hasOwn(payload, "confirmada")) {
    payload.confirmada = false;
  }
  return payload;
}

export function buildAppointmentUpdatePayload(data = {}) {
  return buildAppointmentApiPayload(data);
}

export function mapPhase1FromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }
  const id = toId(data.idFase1 ?? data.id ?? data.fase1Id ?? data.codigo);
  const citaId = toId(data.citaId ?? data.idCita ?? data.cita?.id ?? data.cita?.idCita);
  const licenciada =
    asUser(data.licenciada ?? data.licenciadaEncargada ?? data.usuario ?? data.licenciadaDto ?? null) ??
    (data.licenciadaId ? { idUsuario: toId(data.licenciadaId) } : null);
  const licenciadaId =
    licenciada?.idUsuario ??
    toId(
      data.licenciadaId ??
        data.idLicenciada ??
        data.idLic_encargada ??
        data.usuarioEntregaId ??
        data.encargadaId,
    );
  const fechaEntrega = normaliseDateForRead(
    data.fechaEntrega ??
      data.fecha_entrega ??
      data.fechaProgramadaEntrega ??
      data.fechaProgramada ??
      data.fecha,
  );

  return {
    idFase1: id,
    citaId,
    fecha_realizacion: normaliseDateForRead(data.fechaRealizacion ?? data.fecha_realizacion),
    fecha_programada_entrega: fechaEntrega,
    fecha_entrega: fechaEntrega,
    idLic_encargada: licenciadaId,
    licenciada_nombre: mergeNames(licenciada?.nombre ?? data.licenciadaNombre, licenciada?.apellido ?? data.licenciadaApellido),
    raw: data,
  };
}

export function mapPhase1ListFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapPhase1FromApi)
    .filter((item) => item && item.idFase1 !== null);
}

export function buildPhase1CreatePayload(data = {}) {
  const citaId = toId(data.citaId ?? data.idCita ?? data.appointmentId);
  const licenciadaId = toId(data.licenciadaId ?? data.idLic_encargada ?? data.usuarioEntregaId);
  if (citaId === null) {
    throw new Error("buildPhase1CreatePayload: citaId es obligatorio");
  }
  if (licenciadaId === null) {
    throw new Error("buildPhase1CreatePayload: licenciadaId es obligatorio");
  }
  const fechaEntrega = normaliseDateOutput(
    data.fechaEntrega ?? data.fecha_programada_entrega ?? data.fecha_entrega ?? data.fecha,
  );
  return {
    citaId,
    licenciadaId,
    fechaEntrega: fechaEntrega ?? null,
  };
}

export function buildPhase1UpdatePayload(data = {}) {
  const payload = {};
  const licenciadaId = toId(data.licenciadaId ?? data.idLic_encargada ?? data.usuarioEntregaId);
  if (licenciadaId !== null) {
    payload.licenciadaId = licenciadaId;
  }
  const fechaEntrega = normaliseDateOutput(
    data.fechaEntrega ?? data.fecha_programada_entrega ?? data.fecha_entrega ?? data.fecha,
  );
  if (fechaEntrega !== null) {
    payload.fechaEntrega = fechaEntrega;
  }
  return payload;
}

export function mapPhase2FromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }
  const id = toId(data.idFase2 ?? data.id ?? data.fase2Id ?? data.codigo);
  const citaId = toId(data.citaId ?? data.idCita ?? data.cita?.id ?? data.cita?.idCita);
  const doctor =
    asUser(data.doctor ?? data.doctorLectura ?? data.medico ?? data.usuario ?? data.doctorDto ?? null) ??
    (data.doctorId ? { idUsuario: toId(data.doctorId) } : null);
  const doctorId =
    doctor?.idUsuario ??
    toId(
      data.doctorId ??
        data.idDoctor ??
        data.idDoctor_Qlee ??
        data.lectorId ??
        data.usuarioLecturaId,
    );
  const birads = TRIM(data.birads ?? data.detalle ?? "");
  return {
    idFase2: id,
    citaId,
    idDoctor_Qlee: doctorId,
    birads,
    raw: data,
    doctor_nombre: doctor?.nombre ?? pickName(data.doctorNombre),
    doctor_apellido: doctor?.apellido ?? pickName(data.doctorApellido),
  };
}

export function mapPhase2ListFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapPhase2FromApi)
    .filter((item) => item && item.idFase2 !== null);
}

export function buildPhase2CreatePayload(data = {}) {
  const citaId = toId(data.citaId ?? data.idCita ?? data.appointmentId);
  const doctorId = toId(data.doctorId ?? data.idDoctor_Qlee ?? data.lectorId);
  if (citaId === null) {
    throw new Error("buildPhase2CreatePayload: citaId es obligatorio");
  }
  if (doctorId === null) {
    throw new Error("buildPhase2CreatePayload: doctorId es obligatorio");
  }
  const payload = {
    citaId,
    doctorId,
  };
  const birads = TRIM(data.birads ?? "");
  if (birads) {
    payload.birads = birads;
  }
  return payload;
}

export function buildPhase2UpdatePayload(data = {}) {
  const payload = {};
  const doctorId = toId(data.doctorId ?? data.idDoctor_Qlee ?? data.lectorId);
  if (doctorId !== null) {
    payload.doctorId = doctorId;
  }
  if (hasOwn(data, "birads")) {
    payload.birads = TRIM(data.birads ?? "");
  }
  return payload;
}

export function mapPhase3FromApi(data) {
  if (!data || typeof data !== "object") {
    return null;
  }
  const id = toId(data.idFase3 ?? data.id ?? data.fase3Id ?? data.codigo);
  const citaId = toId(data.citaId ?? data.idCita ?? data.cita?.id ?? data.cita?.idCita);
  const usuarioEntrega =
    asUser(data.usuarioEntrega ?? data.usuario ?? data.entregadoPor ?? data.usuarioDto ?? null) ??
    (data.usuarioEntregaId ? { idUsuario: toId(data.usuarioEntregaId) } : null);
  const usuarioEntregaId =
    usuarioEntrega?.idUsuario ??
    toId(
      data.usuarioEntregaId ??
        data.idUsuarioEntrega ??
        data.idEntrega ??
        data.idUsuario ??
        data.entregaId,
    );
  const fechaEntrega = normaliseDateForRead(
    data.fechaEntrega ??
      data.fecha_entrega ??
      data.fechaEntregaResultados ??
      data.fecha ??
      data.entregaFecha,
  );
  const retiradaFlag = toBooleanFlag(
    data.retiradaPorUsuario ??
      data.retirada_por_usuario ??
      data.entregado ??
      data.seRetiro,
  );
  return {
    idFase3: id,
    citaId,
    usuarioEntregaId,
    fecha_entrega: fechaEntrega,
    retirada_por_usuario: retiradaFlag === null ? Boolean(data.retiradaPorUsuario) : retiradaFlag,
    nombre: TRIM(data.nombre ?? data.nombreEntrega ?? data.entregadoA ?? ""),
    dui: TRIM(data.dui ?? data.documento ?? data.numeroDocumento ?? ""),
    raw: data,
  };
}

export function mapPhase3ListFromApi(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(mapPhase3FromApi)
    .filter((item) => item && item.idFase3 !== null);
}

export function buildPhase3CreatePayload(data = {}) {
  const citaId = toId(data.citaId ?? data.idCita ?? data.appointmentId);
  const usuarioEntregaId = toId(data.usuarioEntregaId ?? data.idUsuarioEntrega ?? data.idUsuario ?? data.idUsuarioEntregaResultados);
  if (citaId === null) {
    throw new Error("buildPhase3CreatePayload: citaId es obligatorio");
  }
  const payload = {
    citaId,
  };
  if (usuarioEntregaId !== null) {
    payload.usuarioEntregaId = usuarioEntregaId;
  }
  const retirada = toBooleanFlag(data.retiradaPorUsuario ?? data.retirada_por_usuario);
  if (retirada !== null) {
    payload.retiradaPorUsuario = retirada;
  }
  const fechaEntrega = normaliseDateOutput(data.fechaEntrega ?? data.fecha_entrega ?? data.fecha);
  if (fechaEntrega !== null) {
    payload.fechaEntrega = fechaEntrega;
  }
  if (hasOwn(data, "nombre")) {
    payload.nombre = TRIM(data.nombre ?? "") || null;
  }
  if (hasOwn(data, "dui")) {
    payload.dui = TRIM(data.dui ?? "") || null;
  }
  return payload;
}

export function buildPhase3UpdatePayload(data = {}) {
  const payload = {};
  const usuarioEntregaId = toId(data.usuarioEntregaId ?? data.idUsuarioEntrega ?? data.idUsuario);
  if (usuarioEntregaId !== null) {
    payload.usuarioEntregaId = usuarioEntregaId;
  }
  if (hasOwn(data, "retiradaPorUsuario") || hasOwn(data, "retirada_por_usuario")) {
    const retirada = toBooleanFlag(data.retiradaPorUsuario ?? data.retirada_por_usuario);
    payload.retiradaPorUsuario = retirada === null ? Boolean(data.retiradaPorUsuario ?? data.retirada_por_usuario) : retirada;
  }
  if (hasOwn(data, "nombre")) {
    payload.nombre = TRIM(data.nombre ?? "") || null;
  }
  if (hasOwn(data, "dui")) {
    payload.dui = TRIM(data.dui ?? "") || null;
  }
  if (hasOwn(data, "fechaEntrega") || hasOwn(data, "fecha_entrega")) {
    const fechaEntrega = normaliseDateOutput(data.fechaEntrega ?? data.fecha_entrega ?? data.fecha);
    if (fechaEntrega !== null) {
      payload.fechaEntrega = fechaEntrega;
    }
  }
  return payload;
}
