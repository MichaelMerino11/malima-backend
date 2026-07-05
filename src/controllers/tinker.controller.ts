import { Request, Response } from "express";
import pool from "../config/db";

// POST /api/tinker/meteorologia
// Recibe datos del sensor meteorológico desde la TinkerBoard
export const recibirDatosMeteorologicos = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      zona_id,
      temperatura,
      humedad,
      velocidad_viento,
      radiacion_solar,
      probabilidad_lluvia,
    } = req.body;

    if (!zona_id) {
      res.status(400).json({ ok: false, mensaje: "zona_id es requerido" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO datos_meteorologicos 
        (zona_id, temperatura, humedad, velocidad_viento, radiacion_solar, probabilidad_lluvia)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        zona_id,
        temperatura,
        humedad,
        velocidad_viento,
        radiacion_solar,
        probabilidad_lluvia ?? null,
      ],
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error recibiendo datos meteorológicos:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/tinker/estado-motor
// Recibe el estado actual de un motor desde la TinkerBoard
export const recibirEstadoMotor = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { motor_id, estado, invernadero_id } = req.body;

    if (!motor_id || !estado || !invernadero_id) {
      res
        .status(400)
        .json({
          ok: false,
          mensaje: "motor_id, estado e invernadero_id son requeridos",
        });
      return;
    }

    // Actualizar estado del motor
    await pool.query(`UPDATE motores SET estado = $1 WHERE id = $2`, [
      estado,
      motor_id,
    ]);

    // Actualizar estado del invernadero según el motor
    const estadoInvernadero =
      estado === "abriendo"
        ? "en_movimiento"
        : estado === "cerrando"
          ? "en_movimiento"
          : estado === "detenido"
            ? "cerrado"
            : "cerrado";

    await pool.query(`UPDATE invernaderos SET estado = $1 WHERE id = $2`, [
      estadoInvernadero,
      invernadero_id,
    ]);

    res.status(200).json({ ok: true, mensaje: "Estado actualizado" });
  } catch (error) {
    console.error("Error recibiendo estado de motor:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/tinker/ultimo-estado/:zona_id
// Último estado meteorológico y de motores de una zona
export const obtenerUltimoEstado = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { zona_id } = req.params;

    const meteo = await pool.query(
      `SELECT * FROM datos_meteorologicos 
       WHERE zona_id = $1 
       ORDER BY registrado_at DESC 
       LIMIT 1`,
      [zona_id],
    );

    const invernaderos = await pool.query(
      `SELECT i.*, m.estado as estado_motor
       FROM invernaderos i
       LEFT JOIN motores m ON m.invernadero_id = i.id
       WHERE i.zona_id = $1`,
      [zona_id],
    );

    res.status(200).json({
      ok: true,
      data: {
        meteorologia: meteo.rows[0] ?? null,
        invernaderos: invernaderos.rows,
      },
    });
  } catch (error) {
    console.error("Error obteniendo último estado:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
