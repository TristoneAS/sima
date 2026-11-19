/**
 * Misma lectura que CAP: authorization "Authorized", y el texto de error del directorio.
 * SIMA_RH manda el detalle LDAP en error_description, no en error.
 */
export function parseAuthenticatedFlag(value) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0" || normalized === "") return false;
  return false;
}

export function isAuthorizationOk(authData) {
  const authz = String(authData?.authorization ?? "")
    .trim()
    .toLowerCase();
  if (authz === "authorized") return true;
  return parseAuthenticatedFlag(authData?.authenticated);
}

export function isAuthResponseOk(response, authData) {
  if (!response?.ok) return false;
  return isAuthorizationOk(authData);
}

export function textoErrorAuth(authData) {
  return String(
    authData?.error_description || authData?.message || authData?.error || authData?.Message || "",
  )
    .replace(/\u0000/g, "")
    .trim();
}

export function mensajeErrorAuth(authData) {
  const raw = textoErrorAuth(authData);
  const lower = raw.toLowerCase();

  if (lower.includes("sima_admin") || lower.includes("not assigned")) {
    return "No tiene el rol SIMA_Admin";
  }
  if (lower.includes("data 775") || lower.includes("account locked") || lower.includes("locked out")) {
    return "Tu cuenta está bloqueada. Contacta a soporte.";
  }
  if (lower.includes("data 532") || lower.includes("password expired")) {
    return "Tu contraseña ha expirado. Debes cambiarla.";
  }
  if (
    lower.includes("data 533") ||
    lower.includes("data 701") ||
    lower.includes("account disabled") ||
    lower.includes("account expired")
  ) {
    return "Tu cuenta no está activa. Contacta a soporte.";
  }
  if (
    !raw ||
    lower.includes("ldaperr") ||
    lower.includes("dsid-") ||
    lower.includes("acceptsecuritycontext") ||
    lower.includes("data 52e") ||
    lower.includes("authentication failed") ||
    lower.includes("invalid") ||
    lower.includes("credential")
  ) {
    return "Usuario o contraseña incorrectos";
  }

  return "Error al conectar con el servidor de autenticación, contacte a soporte";
}

export function esFalloDeCredencial(authData) {
  return mensajeErrorAuth(authData) === "Usuario o contraseña incorrectos";
}

const GRUPO_ADMIN = "TFT.DEL.PAGES_SIMA_Admin";
const ROL_ADMIN = "SIMA_Admin";

function nombreGrupo(grupo) {
  return String(grupo?.cn ?? grupo ?? "").trim();
}

export function tieneRolSimaAdmin(authData) {
  const roles = Array.isArray(authData?.roles) ? authData.roles.map((rol) => String(rol).trim()) : [];
  if (roles.includes(ROL_ADMIN)) return true;

  const grupos = [
    ...(Array.isArray(authData?.groups) ? authData.groups : []),
    ...(Array.isArray(authData?.data?.groups) ? authData.data.groups : []),
  ].map(nombreGrupo);

  return grupos.some((grupo) => grupo === GRUPO_ADMIN || grupo === ROL_ADMIN);
}
