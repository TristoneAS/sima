import { connection } from "next/server";
import { jsonError, jsonOk, parseUsuario } from "@/libs/api_helpers";
import { deleteUsuario, updateUsuario } from "@/libs/sima_db";

export async function PUT(request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const parsed = parseUsuario(await request.json(), { claveObligatoria: false });
    if (parsed.error) return jsonError(parsed.error, 400);
    const updated = await updateUsuario(id, parsed.value);
    return jsonOk(updated, "Usuario actualizado");
  } catch (error) {
    return jsonError(error.message || "No se pudo actualizar el usuario", error.status || 500);
  }
}

export async function DELETE(_request, { params }) {
  await connection();
  try {
    const { id } = await params;
    const removed = await deleteUsuario(id);
    return jsonOk(removed, "Usuario eliminado");
  } catch (error) {
    return jsonError(error.message || "No se pudo eliminar el usuario", error.status || 500);
  }
}
