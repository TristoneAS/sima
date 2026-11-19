import { connection } from "next/server";
import { jsonError, jsonOk, parseTransporte } from "@/libs/api_helpers";
import { createTransporte, listTransportes } from "@/libs/sima_db";

export async function GET() {
  await connection();
  try {
    return jsonOk(await listTransportes());
  } catch (error) {
    return jsonError("No se pudo consultar el catálogo de transportes", 500, error.message);
  }
}

export async function POST(request) {
  await connection();
  try {
    const parsed = parseTransporte(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const created = await createTransporte(parsed.value);
    return jsonOk(created, "Transporte agregado", 201);
  } catch (error) {
    return jsonError(error.message || "No se pudo agregar el transporte", error.status || 500);
  }
}
