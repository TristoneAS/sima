import { connection } from "next/server";
import { jsonError, jsonOk, parseTransporte } from "@/libs/api_helpers";
import { deleteTransporte, updateTransporte } from "@/libs/sima_db";

export async function PUT(request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const parsed = parseTransporte(await request.json());
    if (parsed.error) return jsonError(parsed.error, 400);
    const updated = await updateTransporte(id, parsed.value);
    return jsonOk(updated, "Transporte actualizado");
  } catch (error) {
    return jsonError(error.message || "No se pudo actualizar el transporte", error.status || 500);
  }
}

export async function DELETE(_request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const removed = await deleteTransporte(id);
    return jsonOk(removed, "Transporte eliminado");
  } catch (error) {
    return jsonError(error.message || "No se pudo eliminar el transporte", error.status || 500);
  }
}
