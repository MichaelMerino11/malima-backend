import { Request, Response } from "express";
import pool from "../config/db";
import { getConfigValue } from "./configuracion.controller";

const enviarComando = async (comando: object): Promise<boolean> => {
  try {
    const url =
      (await getConfigValue("tinkerboard_url")) ??
      process.env.TINKERBOARD_URL ??
      "http://192.168.1.100";
    const endpoint =
      (await getConfigValue("tinkerboard_endpoint_comando")) ?? "/comando";
    const timeout = parseInt(
      (await getConfigValue("tinkerboard_timeout")) ?? "5000",
    );

    const response = await fetch(`${url}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(comando),
      signal: AbortSignal.timeout(timeout),
    });
    return response.ok;
  } catch (error) {
    console.error("Error enviando comando a TinkerBoard:", error);
    return false;
  }
};

// Registra el evento en la base de datos
const registrarEvento = async (
  invernadero_id: number,
  accion: string,
  modo_origen: string,
  usuario_id: number | null,
  resultado: string,
  detalle?: string,
) => {
  await pool.query(
    `INSERT INTO eventos_control (invernadero_id, accion, modo_origen, usuario_id, resultado, detalle)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      invernadero_id,
      accion,
      modo_origen,
      usuario_id,
      resultado,
      detalle ?? null,
    ],
  );
};

// POST /api/control/invernadero/:id
// Envía comando a un invernadero individual
export const controlarInvernadero = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { accion, modo_origen = "remoto", usuario_id = null } = req.body;

    if (!accion || !["abrir", "cerrar", "detener"].includes(accion)) {
      res.status(400).json({
        ok: false,
        mensaje: "accion debe ser: abrir, cerrar o detener",
      });
      return;
    }

    // Verificar que el invernadero existe y está en modo remoto o automático
    const inv = await pool.query(
      `SELECT i.*, m.id as motor_id, m.variador_id
       FROM invernaderos i
       LEFT JOIN motores m ON m.invernadero_id = i.id
       WHERE i.id = $1 AND i.activo = true`,
      [id],
    );

    if (inv.rows.length === 0) {
      res.status(404).json({ ok: false, mensaje: "Invernadero no encontrado" });
      return;
    }

    const invernadero = inv.rows[0];

    if (invernadero.modo === "local") {
      res.status(409).json({
        ok: false,
        mensaje:
          "El invernadero está en modo local. Cambia el modo desde el tablero.",
      });
      return;
    }

    // Enviar comando a la TinkerBoard
    const comando = {
      invernadero_id: Number(id),
      motor_id: invernadero.motor_id,
      variador_id: invernadero.variador_id,
      accion,
    };

    const enviado = await enviarComando(comando);

    // Registrar evento
    await registrarEvento(
      Number(id),
      accion,
      modo_origen,
      usuario_id,
      enviado ? "exitoso" : "fallido",
      enviado ? undefined : "No se pudo comunicar con la TinkerBoard",
    );

    if (!enviado) {
      res.status(502).json({
        ok: false,
        mensaje: "No se pudo comunicar con la TinkerBoard",
      });
      return;
    }

    res
      .status(200)
      .json({ ok: true, mensaje: `Comando '${accion}' enviado correctamente` });
  } catch (error) {
    console.error("Error controlando invernadero:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/control/zona/:zona_id
// Envía el mismo comando a todos los invernaderos de una zona
export const controlarZona = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { zona_id } = req.params;
    const { accion, modo_origen = "remoto", usuario_id = null } = req.body;

    if (!accion || !["abrir", "cerrar", "detener"].includes(accion)) {
      res.status(400).json({
        ok: false,
        mensaje: "accion debe ser: abrir, cerrar o detener",
      });
      return;
    }

    const invernaderos = await pool.query(
      `SELECT i.*, m.id as motor_id, m.variador_id
       FROM invernaderos i
       LEFT JOIN motores m ON m.invernadero_id = i.id
       WHERE i.zona_id = $1 AND i.activo = true AND i.modo != 'local'`,
      [zona_id],
    );

    if (invernaderos.rows.length === 0) {
      res.status(404).json({
        ok: false,
        mensaje: "No hay invernaderos disponibles en esta zona",
      });
      return;
    }

    const resultados = await Promise.all(
      invernaderos.rows.map(async (inv) => {
        const comando = {
          invernadero_id: inv.id,
          motor_id: inv.motor_id,
          variador_id: inv.variador_id,
          accion,
        };

        const enviado = await enviarComando(comando);

        await registrarEvento(
          inv.id,
          accion,
          modo_origen,
          usuario_id,
          enviado ? "exitoso" : "fallido",
          enviado ? undefined : "No se pudo comunicar con la TinkerBoard",
        );

        return {
          invernadero_id: inv.id,
          nombre: inv.nombre,
          resultado: enviado ? "exitoso" : "fallido",
        };
      }),
    );

    res.status(200).json({ ok: true, data: resultados });
  } catch (error) {
    console.error("Error controlando zona:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// PATCH /api/control/invernadero/:id/modo
// Cambia el modo de un invernadero (local, remoto, automatico)
export const cambiarModo = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { modo } = req.body;

    if (!modo || !["local", "remoto", "automatico"].includes(modo)) {
      res.status(400).json({
        ok: false,
        mensaje: "modo debe ser: local, remoto o automatico",
      });
      return;
    }

    await pool.query(`UPDATE invernaderos SET modo = $1 WHERE id = $2`, [
      modo,
      id,
    ]);

    res.status(200).json({ ok: true, mensaje: `Modo cambiado a '${modo}'` });
  } catch (error) {
    console.error("Error cambiando modo:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
