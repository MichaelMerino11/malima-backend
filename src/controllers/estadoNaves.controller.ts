import { Request, Response } from "express";
import pool from "../config/db";

export const recibirEventoEstado = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { grupo_id, estado_anterior, estado_nuevo, modo, timestamp } =
      req.body;

    if (!grupo_id || !estado_nuevo) {
      res
        .status(400)
        .json({ ok: false, mensaje: "grupo_id y estado_nuevo son requeridos" });
      return;
    }

    // Buscar el invernadero por grupo_id
    const { rows } = await pool.query(
      `SELECT id, nombre, zona_id FROM invernaderos WHERE grupo_id = $1`,
      [grupo_id],
    );

    if (rows.length === 0) {
      res.status(404).json({
        ok: false,
        mensaje: `No se encontró nave con grupo_id ${grupo_id}`,
      });
      return;
    }

    const nave = rows[0];

    // Determinar la acción
    const accion =
      estado_nuevo === "abierto"
        ? "abrir"
        : estado_nuevo === "cerrado"
          ? "cerrar"
          : "detener";

    // Registrar en eventos_control
    const commandId = `EVT-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    await pool.query(
      `INSERT INTO eventos_control 
        (id, invernadero_id, accion, modo_origen, resultado, detalle, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        commandId,
        nave.id,
        accion,
        modo ?? "automatico",
        "ejecutado",
        `estado_anterior: ${estado_anterior ?? "desconocido"} | estado_nuevo: ${estado_nuevo} | grupo_id: ${grupo_id} | origen: PLC/Tinker`,
        timestamp ? new Date(timestamp) : new Date(),
      ],
    );

    // Actualizar estado en invernaderos
    await pool.query(
      `UPDATE invernaderos SET estado = $1 WHERE grupo_id = $2`,
      [estado_nuevo, grupo_id],
    );

    res
      .status(200)
      .json({ ok: true, mensaje: "Evento registrado", event_id: commandId });
  } catch (error) {
    console.error("Error registrando evento de estado:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};