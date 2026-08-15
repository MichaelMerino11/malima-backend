import { Request, Response } from "express";
import pool from "../config/db";
import { getConfigValue } from "./configuracion.controller";
import { io } from "../index";

const generarCommandId = () => {
  const num = Math.floor(Math.random() * 999999)
    .toString()
    .padStart(6, "0");
  return `CMD-${num}`;
};

const enviarComando = async (
  comando: object,
  tipo: "movimiento_individual" | "cambio_modo" = "movimiento_individual",
): Promise<{ ok: boolean; command_id: string }> => {
  const command_id = generarCommandId();
  const expires_at = new Date(Date.now() + 30000).toISOString();

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
    const apiKey = process.env.TINKER_API_KEY ?? "malima-tinker-2026";

    const payload = {
      command_id,
      tipo,
      expires_at,
      ...comando,
    };

    const response = await fetch(`${url}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
    });

    return { ok: response.ok, command_id };
  } catch (error) {
    console.error("Error enviando comando a TinkerBoard:", error);
    return { ok: false, command_id };
  }
};

const registrarEvento = async (
  command_id: string,
  invernadero_id: number,
  accion: string,
  modo_origen: string,
  usuario_id: number | null,
  resultado: string,
  detalle?: string,
) => {
  await pool.query(
    `INSERT INTO eventos_control (id, invernadero_id, accion, modo_origen, usuario_id, resultado, detalle)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      command_id,
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

    const comando = {
      invernadero_id: Number(id),
      motor_id: invernadero.motor_id,
      variador_id: invernadero.variador_id,
      accion,
    };

    const { ok, command_id } = await enviarComando(
      comando,
      "movimiento_individual",
    );

    await registrarEvento(
      command_id,
      Number(id),
      accion,
      modo_origen,
      usuario_id,
      ok ? "exitoso" : "fallido",
      ok ? undefined : "No se pudo comunicar con la TinkerBoard",
    );

    io.to(`zona-${invernadero.zona_id}`).emit("comando-enviado", {
      invernadero_id: Number(id),
      accion,
      resultado: ok ? "exitoso" : "fallido",
    });

    if (!ok) {
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

        const { ok, command_id } = await enviarComando(comando);

        await registrarEvento(
          command_id,
          inv.id,
          accion,
          modo_origen,
          usuario_id,
          ok ? "exitoso" : "fallido",
          ok ? undefined : "No se pudo comunicar con la TinkerBoard",
        );

        return {
          invernadero_id: inv.id,
          nombre: inv.nombre,
          resultado: ok ? "exitoso" : "fallido",
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

    // Obtener grupo_id y plc_id del invernadero
    const inv = await pool.query(
      `SELECT grupo_id, zona_id FROM invernaderos WHERE id = $1`,
      [id],
    );

    if (inv.rows.length === 0) {
      res.status(404).json({ ok: false, mensaje: "Invernadero no encontrado" });
      return;
    }

    const { grupo_id, zona_id } = inv.rows[0];

    // Actualizar modo en la DB
    await pool.query(`UPDATE invernaderos SET modo = $1 WHERE id = $2`, [
      modo,
      id,
    ]);

    // Enviar cambio de modo a la TinkerBoard
    const comando = {
      plc_id: 1,
      grupo_id: grupo_id ?? 1,
      modo,
    };

    await enviarComando(comando, "cambio_modo");

    res.status(200).json({ ok: true, mensaje: `Modo cambiado a '${modo}'` });
  } catch (error) {
    console.error("Error cambiando modo:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
