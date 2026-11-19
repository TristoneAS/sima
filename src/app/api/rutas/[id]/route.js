import { connection } from "next/server";
import { jsonError, jsonOk, parseRuta } from "@/libs/api_helpers";
import { deleteRuta, updateRuta } from "@/libs/sima_db";

export async function PUT(request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const parsed = parseRuta(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const updated = await updateRuta(id, parsed.value);
    return jsonOk(updated, "Ruta actualizada");
  } catch (error) {
    return jsonError(error.message || "No se pudo actualizar la ruta", error.status || 500);
  }
}

export async function DELETE(_request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const removed = await deleteRuta(id);
    return jsonOk(removed, "Ruta eliminada");
  } catch (error) {
    return jsonError(error.message || "No se pudo eliminar la ruta", error.status || 500);
  }
}
