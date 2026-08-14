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

export const obtenerEventos = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const limit = req.query.limit ?? 50;
    const zona_id = req.query.zona_id;

    let query = `
      SELECT 
        e.id,
        e.accion,
        e.modo_origen,
        e.resultado,
        e.detalle,
        e.created_at,
        i.nombre as invernadero_nombre,
        i.zona_id,
        z.nombre as zona_nombre,
        u.nombre as usuario_nombre
      FROM eventos_control e
      LEFT JOIN invernaderos i ON i.id = e.invernadero_id
      LEFT JOIN zonas z ON z.id = i.zona_id
      LEFT JOIN usuarios u ON u.id = e.usuario_id::integer
    `;

    const params: any[] = [];

    if (zona_id) {
      query += ` WHERE i.zona_id = $1`;
      params.push(zona_id);
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.status(200).json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("Error obteniendo eventos:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
