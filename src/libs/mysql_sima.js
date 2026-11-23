import mysql from "mysql2/promise";

let pool = null;
let schemaReady = false;

function config() {
  return {
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE_SIMA || "sima",
    waitForConnections: true,
    connectionLimit: 4,
    connectTimeout: 2500,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
  };
}

async function getPool() {
  if (pool) return pool;
  const { database, ...rest } = config();
  const bootstrap = await mysql.createConnection(rest);
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await bootstrap.end();
  pool = mysql.createPool(config());
  return pool;
}

async function ensureSchema(db) {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS transportes (
      id_transporte INT NOT NULL AUTO_INCREMENT,
      numero VARCHAR(40) NOT NULL,
      tipo ENUM('Camión', 'Auto', 'Camioneta') NOT NULL,
      capacidad INT NOT NULL,
      estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_transporte),
      UNIQUE KEY uk_transporte_numero (numero)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS choferes (
      id_chofer INT NOT NULL AUTO_INCREMENT,
      nombre VARCHAR(120) NOT NULL,
      telefono VARCHAR(20) NOT NULL,
      estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_chofer)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS lugares (
      id_lugar INT NOT NULL AUTO_INCREMENT,
      nombre VARCHAR(120) NOT NULL,
      estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_lugar)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS llegadas (
      id_llegada INT NOT NULL AUTO_INCREMENT,
      cliente_id VARCHAR(36) NULL,
      id_transporte INT NULL,
      fecha DATE NOT NULL,
      turno ENUM('TA', 'TB', 'TC', 'TE') NOT NULL,
      hora_entrada TIME NOT NULL,
      id_procedencia INT NULL,
      procedencia VARCHAR(120) NULL,
      personas_entrada INT NOT NULL,
      hora_salida TIME NOT NULL,
      id_destino INT NOT NULL,
      destino VARCHAR(120) NULL,
      personas_salida INT NOT NULL,
      id_chofer INT NULL,
      transporte VARCHAR(120) NULL,
      chofer VARCHAR(120) NOT NULL,
      estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_llegada),
      UNIQUE KEY uk_llegadas_cliente (cliente_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const extras = [
    "ADD COLUMN cliente_id VARCHAR(36) NULL",
    "ADD COLUMN procedencia VARCHAR(120) NULL",
    "ADD COLUMN destino VARCHAR(120) NULL",
    "ADD COLUMN id_procedencia INT NULL",
    "ADD COLUMN id_destino INT NULL",
    "ADD COLUMN id_chofer INT NULL",
    "ADD COLUMN transporte VARCHAR(120) NULL",
    "MODIFY COLUMN id_transporte INT NULL",
    "ADD UNIQUE KEY uk_llegadas_cliente (cliente_id)",
  ];
  for (const clause of extras) {
    try {
      await db.query(`ALTER TABLE llegadas ${clause}`);
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME" && error.code !== "ER_DUP_KEYNAME") throw error;
    }
  }
  // Cuentas del login. La clave se guarda como hash, nunca en claro.
  await db.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id_usuario INT NOT NULL AUTO_INCREMENT,
      usuario VARCHAR(40) NOT NULL,
      nombre VARCHAR(120) NOT NULL,
      clave VARCHAR(200) NOT NULL,
      estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
      fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id_usuario),
      UNIQUE KEY uk_usuario (usuario)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

export async function consultar(sqlText, params = []) {
  const db = await getPool();
  await ensureSchema(db);
  const [rows] = await db.query(sqlText, params);
  return rows;
}
