import { connection } from "next/server";
import { jsonError, jsonOk, parseRuta } from "@/libs/api_helpers";
import { createRuta, listRutas } from "@/libs/sima_db";

export async function GET() {
  await connection();
  try {
    return jsonOk(await listRutas());
  } catch (error) {
    return jsonError("No se pudo consultar el catálogo de rutas", 500, error.message);
  }
}

export async function POST(request) {
  await connection();
  try {
    const parsed = parseRuta(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const created = await createRuta(parsed.value);
    return jsonOk(created, "Ruta agregada", 201);
  } catch (error) {
    return jsonError(error.message || "No se pudo agregar la ruta", error.status || 500);
  }
}
