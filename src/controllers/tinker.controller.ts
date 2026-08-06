import { Request, Response } from "express";
import pool from "../config/db";

// POST /api/tinker/datos
// Recibe datos del sensor meteorológico y estado de variadores desde la TinkerBoard
export const recibirDatos = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      site_id,
      device_id,
      plc_id,
      zona_id,
      temperatura,
      humedad,
      velocidad_viento,
      radiacion_solar,
      probabilidad_lluvia,
      variadores,
    } = req.body;

    if (!zona_id || !plc_id) {
      res
        .status(400)
        .json({ ok: false, mensaje: "zona_id y plc_id son requeridos" });
      return;
    }

    // Guardar datos meteorológicos
    await pool.query(
      `INSERT INTO datos_meteorologicos
        (zona_id, temperatura, humedad, velocidad_viento, radiacion_solar, probabilidad_lluvia)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        zona_id,
        temperatura,
        humedad,
        velocidad_viento,
        radiacion_solar,
        probabilidad_lluvia ?? null,
      ],
    );

    // Actualizar estado de variadores si vienen en el payload
    if (variadores && Array.isArray(variadores)) {
      for (const v of variadores) {
        await pool.query(`UPDATE motores SET estado = $1 WHERE id = $2`, [
          v.estado,
          v.variador_id,
        ]);

        // Actualizar estado del invernadero según el variador
        const estadoInv =
          v.estado === "abriendo" || v.estado === "cerrando"
            ? "en_movimiento"
            : v.estado === "detenido"
              ? "cerrado"
              : "cerrado";

        await pool.query(
          `UPDATE invernaderos SET estado = $1
           WHERE id = (SELECT invernadero_id FROM motores WHERE id = $2)`,
          [estadoInv, v.variador_id],
        );
      }
    }

    console.log(
      `📡 Datos recibidos — site: ${site_id}, device: ${device_id}, plc: ${plc_id}, zona: ${zona_id}`,
    );
    res.status(200).json({ ok: true, mensaje: "Datos recibidos" });
  } catch (error) {
    console.error("Error recibiendo datos de TinkerBoard:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/tinker/confirmacion
// Recibe la confirmación de ejecución de un comando desde la TinkerBoard
export const recibirConfirmacion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { command_id, plc_id, variador_id, resultado, timestamp } = req.body;

    if (!command_id || !resultado) {
      res
        .status(400)
        .json({ ok: false, mensaje: "command_id y resultado son requeridos" });
      return;
    }

    // Actualizar el evento de control con el resultado
    await pool.query(
      `UPDATE eventos_control
       SET resultado = $1, detalle = $2
       WHERE id = $3`,
      [
        resultado === "ejecutado" ? "exitoso" : "fallido",
        `Confirmación TinkerBoard: ${resultado} — plc_id: ${plc_id}, variador_id: ${variador_id}`,
        command_id,
      ],
    );

    console.log(
      `✅ Confirmación recibida — command_id: ${command_id}, resultado: ${resultado}`,
    );
    res.status(200).json({ ok: true, mensaje: "Confirmación recibida" });
  } catch (error) {
    console.error("Error recibiendo confirmación:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/tinker/ultimo-estado/:zona_id
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
