import { Request, Response } from "express";
import pool from "../config/db";

// Función utilitaria para registrar alarma
export const registrarAlarma = async (
  zona_id: number,
  tipo: string,
  mensaje: string,
  valor_detectado?: number,
  umbral?: number,
) => {
  try {
    // Verificar si ya existe una alarma activa del mismo tipo para esa zona
    const existe = await pool.query(
      `SELECT id FROM alarmas 
       WHERE zona_id = $1 AND tipo = $2 AND estado = 'activa'`,
      [zona_id, tipo],
    );

    if (existe.rows.length > 0) return; // Ya existe, no duplicar

    await pool.query(
      `INSERT INTO alarmas (zona_id, tipo, mensaje, valor_detectado, umbral)
       VALUES ($1, $2, $3, $4, $5)`,
      [zona_id, tipo, mensaje, valor_detectado ?? null, umbral ?? null],
    );
  } catch (error) {
    console.error("Error registrando alarma:", error);
  }
};

// GET /api/alarmas
export const listarAlarmas = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { estado, zona_id } = req.query;

    let query = `
      SELECT a.*, z.nombre as zona_nombre
      FROM alarmas a
      LEFT JOIN zonas z ON z.id = a.zona_id
    `;

    const params: any[] = [];
    const condiciones: string[] = [];

    if (estado) {
      params.push(estado);
      condiciones.push(`a.estado = $${params.length}`);
    }

    if (zona_id) {
      params.push(zona_id);
      condiciones.push(`a.zona_id = $${params.length}`);
    }

    if (condiciones.length > 0) {
      query += ` WHERE ${condiciones.join(" AND ")}`;
    }

    query += ` ORDER BY a.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.status(200).json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("Error listando alarmas:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// PATCH /api/alarmas/:id/resolver
export const resolverAlarma = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE alarmas 
       SET estado = 'resuelta', resuelta_at = NOW()
       WHERE id = $1`,
      [id],
    );

    res.status(200).json({ ok: true, mensaje: "Alarma resuelta" });
  } catch (error) {
    console.error("Error resolviendo alarma:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// PATCH /api/alarmas/resolver-todas
export const resolverTodasAlarmas = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await pool.query(
      `UPDATE alarmas SET estado = 'resuelta', resuelta_at = NOW() WHERE estado = 'activa'`,
    );
    res.status(200).json({ ok: true, mensaje: "Todas las alarmas resueltas" });
  } catch (error) {
    console.error("Error resolviendo alarmas:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/alarmas/resumen
export const resumenAlarmas = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'activa') as activas,
        COUNT(*) FILTER (WHERE estado = 'resuelta') as resueltas,
        COUNT(*) as total
      FROM alarmas
    `);
    res.status(200).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error obteniendo resumen de alarmas:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
