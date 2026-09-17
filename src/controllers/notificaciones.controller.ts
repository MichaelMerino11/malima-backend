import { Request, Response } from "express";
import pool from '../config/db'

export const obtenerNotificaciones = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).usuario?.id;
    const { rows } = await pool.query(
      `SELECT id, tipo, titulo, mensaje, leida, created_at
       FROM notificaciones
       WHERE usuario_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [usuarioId],
    );
    res.json({ ok: true, data: rows });
  } catch (error) {
    console.error("Error obteniendo notificaciones:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
};

export const crearNotificacion = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).usuario?.id;
    const { tipo, titulo, mensaje } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje)
       VALUES ($1, $2, $3, $4)
       RETURNING id, tipo, titulo, mensaje, leida, created_at`,
      [usuarioId, tipo ?? "info", titulo, mensaje],
    );
    res.json({ ok: true, data: rows[0] });
  } catch (error) {
    console.error("Error creando notificación:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
};

export const marcarLeida = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).usuario?.id;
    const { id } = req.params;
    await pool.query(
      `UPDATE notificaciones SET leida = true
       WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
};

export const marcarTodasLeidas = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).usuario?.id;
    await pool.query(
      `UPDATE notificaciones SET leida = true WHERE usuario_id = $1`,
      [usuarioId],
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
};

export const eliminarNotificacion = async (req: Request, res: Response) => {
  try {
    const usuarioId = (req as any).usuario?.id;
    const { id } = req.params;
    await pool.query(
      `DELETE FROM notificaciones WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, mensaje: "Error interno" });
  }
};