import { connection } from "next/server";
import { jsonError, jsonOk, parseLugar } from "@/libs/api_helpers";
import { deleteLugar, updateLugar } from "@/libs/sima_db";

export async function PUT(request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const parsed = parseLugar(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const updated = await updateLugar(id, parsed.value);
    return jsonOk(updated, "Lugar actualizado");
  } catch (error) {
    return jsonError(error.message || "No se pudo actualizar el lugar", error.status || 500);
  }
}

export async function DELETE(_request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const removed = await deleteLugar(id);
    return jsonOk(removed, "Lugar eliminado");
  } catch (error) {
    return jsonError(error.message || "No se pudo eliminar el lugar", error.status || 500);
  }
}
