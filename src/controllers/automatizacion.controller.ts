import { Request, Response } from "express";
import pool from "../config/db";

// ─── Umbrales por defecto ───
const UMBRALES_DEFAULT = {
  temperatura_max: 35, // °C — cierra si supera esto
  velocidad_viento_max: 40, // km/h — cierra si supera esto
  probabilidad_lluvia_min: 60, // % — cierra si supera esto
  radiacion_min: 100, // W/m² — abre si supera esto y no hay riesgo
};

// Decide la acción basándose en los datos meteorológicos
const decidirAccion = (
  datos: {
    temperatura: number;
    humedad: number;
    velocidad_viento: number;
    radiacion_solar: number;
    probabilidad_lluvia: number;
  },
  umbrales = UMBRALES_DEFAULT,
): { accion: "abrir" | "cerrar"; motivo: string } => {
  // Prioridad 1: lluvia inminente → cerrar siempre
  if (datos.probabilidad_lluvia >= umbrales.probabilidad_lluvia_min) {
    return {
      accion: "cerrar",
      motivo: `Probabilidad de lluvia ${datos.probabilidad_lluvia}% supera el umbral de ${umbrales.probabilidad_lluvia_min}%`,
    };
  }

  // Prioridad 2: viento fuerte → cerrar
  if (datos.velocidad_viento >= umbrales.velocidad_viento_max) {
    return {
      accion: "cerrar",
      motivo: `Viento ${datos.velocidad_viento} km/h supera el umbral de ${umbrales.velocidad_viento_max} km/h`,
    };
  }

  // Prioridad 3: temperatura muy alta → cerrar para proteger
  if (datos.temperatura >= umbrales.temperatura_max) {
    return {
      accion: "cerrar",
      motivo: `Temperatura ${datos.temperatura}°C supera el umbral de ${umbrales.temperatura_max}°C`,
    };
  }

  // Condiciones favorables → abrir
  if (datos.radiacion_solar >= umbrales.radiacion_min) {
    return {
      accion: "abrir",
      motivo: `Condiciones favorables — radiación ${datos.radiacion_solar} W/m², sin riesgos detectados`,
    };
  }

  // Por defecto: cerrar (safe state)
  return {
    accion: "cerrar",
    motivo: "Radiación insuficiente — manteniendo invernaderos cerrados",
  };
};

// POST /api/automatizacion/evaluar/:zona_id
// Evalúa los datos más recientes de una zona y ejecuta la acción si hay invernaderos en modo automático
export const evaluarZona = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { zona_id } = req.params;

    // Obtener último dato meteorológico de la zona
    const meteoResult = await pool.query(
      `SELECT * FROM datos_meteorologicos
       WHERE zona_id = $1
       ORDER BY registrado_at DESC
       LIMIT 1`,
      [zona_id],
    );

    if (meteoResult.rows.length === 0) {
      res
        .status(404)
        .json({
          ok: false,
          mensaje: "No hay datos meteorológicos para esta zona",
        });
      return;
    }

    const datos = meteoResult.rows[0];
    const { accion, motivo } = decidirAccion(datos);

    // Obtener invernaderos en modo automático de esta zona
    const invResult = await pool.query(
      `SELECT i.*, m.id as motor_id, m.variador_id
       FROM invernaderos i
       LEFT JOIN motores m ON m.invernadero_id = i.id
       WHERE i.zona_id = $1 AND i.modo = 'automatico' AND i.activo = true`,
      [zona_id],
    );

    if (invResult.rows.length === 0) {
      res.status(200).json({
        ok: true,
        mensaje: "No hay invernaderos en modo automático en esta zona",
        decision: { accion, motivo },
      });
      return;
    }

    // Enviar comando a cada invernadero en modo automático
    const TINKERBOARD_URL =
      process.env.TINKERBOARD_URL ?? "http://192.168.1.100";
    const resultados = await Promise.all(
      invResult.rows.map(async (inv) => {
        try {
          const response = await fetch(`${TINKERBOARD_URL}/comando`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              invernadero_id: inv.id,
              motor_id: inv.motor_id,
              variador_id: inv.variador_id,
              accion,
            }),
            signal: AbortSignal.timeout(5000),
          });

          const enviado = response.ok;

          await pool.query(
            `INSERT INTO eventos_control (invernadero_id, accion, modo_origen, resultado, detalle)
             VALUES ($1, $2, 'automatico', $3, $4)`,
            [inv.id, accion, enviado ? "exitoso" : "fallido", motivo],
          );

          return {
            invernadero_id: inv.id,
            nombre: inv.nombre,
            resultado: enviado ? "exitoso" : "fallido",
          };
        } catch {
          return {
            invernadero_id: inv.id,
            nombre: inv.nombre,
            resultado: "fallido",
          };
        }
      }),
    );

    res.status(200).json({
      ok: true,
      decision: { accion, motivo },
      resultados,
    });
  } catch (error) {
    console.error("Error evaluando zona:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/automatizacion/umbrales
// Retorna los umbrales actuales
export const obtenerUmbrales = async (
  req: Request,
  res: Response,
): Promise<void> => {
  res.status(200).json({ ok: true, data: UMBRALES_DEFAULT });
};

// POST /api/automatizacion/evaluar-todas
// Evalúa todas las zonas de una vez (llamado por el cron job)
export const evaluarTodasLasZonas = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const zonas = await pool.query(`SELECT id FROM zonas WHERE activa = true`);

    const resultados = await Promise.all(
      zonas.rows.map(async (zona) => {
        const meteo = await pool.query(
          `SELECT * FROM datos_meteorologicos
           WHERE zona_id = $1
           ORDER BY registrado_at DESC
           LIMIT 1`,
          [zona.id],
        );

        if (meteo.rows.length === 0) {
          return { zona_id: zona.id, mensaje: "Sin datos meteorológicos" };
        }

        const { accion, motivo } = decidirAccion(meteo.rows[0]);
        return { zona_id: zona.id, accion, motivo };
      }),
    );

    res.status(200).json({ ok: true, data: resultados });
  } catch (error) {
    console.error("Error evaluando todas las zonas:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
