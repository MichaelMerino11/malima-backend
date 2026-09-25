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

// POST /api/tinker/evento-alarma
export const recibirEventoAlarma = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      alarma_id,
      descripcion,
      tipo,
      evento,
      grupo_id,
      plc_id,
      timestamp,
    } = req.body;

    if (!alarma_id || !tipo || !evento || !plc_id) {
      res.status(400).json({
        ok: false,
        mensaje: "alarma_id, tipo, evento y plc_id son requeridos",
      });
      return;
    }

    const tiposValidos = [
      "sobrecorriente",
      "fallo_comunicacion_vfd",
      "falla_vfd",
      "fallo_comunicacion_nodo_lora",
      "proteccion_red_rm22",
      "fallo_estacion_meteorologica",
      "conflicto_ordenes_vfd",
      "fallo_no_arranque_vfd",
      "exceso_tiempo_marcha",
    ];
    
    if (!tiposValidos.includes(tipo)) {
      res.status(400).json({
        ok: false,
        mensaje: `tipo debe ser: ${tiposValidos.join(", ")}`,
      });
      return;
    }

    if (!["activacion", "restablecimiento"].includes(evento)) {
      res.status(400).json({
        ok: false,
        mensaje: "evento debe ser: activacion o restablecimiento",
      });
      return;
    }

    // Buscar invernadero_id por grupo_id si viene
    let invernaderoId: number | null = null;
    if (grupo_id !== null && grupo_id !== undefined) {
      const { rows } = await pool.query(
        `SELECT id FROM invernaderos WHERE grupo_id = $1`,
        [grupo_id],
      );
      if (rows.length > 0) invernaderoId = rows[0].id;
    }

    // Registrar en historial
    await pool.query(
      `INSERT INTO alarmas_plc (alarma_id, descripcion, tipo, evento, grupo_id, plc_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        alarma_id,
        descripcion ?? null,
        tipo,
        evento,
        invernaderoId,
        plc_id,
        timestamp ? new Date(timestamp) : new Date(),
      ],
    );

    // Actualizar estado actual
    if (evento === "activacion") {
      await pool.query(
        `INSERT INTO alarmas_activas_plc (alarma_id, descripcion, tipo, grupo_id, plc_id, activa, primera_vez_at, ultima_vez_at)
         VALUES ($1, $2, $3, $4, $5, true, $6, $6)
         ON CONFLICT (alarma_id) DO UPDATE SET
           activa = true,
           ultima_vez_at = $6,
           descripcion = EXCLUDED.descripcion`,
        [
          alarma_id,
          descripcion ?? null,
          tipo,
          invernaderoId,
          plc_id,
          timestamp ? new Date(timestamp) : new Date(),
        ],
      );
    } else {
      await pool.query(
        `UPDATE alarmas_activas_plc SET activa = false, ultima_vez_at = $1 WHERE alarma_id = $2`,
        [timestamp ? new Date(timestamp) : new Date(), alarma_id],
      );
    }

    res.status(200).json({ ok: true, mensaje: "Evento de alarma registrado" });
  } catch (error) {
    console.error("Error registrando evento de alarma:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/alarmas/plc/activas
export const listarAlarmasActivasPlc = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, i.nombre as nave_nombre
       FROM alarmas_activas_plc a
       LEFT JOIN invernaderos i ON i.id = a.grupo_id
       WHERE a.activa = true
       ORDER BY a.ultima_vez_at DESC`,
    );
    res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error("Error listando alarmas PLC:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/alarmas/plc/historial
export const historialAlarmasPlc = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { alarma_id, tipo, plc_id, desde, hasta } = req.query;
    const params: any[] = [];
    const condiciones: string[] = [];

    if (alarma_id) {
      params.push(alarma_id);
      condiciones.push(`a.alarma_id = $${params.length}`);
    }
    if (tipo) {
      params.push(tipo);
      condiciones.push(`a.tipo = $${params.length}`);
    }
    if (plc_id) {
      params.push(plc_id);
      condiciones.push(`a.plc_id = $${params.length}`);
    }
    if (desde) {
      params.push(desde);
      condiciones.push(`a.timestamp >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      condiciones.push(`a.timestamp <= $${params.length}`);
    }

    const where =
      condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT a.*, i.nombre as nave_nombre
       FROM alarmas_plc a
       LEFT JOIN invernaderos i ON i.id = a.grupo_id
       ${where}
       ORDER BY a.timestamp DESC
       LIMIT 200`,
      params,
    );
    res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    console.error("Error obteniendo historial alarmas PLC:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
