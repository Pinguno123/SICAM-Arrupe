# Sistema Clinica - Autenticacion del Frontend

Proyecto Vite + React con flujo de autenticacion reutilizable. La coleccion Postman `Clinica API` se mantiene en el repositorio como referencia documental, pero la aplicacion se configura unicamente mediante variables de entorno.

## Variables de entorno

Crea un archivo `.env` (clave `VITE_` porque el build es de Vite):

```
VITE_API_BASE_URL=http://localhost:8080   # opcional, por defecto http://localhost:8080
VITE_API_PREFIX=api                       # opcional, por defecto api
VITE_AUTH_PREFIX=auth                     # opcional, por defecto auth
VITE_USE_API_PROXY=true                   # opcional (solo dev)

# Opciones especificas de autenticacion (todas opcionales)
VITE_AUTH_LOGIN_PATH=/auth/login
VITE_AUTH_LOGIN_METHOD=POST
VITE_AUTH_LOGIN_BODY=form                 # form | json

VITE_AUTH_REFRESH_PATH=/auth/refresh      # deja vacio o "none" para deshabilitar
VITE_AUTH_REFRESH_METHOD=POST
VITE_AUTH_REFRESH_BODY=json               # form | json

VITE_AUTH_LOGOUT_PATH=/auth/logout
VITE_AUTH_LOGOUT_METHOD=POST
```

- Si `VITE_API_BASE_URL` queda vacio, las llamadas usaran rutas relativas y, en desarrollo, pasaran por el proxy configurado en `vite.config.js`.
- Prefijos y rutas se limpian automaticamente; puedes usar rutas absolutas (`https://api.ejemplo.com/login`) si lo prefieres.
- Para deshabilitar el endpoint de refresh establece `VITE_AUTH_REFRESH_PATH=none` (el cliente intentara re-loggearse usando las credenciales guardadas).

## Uso basico

```js
import { login, logout } from "./src/api/authService.js";
import apiClient from "./src/api/httpClient.js";
import tokenManager from "./src/api/tokenManager.js";

async function runExample() {
  await login({ username: "admin", password: "admin123" });

  const centros = await apiClient.get("/centros");
  console.log("Centros", centros);

  tokenManager.set({ access_token: tokenManager.accessToken, expires_in: 1 });
  await tokenManager.refreshIfNeeded({ force: true });

  await apiClient.get("/centros");
  await logout({ withServerRevoke: false });
}
```

## Seguridad y almacenamiento

- Access token en memoria; refresh token opcionalmente en cookie `Secure; SameSite=Lax` (el backend debe emitirla).
- Se resta un margen de 60s antes de expirar (`expires_at = exp - 60`).
- No se usan `localStorage` ni logs para persistir tokens.
- Si el backend requiere anti-CSRF, añade el header correspondiente antes de llamar a `apiClient`.

## Pruebas

```
npm install
npx vitest run
```

## Componentes principales

- `src/api/config.js`: lee variables de entorno y expone URLs/prefijos.
- `src/api/tokenManager.js`: normaliza `{access_token, refresh_token, expires_in}` y maneja expiracion.
- `src/api/authService.js`: orquesta login/refresh/logout y configura los handlers del TokenManager.
- `src/api/httpClient.js`: wrapper con refresh previo y reintento automatico ante 401/403.
- `src/api/__tests__/auth.test.js`: pruebas unitarias del flujo.

## Coleccion Postman (referencia)

La carpeta `src/PostmanCollection` conserva la coleccion original para consultar ejemplos de payloads. Ningun modulo de runtime depende de ella.

## Notas para backend & frontend

- Backend: mantén los tokens en un almacén seguro (cache/BD) y devuelve `refresh_token` + `expires_in` desde `/auth/login` y `/auth/refresh`.
- Frontend/Tauri: evita exponer tokens a la UI; usa cookies HttpOnly emitidas por el backend si necesitas persistencia.
- Ajusta las variables `VITE_AUTH_*` segun tu API sin tocar el codigo fuente.
