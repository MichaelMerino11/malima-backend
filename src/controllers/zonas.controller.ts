import { Request, Response } from "express";
import pool from "../config/db";

export const obtenerZonas = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const zonas = await pool.query(
      `SELECT * FROM zonas WHERE activa = true ORDER BY id`,
    );

    res.status(200).json({ ok: true, data: zonas.rows });
  } catch (error) {
    console.error("Error obteniendo zonas:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

export const obtenerResumen = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const resumen = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'abierto') as abiertos,
        COUNT(*) FILTER (WHERE estado = 'cerrado') as cerrados,
        COUNT(*) FILTER (WHERE estado = 'en_movimiento') as en_movimiento,
        COUNT(*) FILTER (WHERE modo = 'automatico') as en_automatico,
        COUNT(*) FILTER (WHERE modo = 'remoto') as en_remoto,
        COUNT(*) FILTER (WHERE modo = 'local') as en_local,
        COUNT(*) as total
      FROM invernaderos
      WHERE activo = true
    `);

    res.status(200).json({ ok: true, data: resumen.rows[0] });
  } catch (error) {
    console.error("Error obteniendo resumen:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
