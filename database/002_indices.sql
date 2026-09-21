-- ─────────────────────────────────────────────────────────────
-- ÍNDICES DE RENDIMIENTO
-- ─────────────────────────────────────────────────────────────

-- Meteorología
--
-- Optimiza:
-- 1. Última lectura de una zona.
-- 2. Historial reciente de una zona.
-- 3. Consultas por rangos de fecha.
--
-- PostgreSQL puede recorrer este índice en ambos sentidos,
-- por lo que cubre ORDER BY registrado_at ASC y DESC.

CREATE INDEX IF NOT EXISTS idx_datos_meteorologicos_zona_fecha
ON public.datos_meteorologicos (
  zona_id,
  registrado_at DESC
);