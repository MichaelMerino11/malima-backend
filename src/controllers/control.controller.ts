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
  tipo:
    | "movimiento_individual"
    | "cambio_modo"
    | "movimiento_grupo" = "movimiento_individual",
): Promise<{ ok: boolean; command_id: string }> => {
  const command_id = generarCommandId();
  const expires_at = new Date(Date.now() + 30000).toISOString();

  let url = "http://192.168.1.100";
  let endpoint = "/comando";

  try {
    url =
      (await getConfigValue("tinkerboard_url")) ??
      process.env.TINKERBOARD_URL ??
      "http://192.168.1.100";
    endpoint =
      (await getConfigValue("tinkerboard_endpoint_comando")) ?? "/comando";
    const timeout = 15000;
    const apiKey = process.env.TINKER_API_KEY ?? "malima-tinker-2026";

    const payload = {
      command_id,
      tipo,
      expires_at,
      ...comando,
    };

    console.log("Enviando comando a TinkerBoard:", JSON.stringify(payload));
    console.log("URL:", `${url}${endpoint}`);

    const response = await fetch(`${url}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
    });

    console.log("Respuesta TinkerBoard status:", response.status);
    const responseBody = await response.text();
    console.log("Respuesta TinkerBoard body:", responseBody);

    return { ok: response.ok, command_id };
  } catch (error) {
    console.error("Error enviando comando a TinkerBoard:", error);
    console.error("URL intentada:", `${url}${endpoint}`);
    console.error("Tipo de error:", (error as any)?.name);
    console.error("Mensaje:", (error as any)?.message);
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
      plc_id: 1,
      invernadero_id: Number(id),
      motor_id: invernadero.motor_id,
      variador_id: Number(invernadero.variador_id),
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
    const { modo, usuario_id = null } = req.body;

    if (!modo || !["local", "remoto", "automatico"].includes(modo)) {
      res.status(400).json({
        ok: false,
        mensaje: "modo debe ser: local, remoto o automatico",
      });
      return;
    }

    const inv = await pool.query(
      `SELECT grupo_id, zona_id FROM invernaderos WHERE id = $1`,
      [id],
    );

    if (inv.rows.length === 0) {
      res.status(404).json({ ok: false, mensaje: "Invernadero no encontrado" });
      return;
    }

    const { grupo_id, zona_id } = inv.rows[0];

    await pool.query(`UPDATE invernaderos SET modo = $1 WHERE id = $2`, [
      modo,
      id,
    ]);

    const comando = {
      plc_id: 1,
      grupo_id: grupo_id ?? 1,
      modo,
    };

    const { ok, command_id } = await enviarComando(comando, "cambio_modo");

    // Registrar evento
    await registrarEvento(
      command_id,
      Number(id),
      "cambio_modo",
      "remoto",
      usuario_id,
      ok ? "exitoso" : "fallido",
      ok
        ? `Modo cambiado a ${modo}`
        : "No se pudo comunicar con la TinkerBoard",
    );

    io.to(`zona-${zona_id}`).emit("comando-enviado", {
      invernadero_id: Number(id),
      accion: `cambio_modo_${modo}`,
      resultado: ok ? "exitoso" : "fallido",
    });

    res.status(200).json({ ok: true, mensaje: `Modo cambiado a '${modo}'` });
  } catch (error) {
    console.error("Error cambiando modo:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/control/grupo/:grupo_id
export const controlarGrupo = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { grupo_id } = req.params;
    const { accion, usuario_id = null } = req.body;

    if (!accion || !["abrir", "cerrar", "detener"].includes(accion)) {
      res.status(400).json({
        ok: false,
        mensaje: "accion debe ser: abrir, cerrar o detener",
      });
      return;
    }

    const comando = {
      plc_id: 1,
      grupo_id: Number(grupo_id),
      accion,
    };

    const { ok, command_id } = await enviarComando(
      comando,
      "movimiento_grupo" as any,
    );

    // Registrar evento por cada invernadero del grupo
    const invernaderos = await pool.query(
      `SELECT id FROM invernaderos WHERE grupo_id = $1 AND activo = true LIMIT 1`,
      [grupo_id],
    );

    if (invernaderos.rows.length > 0) {
      await registrarEvento(
        command_id,
        invernaderos.rows[0].id,
        accion,
        "remoto",
        usuario_id,
        ok ? "exitoso" : "fallido",
        ok ? undefined : "No se pudo comunicar con la TinkerBoard",
      );
    }

    if (!ok) {
      res.status(502).json({
        ok: false,
        mensaje: "No se pudo comunicar con la TinkerBoard",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      command_id,
      mensaje: `Comando '${accion}' enviado al grupo ${grupo_id}`,
    });
  } catch (error) {
    console.error("Error controlando grupo:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/control/meteorologia
export const configurarMeteorologica = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { usuario_id = null } = req.body;

    // Detectar qué bloque se está configurando
    const tieneLluvia = req.body.lluvia_umbral_raw !== undefined;
    const tieneViento = req.body.viento_rearme_ms !== undefined;
    const tienePredictor = req.body.predictor_habilitado !== undefined;

    if (!tieneLluvia && !tieneViento && !tienePredictor) {
      res.status(400).json({
        ok: false,
        mensaje: "Debe enviar al menos un bloque: lluvia, viento o predictor",
      });
      return;
    }

    let comando: Record<string, any> = { plc_id: 1 };
    let descripcion = "";

    if (tieneViento) {
      const viento_rearme_ms = Number(req.body.viento_rearme_ms);
      const viento_peligroso_ms = Number(req.body.viento_peligroso_ms);
      const tiempo_viento_peligroso_s = Number(
        req.body.tiempo_viento_peligroso_s,
      );
      const tiempo_rearme_viento_s = Number(req.body.tiempo_rearme_viento_s);

      if (viento_rearme_ms < 0 || viento_rearme_ms > 100) {
        res
          .status(400)
          .json({ ok: false, mensaje: "viento_rearme_ms debe ser 0..100 m/s" });
        return;
      }
      if (viento_peligroso_ms < 0 || viento_peligroso_ms > 100) {
        res.status(400).json({
          ok: false,
          mensaje: "viento_peligroso_ms debe ser 0..100 m/s",
        });
        return;
      }
      if (viento_rearme_ms >= viento_peligroso_ms) {
        res.status(400).json({
          ok: false,
          mensaje: "viento_rearme_ms debe ser menor que viento_peligroso_ms",
        });
        return;
      }
      if (tiempo_viento_peligroso_s < 1 || tiempo_viento_peligroso_s > 9999) {
        res.status(400).json({
          ok: false,
          mensaje: "tiempo_viento_peligroso_s debe ser 1..9999 s",
        });
        return;
      }
      if (tiempo_rearme_viento_s < 1 || tiempo_rearme_viento_s > 9999) {
        res.status(400).json({
          ok: false,
          mensaje: "tiempo_rearme_viento_s debe ser 1..9999 s",
        });
        return;
      }

      comando = {
        ...comando,
        viento_rearme_ms,
        viento_peligroso_ms,
        tiempo_viento_peligroso_s,
        tiempo_rearme_viento_s,
      };
      descripcion = `viento_rearme=${viento_rearme_ms}m/s viento_peligroso=${viento_peligroso_ms}m/s`;
    }

    if (tienePredictor) {
      const predictor_habilitado = Boolean(req.body.predictor_habilitado);
      const predictor_tiempo_reapertura_s = Number(
        req.body.predictor_tiempo_reapertura_s,
      );
      const predictor_hr_saturacion_pct = Number(
        req.body.predictor_hr_saturacion_pct,
      );
      const predictor_confirmacion_hr_s = Number(
        req.body.predictor_confirmacion_hr_s,
      );
      const predictor_delta_hr_30min_pp = Number(
        req.body.predictor_delta_hr_30min_pp,
      );
      const predictor_caida_temperatura_c = Number(
        req.body.predictor_caida_temperatura_c,
      );
      const predictor_confirmacion_convectiva_s = Number(
        req.body.predictor_confirmacion_convectiva_s,
      );
      const predictor_caida_presion_hpa = Number(
        req.body.predictor_caida_presion_hpa,
      );
      const predictor_confirmacion_presion_s = Number(
        req.body.predictor_confirmacion_presion_s,
      );

      if (
        predictor_tiempo_reapertura_s < 1 ||
        predictor_tiempo_reapertura_s > 9999
      ) {
        res.status(400).json({
          ok: false,
          mensaje: "predictor_tiempo_reapertura_s debe ser 1..9999 s",
        });
        return;
      }
      if (
        predictor_hr_saturacion_pct < 50 ||
        predictor_hr_saturacion_pct > 100
      ) {
        res.status(400).json({
          ok: false,
          mensaje: "predictor_hr_saturacion_pct debe ser 50..100",
        });
        return;
      }

      comando = {
        ...comando,
        predictor_habilitado,
        predictor_tiempo_reapertura_s,
        predictor_hr_saturacion_pct,
        predictor_confirmacion_hr_s,
        predictor_delta_hr_30min_pp,
        predictor_caida_temperatura_c,
        predictor_confirmacion_convectiva_s,
        predictor_caida_presion_hpa,
        predictor_confirmacion_presion_s,
      };
      descripcion = `predictor_habilitado=${predictor_habilitado}`;
    }

    if (tieneViento && tienePredictor) {
      // Ambos bloques juntos no están permitidos — enviar separados
      res.status(400).json({
        ok: false,
        mensaje:
          "Enviar viento y predictor en bloques separados con su propio command_id",
      });
      return;
    }

    if (tieneViento || tienePredictor) {
      const { ok, command_id } = await enviarComando(
        comando,
        "configuracion_meteorologica" as any,
      );
      await registrarEvento(
        command_id,
        1,
        "configuracion_meteorologica",
        "remoto",
        usuario_id,
        ok ? "exitoso" : "fallido",
        ok ? descripcion : "No se pudo comunicar con la TinkerBoard",
      );
      if (!ok) {
        res.status(502).json({
          ok: false,
          mensaje: "No se pudo comunicar con la TinkerBoard",
        });
        return;
      }
      res.status(202).json({
        ok: true,
        command_id,
        mensaje: "Configuración enviada — esperando confirmación del PLC",
      });
      return;
    }

    // Bloque lluvia (comportamiento anterior mantenido)
    const lluvia_umbral_raw = Number(req.body.lluvia_umbral_raw);
    const tiempo_confirmacion_lluvia_s = Number(
      req.body.tiempo_confirmacion_lluvia_s,
    );
    const tiempo_seco_reapertura_s = Number(req.body.tiempo_seco_reapertura_s);

    if (
      !lluvia_umbral_raw ||
      lluvia_umbral_raw < 1 ||
      lluvia_umbral_raw > 32766
    ) {
      res.status(400).json({
        ok: false,
        mensaje: "lluvia_umbral_raw debe ser entero 1..32766",
      });
      return;
    }
    if (
      !tiempo_confirmacion_lluvia_s ||
      tiempo_confirmacion_lluvia_s < 1 ||
      tiempo_confirmacion_lluvia_s > 9999
    ) {
      res.status(400).json({
        ok: false,
        mensaje: "tiempo_confirmacion_lluvia_s debe ser entero 1..9999",
      });
      return;
    }
    if (
      !tiempo_seco_reapertura_s ||
      tiempo_seco_reapertura_s < 1 ||
      tiempo_seco_reapertura_s > 9999
    ) {
      res.status(400).json({
        ok: false,
        mensaje: "tiempo_seco_reapertura_s debe ser entero 1..9999",
      });
      return;
    }

    const comandoLluvia = {
      plc_id: 1,
      lluvia_umbral_raw,
      tiempo_confirmacion_lluvia_s,
      tiempo_seco_reapertura_s,
    };
    const { ok, command_id } = await enviarComando(
      comandoLluvia,
      "configuracion_meteorologica" as any,
    );

    await registrarEvento(
      command_id,
      1,
      "configuracion_meteorologica",
      "remoto",
      usuario_id,
      ok ? "exitoso" : "fallido",
      ok
        ? `lluvia_umbral_raw=${lluvia_umbral_raw}`
        : "No se pudo comunicar con la TinkerBoard",
    );

    if (!ok) {
      res.status(502).json({
        ok: false,
        mensaje: "No se pudo comunicar con la TinkerBoard",
      });
      return;
    }

    res.status(202).json({
      ok: true,
      command_id,
      mensaje:
        "Configuración de lluvia enviada — esperando confirmación del PLC",
    });
  } catch (error) {
    console.error("Error configurando meteorología:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/control/meteorologia/config
export const obtenerConfigMeteorologica = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { plc_id = 1 } = req.query;
    const { rows } = await pool.query(
      `SELECT tipo, parametros, aplicado_at, command_id
       FROM configuracion_plc
       WHERE plc_id = $1`,
      [plc_id],
    );
    const config: Record<string, any> = {};
    for (const row of rows) {
      config[row.tipo] = {
        ...row.parametros,
        aplicado_at: row.aplicado_at,
        command_id: row.command_id,
      };
    }
    res.status(200).json({ ok: true, data: config });
  } catch (error) {
    console.error("Error obteniendo config meteorológica:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/control/predictor/estado
export const obtenerEstadoPredictor = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { plc_id = 1 } = req.query;
    const { rows } = await pool.query(
      `SELECT datos, registrado_at FROM estado_predictor WHERE plc_id = $1`,
      [plc_id],
    );
    res.status(200).json({
      ok: true,
      data: rows[0]?.datos ?? null,
      registrado_at: rows[0]?.registrado_at ?? null,
    });
  } catch (error) {
    console.error("Error obteniendo estado predictor:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};