import { Request, Response } from "express";
import pool from "../config/db";

// GET /api/configuracion
export const obtenerConfiguracion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT * FROM configuracion ORDER BY clave`,
    );
    res.status(200).json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("Error obteniendo configuración:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// PATCH /api/configuracion/:clave
export const actualizarConfiguracion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { clave } = req.params;
    const { valor } = req.body;

    if (!valor) {
      res.status(400).json({ ok: false, mensaje: "valor es requerido" });
      return;
    }

    const result = await pool.query(
      `UPDATE configuracion 
       SET valor = $1, updated_at = NOW()
       WHERE clave = $2
       RETURNING *`,
      [valor, clave],
    );

    if (result.rows.length === 0) {
      res
        .status(404)
        .json({ ok: false, mensaje: "Configuración no encontrada" });
      return;
    }

    res.status(200).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error actualizando configuración:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// Función utilitaria para obtener un valor de configuración desde otros controllers
export const getConfigValue = async (clave: string): Promise<string | null> => {
  try {
    const result = await pool.query(
      `SELECT valor FROM configuracion WHERE clave = $1`,
      [clave],
    );
    return result.rows[0]?.valor ?? null;
  } catch {
    return null;
  }
};
