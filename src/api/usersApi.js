import apiClient from "./httpClient.js";
import { mapUserFromApi, mapUsersFromApi, mapUserToApi } from "./users.js";
import { normaliseListPayload, ensureId } from "./utils.js";
import { apiUrl } from "./routes.js";

const USERS_URL = apiUrl("users");
const resolveUserUrl = (userId) =>
  apiUrl("users", ensureId(userId, "resolveUserUrl", "userId is required"));

const extractUsers = (payload) => {
  const normalised = normaliseListPayload(payload);
  if (normalised.length > 0) {
    return normalised;
  }
  if (Array.isArray(payload?.usuarios)) {
    return payload.usuarios;
  }
  return [];
};

// Obtiene la lista de usuarios con soporte para distintas formas de respuesta.
export async function listUsers(options = {}) {
  const { signal, query } = options;
  const payload = await apiClient.get(USERS_URL, { signal, query });
  const rawList = extractUsers(payload);
  return {
    users: mapUsersFromApi(rawList),
    raw: payload,
  };
}

// Recupera el detalle de un usuario.
export async function getUser(userId, options = {}) {
  if (userId === undefined || userId === null || userId === "") {
    throw new Error("getUser: userId is required");
  }
  const { signal } = options;
  const payload = await apiClient.get(resolveUserUrl(userId), { signal });
  return {
    user: mapUserFromApi(payload),
    raw: payload,
  };
}

// Crea un usuario validando credenciales y rol.
export async function createUser(data, options = {}) {
  const payload = mapUserToApi(data);
  if (!payload.username) {
    throw new Error("createUser: username is required");
  }
  if (!payload.password) {
    throw new Error("createUser: password is required");
  }
  if (!payload.rol || payload.rol.id === undefined || payload.rol.id === null || payload.rol.id === "") {
    throw new Error("createUser: rol.id is required");
  }
  const { signal } = options;
  const response = await apiClient.post(USERS_URL, {
    data: payload,
    signal,
  });
  return {
    user: mapUserFromApi(response),
    raw: response,
  };
}

// Actualiza un usuario existente asegurando que haya cambios.
export async function updateUser(userId, data, options = {}) {
  if (userId === undefined || userId === null || userId === "") {
    throw new Error("updateUser: userId is required");
  }
  const payload = mapUserToApi(data);
  if (!Object.keys(payload).length) {
    throw new Error("updateUser: data is empty");
  }
  const { signal } = options;
  const response = await apiClient.put(resolveUserUrl(userId), {
    data: payload,
    signal,
  });
  return {
    user: mapUserFromApi(response),
    raw: response,
  };
}

// Elimina un usuario por identificador.
export async function deleteUser(userId, options = {}) {
  if (userId === undefined || userId === null || userId === "") {
    throw new Error("deleteUser: userId is required");
  }
  const { signal } = options;
  await apiClient.delete(resolveUserUrl(userId), { signal });
}
