import { connection } from "next/server";
import { jsonError, jsonOk } from "@/libs/api_helpers";
import { esFalloDeCredencial, mensajeErrorAuth } from "@/libs/auth_login";
import { llamarAuthenticate } from "@/libs/auth_directorio";
import { validarAcceso } from "@/libs/sima_db";

const COOKIE = "sima_acceso";

function marcarAcceso(response, configuracion) {
  response.cookies.set(COOKIE, configuracion ? "configuracion" : "operacion", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}

export async function POST(request) {
  await connection();
  try {
    const body = await request.json();
    const usuario = String(body?.usuario ?? body?.username ?? "").trim();
    const clave = String(body?.clave ?? body?.password ?? "");
    if (!usuario || !clave) return jsonError("Ingrese usuario y contraseña", 400);

    let directorio = null;
    try {
      directorio = await llamarAuthenticate(usuario, clave);
    } catch (error) {
      if (error?.status === 502 || error?.status === 500) return jsonError(error.message, error.status);
      directorio = null;
    }

    if (directorio?.admin) {
      return marcarAcceso(
        jsonOk(
          { usuario: directorio.usuario, nombre: directorio.nombre, configuracion: true },
          "Acceso concedido",
        ),
        true,
      );
    }

    if (directorio?.autorizado) {
      return jsonError("No tiene el rol SIMA_Admin", 403);
    }

    const mensaje = mensajeErrorAuth(directorio?.authData);
    if (directorio && !esFalloDeCredencial(directorio.authData)) {
      const status = mensaje === "No tiene el rol SIMA_Admin" ? 403 : 401;
      return jsonError(mensaje, status);
    }

    const local = await validarAcceso(usuario, clave);
    if (local && local.configuracion === false) {
      return marcarAcceso(jsonOk(local, "Acceso concedido"), false);
    }
    if (local?.configuracion && !directorio) {
      return marcarAcceso(jsonOk(local, "Acceso concedido"), true);
    }

    return jsonError(mensaje || "Usuario o contraseña incorrectos", 401);
  } catch (error) {
    return jsonError("No se pudo validar el acceso", 500, error.message);
  }
}

export async function DELETE() {
  await connection();
  const response = jsonOk({ ok: true });
  response.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
