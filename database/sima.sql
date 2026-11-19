CREATE DATABASE IF NOT EXISTS sima
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sima;

CREATE TABLE IF NOT EXISTS transportes (
  id_transporte INT NOT NULL AUTO_INCREMENT,
  numero VARCHAR(40) NOT NULL COMMENT 'No. de camión o ID de transporte',
  tipo ENUM('Camión', 'Auto', 'Camioneta') NOT NULL,
  capacidad INT NOT NULL,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_transporte),
  UNIQUE KEY uk_transporte_numero (numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS choferes (
  id_chofer INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  telefono VARCHAR(20) NOT NULL,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_chofer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lugares (
  id_lugar INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(120) NOT NULL,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_lugar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS llegadas (
  id_llegada INT NOT NULL AUTO_INCREMENT,
  cliente_id VARCHAR(36) NULL,
  id_transporte INT NOT NULL,
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
  chofer VARCHAR(120) NOT NULL,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_llegada),
  UNIQUE KEY uk_llegadas_cliente (cliente_id),
  KEY idx_llegadas_fecha (fecha),
  CONSTRAINT fk_llegadas_transporte
    FOREIGN KEY (id_transporte) REFERENCES transportes (id_transporte),
  CONSTRAINT fk_llegadas_chofer
    FOREIGN KEY (id_chofer) REFERENCES choferes (id_chofer),
  CONSTRAINT fk_llegadas_procedencia
    FOREIGN KEY (id_procedencia) REFERENCES lugares (id_lugar),
  CONSTRAINT fk_llegadas_destino
    FOREIGN KEY (id_destino) REFERENCES lugares (id_lugar)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT NOT NULL AUTO_INCREMENT,
  usuario VARCHAR(40) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  clave VARCHAR(200) NOT NULL,
  estado ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uk_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Si llegadas ya existía con procedencia y destino de texto, ejecute esto
-- después de crear la tabla lugares. id_procedencia puede quedar NULL (se guarda como NA):
-- ALTER TABLE llegadas
--   ADD COLUMN id_procedencia INT NULL AFTER hora_entrada,
--   ADD COLUMN id_destino INT NULL AFTER hora_salida,
--   ADD CONSTRAINT fk_llegadas_procedencia FOREIGN KEY (id_procedencia) REFERENCES lugares (id_lugar),
--   ADD CONSTRAINT fk_llegadas_destino FOREIGN KEY (id_destino) REFERENCES lugares (id_lugar);
-- ALTER TABLE llegadas DROP COLUMN procedencia, DROP COLUMN destino;
-- Si id_procedencia ya existe y es NOT NULL:
-- ALTER TABLE llegadas MODIFY id_procedencia INT NULL;
