const TRIM = (value) => {



  if (value === undefined || value === null) {



    return "";



  }



  return String(value).trim();



};







const normaliseId = (value) => {



  if (value === undefined || value === null) {



    return null;



  }



  if (typeof value === "number" && Number.isFinite(value)) {



    return value;



  }



  const trimmed = TRIM(value);



  if (!trimmed) {



    return null;



  }



  const numeric = Number(trimmed);



  if (Number.isFinite(numeric)) {



    return numeric;



  }



  return trimmed;



};







const normaliseString = (value) => {



  const trimmed = TRIM(value);



  return trimmed || "";



};







function resolveRole(data) {



  const roleSource = data?.rol ?? data?.role ?? data?.rolDto ?? null;



  const payload = { id: null, nombre: "" };







  if (typeof roleSource === "object" && roleSource !== null) {



    payload.id = normaliseId(roleSource.id ?? roleSource.idRol ?? roleSource.rolId ?? roleSource.codigo);



    payload.nombre = normaliseString(roleSource.nombre ?? roleSource.name ?? roleSource.descripcion);



  } else if (roleSource !== undefined && roleSource !== null) {



    const parsed = normaliseId(roleSource);



    if (parsed !== null && typeof parsed !== "string") {



      payload.id = parsed;



    } else {



      payload.nombre = normaliseString(roleSource);



    }



  }







  return payload;



}







export function mapUserFromApi(data) {



  if (!data || typeof data !== "object") {



    return null;



  }







  const role = resolveRole(data);







  return {



    idUsuario: normaliseId(data.idUsuario ?? data.id ?? data.usuarioId ?? data.userId ?? data.codigo),



    username: normaliseString(data.username ?? data.userName ?? data.usuario),



    nombre: normaliseString(data.nombre ?? data.firstName ?? data.primerNombre),



    apellido: normaliseString(data.apellido ?? data.lastName ?? data.segundoApellido),



    telefono: normaliseString(data.telefono ?? data.phone ?? data.telefonoCelular ?? data.telefonoFijo),




    password: normaliseString(data.password ?? data.contrasena ?? data.clave ?? data.hash ?? ""),



    activo: data.activo ?? data.enabled ?? data.estado ?? data.activoUsuario ?? null,



    rolId: role.id,



    rolNombre: role.nombre,



  };



}







export function mapUsersFromApi(list) {



  if (!Array.isArray(list)) {



    return [];



  }



  return list



    .map(mapUserFromApi)



    .filter((item) => item && item.idUsuario !== null && item.idUsuario !== undefined);



}







function buildRolePayload(source) {



  if (!source || typeof source !== "object") {



    return null;



  }







  const id = normaliseId(source.id ?? source.idRol ?? source.rolId ?? source.codigo);



  const nombre = normaliseString(source.nombre ?? source.name ?? source.descripcion);



  const payload = {};







  if (id !== null) {



    payload.id = id;



  }







  if (nombre) {



    payload.nombre = nombre;



  }







  return Object.keys(payload).length ? payload : null;



}







export function mapUserToApi(data) {



  if (!data || typeof data !== "object") {



    return {};



  }







  const payload = {};







  if (Object.prototype.hasOwnProperty.call(data, "username")) {



    const username = normaliseString(data.username);



    if (username) {



      payload.username = username;



    }



  }







  if (Object.prototype.hasOwnProperty.call(data, "password")) {



    const password = TRIM(data.password);



    if (password) {



      payload.password = password;



    }



  }







  if (Object.prototype.hasOwnProperty.call(data, "nombre")) {



    const nombre = normaliseString(data.nombre);



    if (nombre) {



      payload.nombre = nombre;



    }



  }







  if (Object.prototype.hasOwnProperty.call(data, "apellido")) {



    const apellido = normaliseString(data.apellido);



    if (apellido) {



      payload.apellido = apellido;



    }



  }







  if (Object.prototype.hasOwnProperty.call(data, "telefono")) {



    const telefono = normaliseString(data.telefono);



    payload.telefono = telefono || null;



  }














  const roleData = data.rol ?? data.role ?? null;



  const candidateRole = roleData && typeof roleData === "object" ? roleData : { id: data.rolId ?? data.roleId ?? data.rol, nombre: data.rolNombre ?? data.roleName };



  const rolePayload = buildRolePayload(candidateRole);







  if (rolePayload) {



    payload.rol = rolePayload;



  }







  return payload;



}





