import { connection } from "next/server";
import { jsonError, jsonOk, parseChofer } from "@/libs/api_helpers";
import { createChofer, listChoferes } from "@/libs/sima_db";

export async function GET() {
  await connection();
  try {
    return jsonOk(await listChoferes());
  } catch (error) {
    return jsonError("No se pudo consultar el catálogo de choferes", 500, error.message);
  }
}

export async function POST(request) {
  await connection();
  try {
    const parsed = parseChofer(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const created = await createChofer(parsed.value);
    return jsonOk(created, "Chofer agregado", 201);
  } catch (error) {
    return jsonError(error.message || "No se pudo agregar el chofer", error.status || 500);
  }
}
