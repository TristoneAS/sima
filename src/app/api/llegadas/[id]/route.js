import { connection } from "next/server";
import { jsonError, jsonOk, parseLlegada } from "@/libs/api_helpers";
import { deleteLlegada, updateLlegada } from "@/libs/sima_db";

export async function PUT(request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const parsed = parseLlegada(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const updated = await updateLlegada(id, parsed.value);
    return jsonOk(updated, "Registro actualizado");
  } catch (error) {
    return jsonError(error.message || "No se pudo actualizar el registro", error.status || 500);
  }
}

export async function DELETE(_request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const removed = await deleteLlegada(id);
    return jsonOk(removed, "Registro eliminado");
  } catch (error) {
    return jsonError(error.message || "No se pudo eliminar el registro", error.status || 500);
  }
}
