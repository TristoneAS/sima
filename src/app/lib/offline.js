const CACHE = {
  transportes: "sima_cache_transportes",
  choferes: "sima_cache_choferes",
  lugares: "sima_cache_lugares",
  llegadas: "sima_cache_llegadas",
};
const OUTBOX_KEY = "sima_outbox";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function guardarCache(nombre, rows) {
  writeJson(CACHE[nombre], rows);
}

export function leerCache(nombre) {
  const rows = readJson(CACHE[nombre], []);
  return Array.isArray(rows) ? rows : [];
}

export function leerOutbox() {
  const rows = readJson(OUTBOX_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function guardarOutbox(rows) {
  writeJson(OUTBOX_KEY, rows);
}

export function nuevoClienteId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `sima-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function encolarLlegada({ tipo, cliente_id, id_llegada, payload }) {
  const outbox = leerOutbox().filter(
    (op) => !(op.cliente_id === cliente_id && (op.tipo === tipo || op.tipo === "actualizar")),
  );
  outbox.push({
    tipo,
    cliente_id,
    id_llegada: id_llegada ?? null,
    payload: payload || null,
    creado_en: new Date().toISOString(),
  });
  guardarOutbox(outbox);
  return outbox;
}

export function quitarCreacionLocal(cliente_id) {
  guardarOutbox(leerOutbox().filter((op) => op.cliente_id !== cliente_id));
}

export function encolarEliminacion(row) {
  const local = String(row.id_llegada).startsWith("local-");
  const outbox = leerOutbox().filter((op) => op.cliente_id !== row.cliente_id);
  if (!local && row.id_llegada) {
    outbox.push({
      tipo: "eliminar",
      cliente_id: row.cliente_id,
      id_llegada: row.id_llegada,
      payload: {
        fecha: row.fecha,
        turno: row.turno,
        numero: row.numero,
        chofer: row.chofer,
        hora_entrada: row.hora_entrada,
        hora_salida: row.hora_salida,
        procedencia: row.procedencia,
        destino: row.destino,
        personas_entrada: row.personas_entrada,
        personas_salida: row.personas_salida,
        id_transporte: row.id_transporte,
        id_chofer: row.id_chofer,
        id_destino: row.id_destino,
        id_procedencia: row.id_procedencia,
      },
      creado_en: new Date().toISOString(),
    });
  }
  guardarOutbox(outbox);
}

function nombreDe(lista, id, campo) {
  const item = lista.find((row) => String(row[campo]) === String(id));
  return item || null;
}

export function filaLocal(op, catalogos) {
  const payload = op.payload || {};
  const transporte = nombreDe(catalogos.transportes, payload.id_transporte, "id_transporte");
  const chofer = nombreDe(catalogos.choferes, payload.id_chofer, "id_chofer");
  const procedencia = payload.id_procedencia
    ? nombreDe(catalogos.lugares, payload.id_procedencia, "id_lugar")
    : null;
  const destino = nombreDe(catalogos.lugares, payload.id_destino, "id_lugar");
  return {
    ...payload,
    id_llegada: op.id_llegada && !String(op.id_llegada).startsWith("local-")
      ? op.id_llegada
      : `local-${op.cliente_id}`,
    cliente_id: op.cliente_id,
    numero: transporte?.numero || payload.numero || payload.transporte || "",
    transporte: transporte?.numero || payload.transporte || payload.numero || "",
    tipo: transporte?.tipo || payload.tipo || "",
    capacidad: transporte?.capacidad ?? payload.capacidad ?? null,
    chofer: chofer?.nombre || payload.chofer || "",
    procedencia: procedencia?.nombre || payload.procedencia || "NA",
    destino: destino?.nombre || payload.destino || "",
    pendiente: true,
  };
}

export function combinarLlegadas(servidor, catalogos) {
  const outbox = leerOutbox();
  const eliminados = new Set(
    outbox.filter((op) => op.tipo === "eliminar").map((op) => op.cliente_id),
  );
  const actualizaciones = new Map(
    outbox.filter((op) => op.tipo === "actualizar").map((op) => [op.cliente_id, op]),
  );
  const vistos = new Set();
  const filas = (servidor || [])
    .filter((row) => !eliminados.has(row.cliente_id))
    .map((row) => {
      vistos.add(row.cliente_id);
      const cambio = actualizaciones.get(row.cliente_id);
      if (!cambio) return { ...row, pendiente: false };
      return { ...filaLocal(cambio, catalogos), id_llegada: row.id_llegada, pendiente: true };
    });

  for (const op of outbox) {
    if (op.tipo !== "crear" || eliminados.has(op.cliente_id) || vistos.has(op.cliente_id)) continue;
    filas.unshift(filaLocal(op, catalogos));
  }
  return filas;
}

async function enviar(op) {
  if (op.tipo === "eliminar") {
    const response = await fetch(`/api/llegadas/${op.id_llegada}`, { method: "DELETE" });
    if (response.status === 404) return { listo: true };
    const data = await response.json();
    if (!response.ok || !data.success) {
      return { listo: false, error: data.error || "No se pudo eliminar" };
    }
    return { listo: true };
  }

  const esNuevo = op.tipo === "crear" || String(op.id_llegada || "").startsWith("local-");
  const response = await fetch(esNuevo ? "/api/llegadas" : `/api/llegadas/${op.id_llegada}`, {
    method: esNuevo ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(op.payload),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    return { listo: false, error: data.error || "No se pudo subir el viaje" };
  }
  return { listo: true };
}

let sincronizacionEnCurso = null;

export async function sincronizarOutbox() {
  if (sincronizacionEnCurso) return sincronizacionEnCurso;
  sincronizacionEnCurso = correrSincronizacion().finally(() => {
    sincronizacionEnCurso = null;
  });
  return sincronizacionEnCurso;
}

async function correrSincronizacion() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { subidos: 0, pendientes: leerOutbox().length, offline: true };
  }
  const pendientes = leerOutbox();
  const restantes = [];
  const registros = [];
  for (let index = 0; index < pendientes.length; index += 1) {
    const op = pendientes[index];
    if (op.bloqueado) {
      restantes.push(op);
      continue;
    }
    if (op.enviando && Date.now() - op.enviando < 20000) {
      restantes.push(op);
      continue;
    }
    try {
      const reclamados = leerOutbox().map((item) =>
        item.cliente_id === op.cliente_id && item.tipo === op.tipo
          ? { ...item, enviando: Date.now() }
          : item,
      );
      guardarOutbox(reclamados);
      const resultado = await enviar(op);
      if (resultado.listo) registros.push(op);
      else restantes.push({ ...op, error: resultado.error, bloqueado: true });
    } catch {
      restantes.push(op, ...pendientes.slice(index + 1));
      break;
    }
  }
  guardarOutbox(restantes);
  if (registros.length > 0 && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sima-synced", { detail: { registros } }));
  }
  return {
    subidos: registros.length,
    registros,
    pendientes: restantes.length,
    offline: false,
    error: restantes[0]?.error || "",
  };
}
