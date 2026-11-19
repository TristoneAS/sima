import { isAuthResponseOk, tieneRolSimaAdmin } from "@/libs/auth_login";

function baseAuth() {
  const configurada = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;
  return String(configurada).trim().replace(/\/+$/, "");
}

function rutaAuth() {
  const ruta = String(
    process.env.AUTH_PATH ||
      process.env.NEXT_PUBLIC_AUTH_PATH ||
      "/SIMA_RH/AUTHENTICATE",
  ).trim();
  return ruta.startsWith("/") ? ruta : `/${ruta}`;
}

function aliasDirectorio(usuario) {
  let acceso = String(usuario || "").trim();
  if (acceso.includes("\\")) acceso = acceso.split("\\").pop();
  if (acceso.includes("@")) acceso = acceso.split("@")[0];
  return acceso.trim();
}

export async function llamarAuthenticate(usuario, clave) {
  const base = baseAuth();
  const acceso = aliasDirectorio(usuario);
  if (!base || !acceso || !clave) {
    const fallo = new Error("Servidor de autenticación no configurado");
    fallo.status = 500;
    throw fallo;
  }

  let response;
  try {
    response = await fetch(`${base}${rutaAuth()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: acceso, password: clave }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      const fallo = new Error(
        "Error al conectar con el servidor de autenticación, contacte a soporte",
      );
      fallo.status = 502;
      throw fallo;
    }
    const fallo = new Error(
      "Error al conectar con el servidor de autenticación, contacte a soporte",
    );
    fallo.status = 502;
    throw fallo;
  }

  let authData = {};
  try {
    authData = await response.json();
  } catch {
    authData = {};
  }

  const persona = authData?.data?.users?.[0] || {};
  const cuenta = String(persona.sAMAccountName || acceso).trim() || acceso;
  const nombre =
    String(persona.displayName || persona.cn || cuenta).trim() || cuenta;
  return {
    response,
    authData,
    usuario: cuenta,
    nombre,
    autorizado: isAuthResponseOk(response, authData),
    admin: isAuthResponseOk(response, authData) && tieneRolSimaAdmin(authData),
  };
}
