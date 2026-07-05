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
