import { connection } from "next/server";
import { jsonError, jsonOk, parseLugar } from "@/libs/api_helpers";
import { createLugar, listLugares } from "@/libs/sima_db";

export async function GET() {
  await connection();
  try {
    return jsonOk(await listLugares());
  } catch (error) {
    return jsonError("No se pudo consultar el catálogo de lugares", 500, error.message);
  }
}

export async function POST(request) {
  await connection();
  try {
    const parsed = parseLugar(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const created = await createLugar(parsed.value);
    return jsonOk(created, "Lugar agregado", 201);
  } catch (error) {
    return jsonError(error.message || "No se pudo agregar el lugar", error.status || 500);
  }
}
