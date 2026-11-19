import { connection } from "next/server";
import { jsonError, jsonOk, parseLlegada } from "@/libs/api_helpers";
import { createLlegada, listLlegadas } from "@/libs/sima_db";

export async function GET() {
  await connection();
  try {
    return jsonOk(await listLlegadas());
  } catch (error) {
    return jsonError("No se pudo consultar el llenado", 500, error.message);
  }
}

export async function POST(request) {
  await connection();
  try {
    const parsed = parseLlegada(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const created = await createLlegada(parsed.value);
    return jsonOk(created, "Registro guardado", 201);
  } catch (error) {
    return jsonError(error.message || "No se pudo guardar el registro", error.status || 500);
  }
}
