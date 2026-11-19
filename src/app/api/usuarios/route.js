import { connection } from "next/server";
import { jsonError, jsonOk, parseUsuario } from "@/libs/api_helpers";
import { createUsuario, listUsuarios } from "@/libs/sima_db";

export async function GET() {
  await connection();
  try {
    return jsonOk(await listUsuarios());
  } catch (error) {
    return jsonError("No se pudo consultar el catálogo de usuarios", 500, error.message);
  }
}

export async function POST(request) {
  await connection();
  try {
    const parsed = parseUsuario(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const created = await createUsuario(parsed.value);
    return jsonOk(created, "Usuario agregado", 201);
  } catch (error) {
    return jsonError(error.message || "No se pudo agregar el usuario", error.status || 500);
  }
}
