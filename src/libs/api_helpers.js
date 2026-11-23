import { NextResponse } from "next/server";

export function jsonOk(data, message, status = 200) {
  return NextResponse.json({ success: true, data, message }, { status });
}

export function jsonError(error, status = 500, details) {
  return NextResponse.json(
    { success: false, error, ...(details ? { details } : {}) },
    { status },
  );
}

export const TIPOS_TRANSPORTE = ["Camión", "Auto", "Camioneta"];

export function parseTransporte(body) {
  const numero = String(body?.numero ?? "").trim();
  const tipo = String(body?.tipo ?? "").trim();
  const capacidad = Number(body?.capacidad);

  if (!numero) return { error: "El no. de camión o ID de transporte es requerido" };
  if (!TIPOS_TRANSPORTE.includes(tipo)) {
    return { error: "Seleccione un tipo: Camión, Auto o Camioneta" };
  }
  if (!Number.isInteger(capacidad) || capacidad < 1) {
    return { error: "La capacidad debe ser un número entero mayor a cero" };
  }

  return { value: { numero, tipo, capacidad } };
}

function parseEntero(raw) {
  if (raw === "" || raw == null) return Number.NaN;
  const value = Number(raw);
  return Number.isInteger(value) ? value : Number.NaN;
}

const TURNOS = ["TA", "TB", "TC", "TE"];

function textoManual(raw) {
  return String(raw ?? "").trim();
}

function idOpcional(raw) {
  if (raw === "" || raw == null || raw === "manual") return null;
  return parseEntero(raw);
}

