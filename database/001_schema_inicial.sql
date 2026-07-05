-- ─── ZONAS ───
CREATE TABLE zonas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVERNADEROS ───
CREATE TABLE invernaderos (
  id SERIAL PRIMARY KEY,
  zona_id INTEGER REFERENCES zonas(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  numero INTEGER NOT NULL,
  estado VARCHAR(20) DEFAULT 'cerrado' CHECK (estado IN ('abierto', 'cerrado', 'en_movimiento')),
  modo VARCHAR(20) DEFAULT 'local' CHECK (modo IN ('local', 'remoto', 'automatico')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MOTORES ───
CREATE TABLE motores (
  id SERIAL PRIMARY KEY,
  invernadero_id INTEGER REFERENCES invernaderos(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  variador_id VARCHAR(50),
  estado VARCHAR(20) DEFAULT 'detenido' CHECK (estado IN ('abriendo', 'cerrando', 'detenido', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DATOS METEOROLÓGICOS ───
CREATE TABLE datos_meteorologicos (
  id SERIAL PRIMARY KEY,
  zona_id INTEGER REFERENCES zonas(id) ON DELETE CASCADE,
  temperatura DECIMAL(5,2),
  humedad DECIMAL(5,2),
  velocidad_viento DECIMAL(5,2),
  radiacion_solar DECIMAL(8,2),
  probabilidad_lluvia DECIMAL(5,2),
  registrado_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EVENTOS DE CONTROL ───
CREATE TABLE eventos_control (
  id SERIAL PRIMARY KEY,
  invernadero_id INTEGER REFERENCES invernaderos(id) ON DELETE CASCADE,
  accion VARCHAR(20) NOT NULL CHECK (accion IN ('abrir', 'cerrar', 'detener')),
  modo_origen VARCHAR(20) NOT NULL CHECK (modo_origen IN ('local', 'remoto', 'automatico')),
  usuario_id INTEGER,
  resultado VARCHAR(20) DEFAULT 'pendiente' CHECK (resultado IN ('pendiente', 'exitoso', 'fallido')),
  detalle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USUARIOS ───
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) DEFAULT 'operador' CHECK (rol IN ('admin', 'operador', 'supervisor')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DATOS INICIALES ───
INSERT INTO zonas (nombre, descripcion) VALUES
  ('Zona A', 'Primer bloque de invernaderos'),
  ('Zona B', 'Segundo bloque de invernaderos'),
  ('Zona C', 'Tercer bloque de invernaderos'),
  ('Zona D', 'Cuarto bloque de invernaderos');