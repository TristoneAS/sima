import { connection } from "next/server";
import { jsonError, jsonOk, parseChofer } from "@/libs/api_helpers";
import { deleteChofer, updateChofer } from "@/libs/sima_db";

export async function PUT(request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const parsed = parseChofer(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const updated = await updateChofer(id, parsed.value);
    return jsonOk(updated, "Chofer actualizado");
  } catch (error) {
    return jsonError(error.message || "No se pudo actualizar el chofer", error.status || 500);
  }
}

export async function DELETE(_request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const removed = await deleteChofer(id);
    return jsonOk(removed, "Chofer eliminado");
  } catch (error) {
    return jsonError(error.message || "No se pudo eliminar el chofer", error.status || 500);
  }
}
