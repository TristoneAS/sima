import { mkdir, readFile, writeFile } from "fs/promises";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import path from "path";
import { cookies } from "next/headers";
import { consultar } from "@/libs/mysql_sima";

const scryptAsync = promisify(scrypt);

const rutasPath = path.join(process.cwd(), "data", "rutas.json");
const mapasPath = path.join(process.cwd(), "data", "rutas_mapas.json");
const lugaresLegacyPath = path.join(process.cwd(), "data", "lugares.json");

function errorEstado(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

async function exigirConfiguracion() {
  try {
    const jar = await cookies();
    const acceso = jar.get("sima_acceso")?.value;
    if (acceso && acceso !== "configuracion") {
      throw errorEstado("No tiene acceso a configuración", 403);
    }
  } catch (error) {
    if (error?.status === 403) throw error;
  }
}

async function exigirAdministrador() {
  const jar = await cookies();
  if (jar.get("sima_acceso")?.value !== "configuracion") {
    throw errorEstado("Solo el administrador puede editar o eliminar registros", 403);
  }
}

function dia(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function hora(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function esDuplicado(error) {
  return error?.code === "ER_DUP_ENTRY";
}

async function readMapas() {
  try {
    const raw = await readFile(mapasPath, "utf8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  let legado = [];
  try {
    const raw = await readFile(lugaresLegacyPath, "utf8");
    const rows = JSON.parse(raw);
    legado = Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const mapas = {};
  for (const row of legado) {
    if (Array.isArray(row.ruta) && row.ruta.length >= 2) mapas[String(row.id_lugar)] = row.ruta;
  }
  await writeMapas(mapas);
  return mapas;
}

async function writeMapas(mapas) {
  await mkdir(path.dirname(mapasPath), { recursive: true });
  await writeFile(mapasPath, JSON.stringify(mapas, null, 2));
}

function conRuta(lugar, mapas) {
  const ruta = mapas[String(lugar.id_lugar)];
  if (!Array.isArray(ruta) || ruta.length < 2) return { ...lugar };
  return { ...lugar, ruta };
}

export async function listTransportes() {
  const rows = await consultar(
    "SELECT id_transporte, numero, tipo, capacidad, estado, fecha_creacion FROM transportes WHERE estado = 'activo'",
  );
  return rows
    .map((row) => ({ ...row, capacidad: Number(row.capacidad) }))
    .sort((a, b) => String(a.numero).localeCompare(String(b.numero), "es"));
}

export async function createTransporte({ numero, tipo, capacidad }) {
  await exigirConfiguracion();
  const duplicado = await consultar(
    "SELECT id_transporte FROM transportes WHERE estado = 'activo' AND numero = ? LIMIT 1",
    [numero],
  );
  if (duplicado.length) throw errorEstado("Ya existe un transporte con ese número o ID", 409);
  try {
    const header = await consultar(
      "INSERT INTO transportes (numero, tipo, capacidad, estado) VALUES (?, ?, ?, 'activo')",
      [numero, tipo, capacidad],
    );
    await consultar(
      `UPDATE llegadas
       SET id_transporte = ?
       WHERE estado = 'activo' AND id_transporte IS NULL AND LOWER(TRIM(transporte)) = LOWER(TRIM(?))`,
      [header.insertId, numero],
    );
    const [creado] = await consultar(
      "SELECT id_transporte, numero, tipo, capacidad, estado, fecha_creacion FROM transportes WHERE id_transporte = ?",
      [header.insertId],
    );
    return { ...creado, capacidad: Number(creado.capacidad) };
  } catch (error) {
    if (esDuplicado(error)) throw errorEstado("Ya existe un transporte con ese número o ID", 409);
    throw error;
  }
}

export async function updateTransporte(id, { numero, tipo, capacidad }) {
  await exigirConfiguracion();
  const actuales = await consultar(
    "SELECT id_transporte FROM transportes WHERE estado = 'activo' AND id_transporte = ?",
    [id],
  );
  if (!actuales.length) throw errorEstado("Transporte no encontrado", 404);
  const duplicado = await consultar(
    "SELECT id_transporte FROM transportes WHERE estado = 'activo' AND id_transporte <> ? AND numero = ? LIMIT 1",
    [id, numero],
  );
  if (duplicado.length) throw errorEstado("Ya existe un transporte con ese número o ID", 409);
  try {
    await consultar(
      "UPDATE transportes SET numero = ?, tipo = ?, capacidad = ? WHERE id_transporte = ? AND estado = 'activo'",
      [numero, tipo, capacidad, id],
    );
  } catch (error) {
    if (esDuplicado(error)) throw errorEstado("Ya existe un transporte con ese número o ID", 409);
    throw error;
  }
  const [actualizado] = await consultar(
    "SELECT id_transporte, numero, tipo, capacidad, estado, fecha_creacion FROM transportes WHERE id_transporte = ?",
    [id],
  );
  return { ...actualizado, capacidad: Number(actualizado.capacidad) };
}

export async function deleteTransporte(id) {
  await exigirConfiguracion();
  const header = await consultar(
    "UPDATE transportes SET estado = 'inactivo' WHERE id_transporte = ? AND estado = 'activo'",
    [id],
  );
  if (!header.affectedRows) throw errorEstado("Transporte no encontrado", 404);
  const [row] = await consultar(
    "SELECT id_transporte, numero, tipo, capacidad, estado, fecha_creacion FROM transportes WHERE id_transporte = ?",
    [id],
  );
  return row;
}

export async function listSugerenciasTransporte() {
  const rows = await consultar(`
    SELECT DISTINCT TRIM(l.transporte) AS nombre
    FROM llegadas l
    WHERE l.estado = 'activo'
      AND l.id_transporte IS NULL
      AND TRIM(IFNULL(l.transporte, '')) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM transportes t
        WHERE t.estado = 'activo' AND LOWER(TRIM(t.numero)) = LOWER(TRIM(l.transporte))
      )
    ORDER BY nombre
  `);
  return rows.map((row) => row.nombre);
}

export async function listSugerenciasChofer() {
  const rows = await consultar(`
    SELECT DISTINCT TRIM(l.chofer) AS nombre
    FROM llegadas l
    WHERE l.estado = 'activo'
      AND l.id_chofer IS NULL
      AND TRIM(IFNULL(l.chofer, '')) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM choferes c
        WHERE c.estado = 'activo' AND LOWER(TRIM(c.nombre)) = LOWER(TRIM(l.chofer))
      )
    ORDER BY nombre
  `);
  return rows.map((row) => row.nombre);
}

export async function listChoferes() {
  const rows = await consultar(
    "SELECT id_chofer, nombre, telefono, estado, fecha_creacion FROM choferes WHERE estado = 'activo'",
  );
  return rows.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
}

export async function createChofer({ nombre, telefono }) {
  await exigirConfiguracion();
  const duplicado = await consultar(
    "SELECT id_chofer FROM choferes WHERE estado = 'activo' AND (nombre = ? OR telefono = ?) LIMIT 1",
    [nombre, telefono],
  );
  if (duplicado.length) throw errorEstado("Ya existe un chofer con ese nombre o teléfono", 409);
  const header = await consultar(
    "INSERT INTO choferes (nombre, telefono, estado) VALUES (?, ?, 'activo')",
    [nombre, telefono],
  );
  await consultar(
    `UPDATE llegadas
     SET id_chofer = ?
     WHERE estado = 'activo' AND id_chofer IS NULL AND LOWER(TRIM(chofer)) = LOWER(TRIM(?))`,
    [header.insertId, nombre],
  );
  const [creado] = await consultar(
    "SELECT id_chofer, nombre, telefono, estado, fecha_creacion FROM choferes WHERE id_chofer = ?",
    [header.insertId],
  );
  return creado;
}

export async function updateChofer(id, { nombre, telefono }) {
  await exigirConfiguracion();
  const actuales = await consultar(
    "SELECT id_chofer FROM choferes WHERE estado = 'activo' AND id_chofer = ?",
    [id],
  );
  if (!actuales.length) throw errorEstado("Chofer no encontrado", 404);
  const duplicado = await consultar(
    "SELECT id_chofer FROM choferes WHERE estado = 'activo' AND id_chofer <> ? AND (nombre = ? OR telefono = ?) LIMIT 1",
    [id, nombre, telefono],
  );
  if (duplicado.length) throw errorEstado("Ya existe un chofer con ese nombre o teléfono", 409);
  await consultar("UPDATE choferes SET nombre = ?, telefono = ? WHERE id_chofer = ? AND estado = 'activo'", [
    nombre,
    telefono,
    id,
  ]);
  const [actualizado] = await consultar(
    "SELECT id_chofer, nombre, telefono, estado, fecha_creacion FROM choferes WHERE id_chofer = ?",
    [id],
  );
  return actualizado;
}

export async function deleteChofer(id) {
  await exigirConfiguracion();
  const header = await consultar(
    "UPDATE choferes SET estado = 'inactivo' WHERE id_chofer = ? AND estado = 'activo'",
    [id],
  );
  if (!header.affectedRows) throw errorEstado("Chofer no encontrado", 404);
  const [row] = await consultar(
    "SELECT id_chofer, nombre, telefono, estado, fecha_creacion FROM choferes WHERE id_chofer = ?",
    [id],
  );
  return row;
}

export async function listLugares() {
  const [rows, mapas] = await Promise.all([
    consultar("SELECT id_lugar, nombre, estado, fecha_creacion FROM lugares WHERE estado = 'activo'"),
    readMapas(),
  ]);
  return rows
    .map((row) => conRuta(row, mapas))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
}

export async function createLugar({ nombre }) {
  await exigirConfiguracion();
  const duplicado = await consultar(
    "SELECT id_lugar FROM lugares WHERE estado = 'activo' AND nombre = ? LIMIT 1",
    [nombre],
  );
  if (duplicado.length) throw errorEstado("Ya existe un lugar con ese nombre", 409);
  const header = await consultar("INSERT INTO lugares (nombre, estado) VALUES (?, 'activo')", [nombre]);
  const [creado] = await consultar(
    "SELECT id_lugar, nombre, estado, fecha_creacion FROM lugares WHERE id_lugar = ?",
    [header.insertId],
  );
  return creado;
}

export async function updateLugar(id, { nombre, ruta }) {
  await exigirConfiguracion();
  const actuales = await consultar(
    "SELECT id_lugar FROM lugares WHERE estado = 'activo' AND id_lugar = ?",
    [id],
  );
  if (!actuales.length) throw errorEstado("Lugar no encontrado", 404);
  const duplicado = await consultar(
    "SELECT id_lugar FROM lugares WHERE estado = 'activo' AND id_lugar <> ? AND nombre = ? LIMIT 1",
    [id, nombre],
  );
  if (duplicado.length) throw errorEstado("Ya existe un lugar con ese nombre", 409);
  await consultar("UPDATE lugares SET nombre = ? WHERE id_lugar = ? AND estado = 'activo'", [nombre, id]);
  const mapas = await readMapas();
  if (ruta !== undefined) {
    if (Array.isArray(ruta) && ruta.length >= 2) mapas[String(id)] = ruta;
    else delete mapas[String(id)];
    await writeMapas(mapas);
  }
  const [actualizado] = await consultar(
    "SELECT id_lugar, nombre, estado, fecha_creacion FROM lugares WHERE id_lugar = ?",
    [id],
  );
  return conRuta(actualizado, mapas);
}

export async function deleteLugar(id) {
  await exigirConfiguracion();
  const header = await consultar(
    "UPDATE lugares SET estado = 'inactivo' WHERE id_lugar = ? AND estado = 'activo'",
    [id],
  );
  if (!header.affectedRows) throw errorEstado("Lugar no encontrado", 404);
  const mapas = await readMapas();
  if (mapas[String(id)]) {
    delete mapas[String(id)];
    await writeMapas(mapas);
  }
  const [row] = await consultar(
    "SELECT id_lugar, nombre, estado, fecha_creacion FROM lugares WHERE id_lugar = ?",
    [id],
  );
  return row;
}

async function readRutas() {
  try {
    const raw = await readFile(rutasPath, "utf8");
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeRutas(rows) {
  await mkdir(path.dirname(rutasPath), { recursive: true });
  await writeFile(rutasPath, JSON.stringify(rows, null, 2));
}

export async function listRutas() {
  const rows = await readRutas();
  return rows
    .filter((row) => row.estado === "activo")
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
}

export async function createRuta({ nombre, color, lineas, visible }) {
  await exigirConfiguracion();
  const rows = await readRutas();
  const duplicate = rows.some(
    (row) => row.estado === "activo" && String(row.nombre).toLowerCase() === nombre.toLowerCase(),
  );
  if (duplicate) throw errorEstado("Ya existe una ruta con ese nombre", 409);
  const id = rows.reduce((max, row) => Math.max(max, Number(row.id_ruta) || 0), 0) + 1;
  const created = {
    id_ruta: id,
    nombre,
    color,
    visible: visible !== false,
    lineas,
    estado: "activo",
    fecha_creacion: new Date().toISOString(),
  };
  rows.push(created);
  await writeRutas(rows);
  return created;
}

export async function updateRuta(id, { nombre, color, lineas, visible }) {
  await exigirConfiguracion();
  const rows = await readRutas();
  const index = rows.findIndex((row) => row.estado === "activo" && String(row.id_ruta) === String(id));
  if (index < 0) throw errorEstado("Ruta no encontrada", 404);
  const duplicate = rows.some(
    (row) =>
      row.estado === "activo" &&
      String(row.id_ruta) !== String(id) &&
      String(row.nombre).toLowerCase() === nombre.toLowerCase(),
  );
  if (duplicate) throw errorEstado("Ya existe una ruta con ese nombre", 409);
  rows[index] = { ...rows[index], nombre, color, visible: visible !== false, lineas };
  await writeRutas(rows);
  return rows[index];
}

export async function deleteRuta(id) {
  await exigirConfiguracion();
  const rows = await readRutas();
  const index = rows.findIndex((row) => row.estado === "activo" && String(row.id_ruta) === String(id));
  if (index < 0) throw errorEstado("Ruta no encontrada", 404);
  rows[index] = { ...rows[index], estado: "inactivo" };
  await writeRutas(rows);
  return rows[index];
}

const LLEGADA_SELECT = `
  SELECT l.id_llegada, l.cliente_id, l.id_transporte, l.transporte, l.fecha, l.turno,
         l.hora_entrada, l.id_procedencia, l.procedencia, l.personas_entrada,
         l.hora_salida, l.id_destino, l.destino, l.personas_salida,
         l.id_chofer, l.chofer, l.estado, l.fecha_creacion,
         t.numero, t.tipo, t.capacidad,
         c.nombre AS chofer_nombre, c.telefono,
         p.nombre AS procedencia_nombre,
         d.nombre AS destino_nombre
  FROM llegadas l
  LEFT JOIN transportes t ON t.id_transporte = l.id_transporte
  LEFT JOIN choferes c ON c.id_chofer = l.id_chofer
  LEFT JOIN lugares p ON p.id_lugar = l.id_procedencia
  LEFT JOIN lugares d ON d.id_lugar = l.id_destino
`;

function filaLlegada(row) {
  if (!row) return null;
  return {
    id_llegada: row.id_llegada,
    cliente_id: row.cliente_id,
    id_transporte: row.id_transporte,
    fecha: dia(row.fecha),
    turno: row.turno,
    hora_entrada: hora(row.hora_entrada),
    id_procedencia: row.id_procedencia,
    procedencia: row.procedencia_nombre || row.procedencia || "NA",
    personas_entrada: Number(row.personas_entrada),
    hora_salida: hora(row.hora_salida),
    id_destino: row.id_destino,
    destino: row.destino_nombre || row.destino || "",
    personas_salida: Number(row.personas_salida),
    id_chofer: row.id_chofer,
    chofer: row.chofer_nombre || row.chofer || "",
    telefono: row.telefono || "",
    numero: row.numero || row.transporte || "",
    transporte: row.transporte || row.numero || "",
    tipo: row.tipo || "",
    capacidad: row.capacidad == null ? null : Number(row.capacidad),
    estado: row.estado,
    fecha_creacion: row.fecha_creacion,
  };
}

async function obtenerLlegada(where, params) {
  const rows = await consultar(`${LLEGADA_SELECT} WHERE ${where} LIMIT 1`, params);
  return filaLlegada(rows[0]);
}

export async function listLlegadas() {
  const rows = await consultar(`${LLEGADA_SELECT} WHERE l.estado = 'activo' ORDER BY l.fecha DESC, l.hora_entrada DESC`);
  return rows.map(filaLlegada);
}

async function assertTransporteActivo(id) {
  const rows = await consultar(
    "SELECT id_transporte, numero, tipo, capacidad FROM transportes WHERE estado = 'activo' AND id_transporte = ?",
    [id],
  );
  if (!rows.length) throw errorEstado("Seleccione un transporte registrado", 400);
  return rows[0];
}

async function assertChoferActivo(id) {
  const rows = await consultar(
    "SELECT id_chofer, nombre, telefono FROM choferes WHERE estado = 'activo' AND id_chofer = ?",
    [id],
  );
  if (!rows.length) throw errorEstado("Seleccione un chofer registrado", 400);
  return rows[0];
}

async function assertLugarActivo(id, etiqueta) {
  const rows = await consultar(
    "SELECT id_lugar, nombre FROM lugares WHERE estado = 'activo' AND id_lugar = ?",
    [id],
  );
  if (!rows.length) throw errorEstado(`Seleccione ${etiqueta}`, 400);
  return rows[0];
}

const creacionesEnCurso = new Map();

export async function createLlegada(value) {
  const cliente_id = value.cliente_id || crypto.randomUUID();
  const enCurso = creacionesEnCurso.get(cliente_id);
  if (enCurso) return enCurso;
  const trabajo = crearLlegadaUnica(cliente_id, value).finally(() => {
    creacionesEnCurso.delete(cliente_id);
  });
  creacionesEnCurso.set(cliente_id, trabajo);
  return trabajo;
}

async function resolverTransporte(value) {
  if (value.id_transporte) return assertTransporteActivo(value.id_transporte);
  const texto = String(value.transporte || "").trim();
  if (!texto) throw errorEstado("Escriba el camión o seleccione uno registrado", 400);
  const rows = await consultar(
    "SELECT id_transporte, numero, tipo, capacidad FROM transportes WHERE estado = 'activo' AND LOWER(TRIM(numero)) = LOWER(TRIM(?)) LIMIT 1",
    [texto],
  );
  if (rows.length) return rows[0];
  return { id_transporte: null, numero: texto };
}

async function resolverChofer(value) {
  if (value.id_chofer) return assertChoferActivo(value.id_chofer);
  const texto = String(value.chofer || "").trim();
  if (!texto) throw errorEstado("Escriba el chofer o seleccione uno registrado", 400);
  const rows = await consultar(
    "SELECT id_chofer, nombre, telefono FROM choferes WHERE estado = 'activo' AND LOWER(TRIM(nombre)) = LOWER(TRIM(?)) LIMIT 1",
    [texto],
  );
  if (rows.length) return rows[0];
  return { id_chofer: null, nombre: texto };
}

async function crearLlegadaUnica(cliente_id, value) {
  const existente = await obtenerLlegada("l.cliente_id = ?", [cliente_id]);
  if (existente) return existente;

  const transporte = await resolverTransporte(value);
  const chofer = await resolverChofer(value);
  const procedencia = value.id_procedencia ? await assertLugarActivo(value.id_procedencia, "la procedencia") : null;
  const destino = await assertLugarActivo(value.id_destino, "el destino");

  const header = await consultar(
    `INSERT INTO llegadas (
      cliente_id, id_transporte, transporte, fecha, turno, hora_entrada, id_procedencia, procedencia,
      personas_entrada, hora_salida, id_destino, destino, personas_salida, id_chofer, chofer, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo')`,
    [
      cliente_id,
      transporte.id_transporte,
      transporte.numero,
      value.fecha,
      value.turno,
      value.hora_entrada,
      value.id_procedencia,
      procedencia?.nombre ?? "NA",
      value.personas_entrada,
      value.hora_salida,
      value.id_destino,
      destino.nombre,
      value.personas_salida,
      chofer.id_chofer,
      chofer.nombre,
    ],
  );
  return obtenerLlegada("l.id_llegada = ?", [header.insertId]);
}

export async function updateLlegada(id, value) {
  await exigirAdministrador();
  const transporte = await resolverTransporte(value);
  const chofer = await resolverChofer(value);
  const procedencia = value.id_procedencia ? await assertLugarActivo(value.id_procedencia, "la procedencia") : null;
  const destino = await assertLugarActivo(value.id_destino, "el destino");
  const header = await consultar(
    `UPDATE llegadas SET
      id_transporte = ?, transporte = ?, fecha = ?, turno = ?, hora_entrada = ?, id_procedencia = ?, procedencia = ?,
      personas_entrada = ?, hora_salida = ?, id_destino = ?, destino = ?, personas_salida = ?,
      id_chofer = ?, chofer = ?
     WHERE id_llegada = ? AND estado = 'activo'`,
    [
      transporte.id_transporte,
      transporte.numero,
      value.fecha,
      value.turno,
      value.hora_entrada,
      value.id_procedencia,
      procedencia?.nombre ?? "NA",
      value.personas_entrada,
      value.hora_salida,
      value.id_destino,
      destino.nombre,
      value.personas_salida,
      chofer.id_chofer,
      chofer.nombre,
      id,
    ],
  );
  if (!header.affectedRows) throw errorEstado("Registro no encontrado", 404);
  return obtenerLlegada("l.id_llegada = ?", [id]);
}

export async function deleteLlegada(id) {
  await exigirAdministrador();
  const header = await consultar(
    "UPDATE llegadas SET estado = 'inactivo' WHERE id_llegada = ? AND estado = 'activo'",
    [id],
  );
  if (!header.affectedRows) throw errorEstado("Registro no encontrado", 404);
  return obtenerLlegada("l.id_llegada = ?", [id]);
}

async function hashClave(clave) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(clave, salt, 32)).toString("hex");
  return `${salt}:${hash}`;
}

async function claveCoincide(clave, guardada) {
  const [salt, hash] = String(guardada || "").split(":");
  if (!salt || !hash) return false;
  const actual = Buffer.from(hash, "hex");
  const nuevo = await scryptAsync(clave, salt, 32);
  if (actual.length !== nuevo.length) return false;
  return timingSafeEqual(actual, nuevo);
}

function filaUsuario(row) {
  return {
    id_usuario: row.id_usuario,
    usuario: row.usuario,
    nombre: row.nombre,
    estado: row.estado,
    fecha_creacion: row.fecha_creacion,
  };
}

export async function listUsuarios() {
  // Cuentas activas que pueden entrar desde el login.
  const rows = await consultar(
    "SELECT id_usuario, usuario, nombre, estado, fecha_creacion FROM usuarios WHERE estado = 'activo'",
  );
  return rows
    .map(filaUsuario)
    .sort((a, b) => String(a.usuario).localeCompare(String(b.usuario), "es"));
}

export async function createUsuario({ usuario, nombre, clave }) {
  await exigirConfiguracion();
  const existentes = await consultar(
    "SELECT id_usuario, estado FROM usuarios WHERE usuario = ? LIMIT 1",
    [usuario],
  );
  if (existentes.length && existentes[0].estado === "activo") {
    throw errorEstado("Ya existe un usuario con ese nombre de acceso", 409);
  }
  const claveHash = await hashClave(clave);
  if (existentes.length) {
    await consultar(
      "UPDATE usuarios SET nombre = ?, clave = ?, estado = 'activo' WHERE id_usuario = ?",
      [nombre, claveHash, existentes[0].id_usuario],
    );
    const [reactivado] = await consultar(
      "SELECT id_usuario, usuario, nombre, estado, fecha_creacion FROM usuarios WHERE id_usuario = ?",
      [existentes[0].id_usuario],
    );
    return filaUsuario(reactivado);
  }
  try {
    const header = await consultar(
      "INSERT INTO usuarios (usuario, nombre, clave, estado) VALUES (?, ?, ?, 'activo')",
      [usuario, nombre, claveHash],
    );
    const [creado] = await consultar(
      "SELECT id_usuario, usuario, nombre, estado, fecha_creacion FROM usuarios WHERE id_usuario = ?",
      [header.insertId],
    );
    return filaUsuario(creado);
  } catch (error) {
    if (esDuplicado(error)) throw errorEstado("Ya existe un usuario con ese nombre de acceso", 409);
    throw error;
  }
}

export async function updateUsuario(id, { usuario, nombre, clave }) {
  await exigirConfiguracion();
  const actuales = await consultar(
    "SELECT id_usuario, clave FROM usuarios WHERE estado = 'activo' AND id_usuario = ?",
    [id],
  );
  if (!actuales.length) throw errorEstado("Usuario no encontrado", 404);
  const duplicado = await consultar(
    "SELECT id_usuario FROM usuarios WHERE estado = 'activo' AND id_usuario <> ? AND usuario = ? LIMIT 1",
    [id, usuario],
  );
  if (duplicado.length) throw errorEstado("Ya existe un usuario con ese nombre de acceso", 409);
  const claveHash = clave ? await hashClave(clave) : actuales[0].clave;
  try {
    await consultar(
      "UPDATE usuarios SET usuario = ?, nombre = ?, clave = ? WHERE id_usuario = ? AND estado = 'activo'",
      [usuario, nombre, claveHash, id],
    );
  } catch (error) {
    if (esDuplicado(error)) throw errorEstado("Ya existe un usuario con ese nombre de acceso", 409);
    throw error;
  }
  const [actualizado] = await consultar(
    "SELECT id_usuario, usuario, nombre, estado, fecha_creacion FROM usuarios WHERE id_usuario = ?",
    [id],
  );
  return filaUsuario(actualizado);
}

export async function deleteUsuario(id) {
  await exigirConfiguracion();
  const header = await consultar(
    "UPDATE usuarios SET estado = 'inactivo' WHERE id_usuario = ? AND estado = 'activo'",
    [id],
  );
  if (!header.affectedRows) throw errorEstado("Usuario no encontrado", 404);
  const [row] = await consultar(
    "SELECT id_usuario, usuario, nombre, estado, fecha_creacion FROM usuarios WHERE id_usuario = ?",
    [id],
  );
  return filaUsuario(row);
}

export async function validarAcceso(usuario, clave) {
  const conteo = await consultar("SELECT COUNT(*) AS total FROM usuarios WHERE estado = 'activo'");
  const total = Number(conteo[0]?.total || 0);
  const acceso = String(usuario || "").trim();
  if (!acceso || !clave) return null;
  if (total === 0) return { usuario: acceso, nombre: acceso, configuracion: true };
  const rows = await consultar(
    "SELECT usuario, nombre, clave FROM usuarios WHERE estado = 'activo' AND usuario = ? LIMIT 1",
    [acceso],
  );
  if (!rows.length) return null;
  const ok = await claveCoincide(clave, rows[0].clave);
  if (!ok) return null;
  return { usuario: rows[0].usuario, nombre: rows[0].nombre, configuracion: false };
}