export function parseLlegada(body) {
  const id_transporte = idOpcional(body?.id_transporte);
  const transporte = textoManual(body?.transporte || body?.numero);
  const fecha = String(body?.fecha ?? "").trim();
  const turno = String(body?.turno ?? "").trim();
  const hora_entrada = String(body?.hora_entrada ?? "").trim();
  const id_procedencia =
    body?.id_procedencia === "" || body?.id_procedencia == null
      ? null
      : parseEntero(body?.id_procedencia);
  const personas_entrada = parseEntero(body?.personas_entrada);
  const hora_salida = String(body?.hora_salida ?? "").trim();
  const id_destino = parseEntero(body?.id_destino);
  const personas_salida = parseEntero(body?.personas_salida);
  const id_chofer = idOpcional(body?.id_chofer);
  const chofer = textoManual(body?.chofer);

  if (id_transporte === null) {
    if (!transporte) return { error: "Escriba el camión o seleccione uno registrado" };
    if (transporte.length > 120) return { error: "El nombre del camión es demasiado largo" };
  } else if (!Number.isInteger(id_transporte) || id_transporte < 1) {
    return { error: "Seleccione el transporte que llegó" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Indique la fecha" };
  if (!TURNOS.includes(turno)) return { error: "Seleccione el turno: TA, TB, TC o TE" };
  if (!/^\d{2}:\d{2}$/.test(hora_entrada)) return { error: "Indique la hora de entrada" };
  if (id_procedencia !== null && (!Number.isInteger(id_procedencia) || id_procedencia < 1)) {
    return { error: "Seleccione la procedencia de entrada" };
  }
  if (!Number.isInteger(personas_entrada) || personas_entrada < 0) {
    return { error: "Indique el número de personas de entrada" };
  }
  if (!/^\d{2}:\d{2}$/.test(hora_salida)) return { error: "Indique la hora de salida" };
  if (!Number.isInteger(id_destino) || id_destino < 1) {
    return { error: "Seleccione el destino" };
  }
  if (!Number.isInteger(personas_salida) || personas_salida < 0) {
    return { error: "Indique el número de personas de salida" };
  }
  if (id_chofer === null) {
    if (!chofer) return { error: "Escriba el chofer o seleccione uno registrado" };
    if (chofer.length > 120) return { error: "El nombre del chofer es demasiado largo" };
  } else if (!Number.isInteger(id_chofer) || id_chofer < 1) {
    return { error: "Seleccione el chofer" };
  }

  const cliente_id = String(body?.cliente_id ?? "").trim();
  const clienteOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    cliente_id,
  );

  return {
    value: {
      id_transporte,
      transporte: id_transporte ? "" : transporte,
      fecha,
      turno,
      hora_entrada,
      id_procedencia,
      personas_entrada,
      hora_salida,
      id_destino,
      personas_salida,
      id_chofer,
      chofer: id_chofer ? "" : chofer,
      ...(clienteOk ? { cliente_id } : {}),
    },
  };
}

export function parseChofer(body) {
  const nombre = String(body?.nombre ?? "").trim();
  const telefono = String(body?.telefono ?? "").replace(/\D/g, "");

  if (!nombre) return { error: "Indique el nombre del chofer" };
  if (telefono.length < 10 || telefono.length > 15) {
    return { error: "Indique un teléfono de 10 dígitos" };
  }

  return { value: { nombre, telefono } };
}

export function parseUsuario(body, { claveObligatoria = true } = {}) {
  // Usuario de acceso, nombre visible y contraseña del login.
  const usuario = String(body?.usuario ?? "").trim();
  const nombre = String(body?.nombre ?? "").trim();
  const clave = String(body?.clave ?? "");

  if (!usuario) return { error: "Indique el usuario" };
  if (usuario.length > 40) return { error: "El usuario es demasiado largo" };
  if (!/^[a-zA-Z0-9._-]+$/.test(usuario)) {
    return { error: "El usuario solo puede tener letras, números, punto y guion" };
  }
  if (!nombre) return { error: "Indique el nombre" };
  if (nombre.length > 120) return { error: "El nombre es demasiado largo" };
  if (claveObligatoria && clave.length < 4) {
    return { error: "La contraseña debe tener al menos 4 caracteres" };
  }
  if (!claveObligatoria && clave && clave.length < 4) {
    return { error: "La contraseña debe tener al menos 4 caracteres" };
  }

  return { value: { usuario, nombre, clave } };
}

function parsePuntos(puntos) {
  if (!Array.isArray(puntos)) return { error: "La ruta no tiene puntos" };
  if (puntos.length > 400) return { error: "La ruta tiene demasiados puntos" };
  if (puntos.length === 1) return { error: "La ruta necesita al menos dos puntos en el mapa" };
  const coords = [];
  for (const punto of puntos) {
    const lat = Number(punto?.lat);
    const lng = Number(punto?.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return { error: "Hay un punto de la ruta fuera del mapa" };
    }
    coords.push({
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    });
  }
  return { value: coords };
}

export function parseLugar(body) {
  const nombre = String(body?.nombre ?? "").trim();
  if (!nombre) return { error: "Indique el nombre del lugar" };
  const value = { nombre };
  if (body?.ruta !== undefined) {
    const puntos = parsePuntos(body.ruta);
    if (puntos.error) return puntos;
    value.ruta = puntos.value;
  }
  return { value };
}

export function parseRuta(body) {
  // Nombre, color y puntos de cada línea trazada en el mapa.
  const nombre = String(body?.nombre ?? "").trim();
  if (!nombre) return { error: "Indique el nombre de la ruta" };
  if (nombre.length > 80) return { error: "El nombre de la ruta es demasiado largo" };

  const color = String(body?.color ?? "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Elija un color para la ruta" };

  const lineas = Array.isArray(body?.lineas) ? body.lineas : [];
  if (lineas.length > 30) return { error: "La ruta tiene demasiadas líneas" };

  const limpias = [];
  for (const linea of lineas) {
    const nombreLinea = String(linea?.nombre ?? "").trim().slice(0, 60) || `Línea ${limpias.length + 1}`;
    const puntos = Array.isArray(linea?.puntos) ? linea.puntos : [];
    if (puntos.length > 400) return { error: "Una línea tiene demasiados puntos" };
    const coords = [];
    for (const punto of puntos) {
      const lat = Number(punto?.lat);
      const lng = Number(punto?.lng);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
        return { error: "Hay un punto de la ruta fuera del mapa" };
      }
      coords.push({
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
      });
    }
    if (coords.length === 1) return { error: "Cada línea necesita al menos dos puntos en el mapa" };
    if (coords.length === 0) continue;
    limpias.push({
      id_linea: Number(linea?.id_linea) || limpias.length + 1,
      nombre: nombreLinea,
      puntos: coords,
    });
  }

  return {
    value: {
      nombre,
      color,
      visible: body?.visible !== false,
      lineas: limpias,
    },
  };
}
