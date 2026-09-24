import { Request, Response } from "express";
import pool from "../config/db";
import { io } from "../index";
import { registrarAlarma } from "./alarmas.controller";
import { getConfigValue } from "./configuracion.controller";

// POST /api/tinker/datos
export const recibirDatos = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      site_id,
      device_id,
      plc_id,
      zona_id,
      temperatura,
      humedad,
      velocidad_viento_ms,
      radiacion_solar,
      probabilidad_lluvia,
      presion_atmosferica,
      variadores,
      grupos,
      presion_hpa,
      lluvia_intensidad,
      lluvia_acumulada,
    } = req.body;

    if (!zona_id || !plc_id) {
      res
        .status(400)
        .json({ ok: false, mensaje: "zona_id y plc_id son requeridos" });
      return;
    }

    // Convertir m/s a km/h para almacenamiento
    const velocidad_viento_kmh =
      velocidad_viento_ms != null
        ? Math.round(velocidad_viento_ms * 3.6 * 100) / 100
        : null;

    await pool.query(
      `INSERT INTO datos_meteorologicos
   (zona_id, temperatura, humedad, velocidad_viento, radiacion_solar,
    probabilidad_lluvia, presion_atmosferica, lluvia_intensidad, lluvia_acumulada)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        zona_id,
        temperatura,
        humedad,
        velocidad_viento_kmh,
        radiacion_solar != null && Number(radiacion_solar) === 32767
          ? null
          : radiacion_solar,
        null,
        presion_hpa ?? presion_atmosferica ?? null,
        lluvia_intensidad != null ? Number(lluvia_intensidad) / 10 : null, // escala /10
        lluvia_acumulada != null ? Number(lluvia_acumulada) / 10 : null, // escala /10
      ],
    );

    // Procesar variadores
    if (variadores && Array.isArray(variadores)) {
      for (const v of variadores) {
        await pool.query(
          `UPDATE motores 
       SET estado = $1, hz = $2, amperaje = $3
       WHERE id = $4`,
          [v.estado, v.hz ?? 0, v.amperaje ?? 0, v.variador_id],
        );

        const estadoInv =
          v.estado === "abriendo" || v.estado === "cerrando"
            ? "en_movimiento"
            : "cerrado";

        await pool.query(
          `UPDATE invernaderos SET estado = $1
       WHERE id = (SELECT invernadero_id FROM motores WHERE id = $2)`,
          [estadoInv, v.variador_id],
        );
      }
    }

    // Procesar modos de grupos si vienen en el payload
    if (grupos && Array.isArray(grupos)) {
      for (const g of grupos) {
        const { grupo_id, modo, modo_consistente, estado, estado_valido } = g;
        if (!grupo_id) continue;
        await pool.query(
          `UPDATE invernaderos 
       SET 
         modo = COALESCE($1, modo),
         estado = COALESCE($2, estado),
         estado_valido = COALESCE($3, estado_valido)
       WHERE grupo_id = $4`,
          [modo ?? null, estado ?? null, estado_valido ?? null, grupo_id],
        );
      }
    }

    console.log(
      `📡 Telemetría recibida — site: ${site_id}, device: ${device_id}, plc: ${plc_id}, zona: ${zona_id}`,
    );

    // Emitir a todos los clientes de esa zona
    io.to(`zona-${zona_id}`).emit("estado-actualizado", {
      zona_id,
      variadores,
      grupos, // <-- opcional: incluir grupos en el evento
      meteorologia: {
        temperatura,
        humedad,
        velocidad_viento_ms,
        radiacion_solar,
        probabilidad_lluvia,
      },
    });

    // Verificar umbrales y registrar alarmas
    const tempMax = Number(
      (await getConfigValue("umbral_temperatura_max")) ?? 35,
    );

    const vientoMax = Number((await getConfigValue("umbral_viento_max")) ?? 40);

    const lluviaMin = Number((await getConfigValue("umbral_lluvia_min")) ?? 60);

    const humedadMax = Number(
      (await getConfigValue("umbral_humedad_max")) ?? 85,
    );

    if (temperatura > tempMax) {
      await registrarAlarma(
        zona_id,
        "temperatura_alta",
        `Temperatura ${temperatura}°C supera el umbral de ${tempMax}°C`,
        temperatura,
        tempMax,
      );
    }

    if (velocidad_viento_ms * 3.6 > vientoMax) {
      await registrarAlarma(
        zona_id,
        "viento_fuerte",
        `Viento ${(velocidad_viento_ms * 3.6).toFixed(1)} km/h supera el umbral de ${vientoMax} km/h`,
        velocidad_viento_ms * 3.6,
        vientoMax,
      );
    }

    if ((probabilidad_lluvia ?? 0) > lluviaMin) {
      await registrarAlarma(
        zona_id,
        "lluvia_inminente",
        `Probabilidad de lluvia ${probabilidad_lluvia}% supera el umbral de ${lluviaMin}%`,
        probabilidad_lluvia,
        lluviaMin,
      );
    }

    if (humedad > humedadMax) {
      await registrarAlarma(
        zona_id,
        "humedad_alta",
        `Humedad ${humedad}% supera el umbral de ${humedadMax}%`,
        humedad,
        humedadMax,
      );
    }

    res.status(200).json({ ok: true, mensaje: "Datos recibidos" });
  } catch (error) {
    console.error("Error recibiendo datos de TinkerBoard:", error);
    res.status(500).json({
      ok: false,
      mensaje: "Error interno del servidor",
    });
  }
};

// POST /api/tinker/confirmacion
export const recibirConfirmacion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    console.log("📨 Confirmación body:", JSON.stringify(req.body, null, 2));

    const {
      command_id,
      plc_id,
      variador_id,
      grupo_id,
      accion,
      resultado,
      codigo_resultado,
      detalle,
      estado_real,
      miembros,
      timestamp,
    } = req.body;

    if (!command_id || !resultado) {
      res
        .status(400)
        .json({ ok: false, mensaje: "command_id y resultado son requeridos" });
      return;
    }

    const resultadosValidos = ["ejecutado", "fallido", "expirado", "parcial"];
    if (!resultadosValidos.includes(resultado)) {
      res.status(400).json({
        ok: false,
        mensaje: `resultado debe ser: ${resultadosValidos.join(", ")}`,
      });
      return;
    }

    // Construir detalle completo
    let detalleCompleto = detalle ?? null;

    if (miembros && Array.isArray(miembros) && miembros.length > 0) {
      // Para movimiento_grupo incluir resumen de miembros en el detalle
      const resumenMiembros = miembros
        .map(
          (m: any) =>
            `V${m.variador_id}:${m.resultado}(${m.estado_real ?? "desconocido"})`,
        )
        .join(" | ");
      detalleCompleto = `resultado: ${resultado} | grupo_id: ${grupo_id} | miembros: [${resumenMiembros}]`;
    } else if (variador_id) {
      detalleCompleto = `resultado: ${resultado} | codigo: ${codigo_resultado ?? "-"} | detalle: ${detalle ?? "-"} | estado_real: ${estado_real ?? "-"} | plc_id: ${plc_id}, variador_id: ${variador_id}`;
    }

    // Actualizar evento principal con resultado real de la confirmación
    await pool.query(
      `UPDATE eventos_control 
       SET resultado = $1, detalle = $2
       WHERE id = $3`,
      [resultado, detalleCompleto, command_id],
    );

    // Procesar miembros de movimiento_grupo
    // Procesar según tipo de confirmación
    if (miembros && Array.isArray(miembros) && miembros.length > 0) {
      // movimiento_grupo con miembros
      for (const miembro of miembros) {
        const {
          variador_id: v_id,
          resultado: v_resultado,
          estado_real: v_estado,
        } = miembro;

        const motorResult = await pool.query(
          `SELECT m.invernadero_id, i.zona_id
       FROM motores m
       JOIN invernaderos i ON i.id = m.invernadero_id
       WHERE m.variador_id = $1 LIMIT 1`,
          [String(v_id)],
        );

        if (motorResult.rows.length > 0) {
          const { invernadero_id, zona_id } = motorResult.rows[0];
          const estadoMotor = v_estado ?? "detenido";

          await pool.query(
            `UPDATE motores SET estado = $1 WHERE variador_id = $2`,
            [estadoMotor, String(v_id)],
          );

          if (v_resultado === "ejecutado") {
            await pool.query(
              `UPDATE invernaderos SET estado = 'en_movimiento' WHERE id = $1`,
              [invernadero_id],
            );
          }

          io.to(`zona-${zona_id}`).emit("estado-actualizado", {
            zona_id,
            command_id,
            variador_id: v_id,
            resultado: v_resultado,
            estado_real: v_estado,
          });
        }
      }
    } else if (grupo_id && !variador_id) {
      // cambio_modo de grupo
      const modoReal = req.body.modo_real ?? req.body.modo ?? "remoto";
      await pool.query(
        `UPDATE invernaderos SET modo = $1 WHERE grupo_id = $2`,
        [modoReal, grupo_id],
      );
      console.log(`✅ Modo cambiado en grupo ${grupo_id} → ${modoReal}`);
    } else if (variador_id && estado_real) {
      // movimiento_individual
      const motorResult = await pool.query(
        `SELECT m.invernadero_id, i.zona_id
     FROM motores m
     JOIN invernaderos i ON i.id = m.invernadero_id
     WHERE m.variador_id = $1 LIMIT 1`,
        [String(variador_id)],
      );

      if (motorResult.rows.length > 0) {
        const { invernadero_id, zona_id } = motorResult.rows[0];

        await pool.query(
          `UPDATE motores SET estado = $1 WHERE variador_id = $2`,
          [estado_real, String(variador_id)],
        );

        const estadoInv =
          estado_real === "abriendo" || estado_real === "cerrando"
            ? "en_movimiento"
            : estado_real === "abierto"
              ? "abierto"
              : "cerrado";

        await pool.query(`UPDATE invernaderos SET estado = $1 WHERE id = $2`, [
          estadoInv,
          invernadero_id,
        ]);

        io.to(`zona-${zona_id}`).emit("estado-actualizado", {
          zona_id,
          command_id,
          variador_id,
          resultado,
          estado_real,
        });
      }
    }

    console.log(`✅ Confirmación procesada: ${command_id} → ${resultado}`);
    res.status(200).json({ ok: true, mensaje: "Confirmación procesada" });
  } catch (error) {
    console.error("Error procesando confirmación:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/tinker/ultimo-estado/:zona_id
export const obtenerUltimoEstado = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { zona_id } = req.params;

    const meteo = await pool.query(
      `SELECT * FROM datos_meteorologicos
       WHERE zona_id = $1
       ORDER BY registrado_at DESC
       LIMIT 1`,
      [zona_id],
    );

    const invernaderos = await pool.query(
      `SELECT DISTINCT ON (i.id)
     i.*,
     m.estado as estado_motor,
     m.hz,
     m.amperaje
   FROM invernaderos i
   LEFT JOIN motores m ON m.invernadero_id = i.id
   WHERE i.zona_id = $1
   ORDER BY i.id, m.id`,
      [zona_id],
    );

    res.status(200).json({
      ok: true,
      data: {
        meteorologia: meteo.rows[0] ?? null,
        invernaderos: invernaderos.rows,
      },
    });
  } catch (error) {
    console.error("Error obteniendo último estado:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/meteorologia/historial/:zona_id

const rangos = {
  "1h": {
    intervalo: "1 hour",
    bucket: null,
  },

  "6h": {
    intervalo: "6 hours",
    bucket: "2 minutes",
  },

  "24h": {
    intervalo: "24 hours",
    bucket: "10 minutes",
  },

  "7d": {
    intervalo: "7 days",
    bucket: "1 hour",
  },

  "30d": {
    intervalo: "30 days",
    bucket: "4 hours",
  },
} as const;

export const obtenerHistorial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { zona_id } = req.params;
    const { desde, hasta, limit, rango } = req.query;

    let query: string;
    let params: any[];

    if (rango) {
      type RangoKey = "1h" | "6h" | "24h" | "7d" | "30d";

      const intervalos: Record<RangoKey, { bin: string; desde: string }> = {
        "1h": { bin: "1 minute", desde: "1 hour" },
        "6h": { bin: "2 minutes", desde: "6 hours" },
        "24h": { bin: "10 minutes", desde: "24 hours" },
        "7d": { bin: "1 hour", desde: "7 days" },
        "30d": { bin: "4 hours", desde: "30 days" },
      };

      const rangoKey = rango as string as RangoKey;
      const cfg = intervalos[rangoKey] ?? intervalos["24h"];

      query = `
    SELECT
      date_bin('${cfg.bin}', registrado_at, TIMESTAMPTZ '2001-01-01') AS registrado_at,
      AVG(temperatura)::numeric(5,2)          AS temperatura,
      AVG(humedad)::numeric(5,2)              AS humedad,
      AVG(velocidad_viento)::numeric(5,2)     AS velocidad_viento,
      AVG(radiacion_solar)::numeric(8,2)      AS radiacion_solar,
      AVG(presion_atmosferica)::numeric(7,2)  AS presion_atmosferica,
      AVG(lluvia_intensidad)::numeric(7,1)    AS lluvia_intensidad,
      AVG(lluvia_acumulada)::numeric(7,1)     AS lluvia_acumulada
    FROM datos_meteorologicos
    WHERE zona_id = $1
      AND registrado_at >= NOW() - INTERVAL '${cfg.desde}'
    GROUP BY date_bin('${cfg.bin}', registrado_at, TIMESTAMPTZ '2001-01-01')
    ORDER BY registrado_at ASC
  `;
      params = [zona_id];
    } else if (desde && hasta) {
      query = `
    SELECT
      date_bin('5 minutes', registrado_at, TIMESTAMPTZ '2001-01-01') AS registrado_at,
      AVG(temperatura)::numeric(5,2)          AS temperatura,
      AVG(humedad)::numeric(5,2)              AS humedad,
      AVG(velocidad_viento)::numeric(5,2)     AS velocidad_viento,
      AVG(radiacion_solar)::numeric(8,2)      AS radiacion_solar,
      AVG(presion_atmosferica)::numeric(7,2)  AS presion_atmosferica,
      AVG(lluvia_intensidad)::numeric(7,1)    AS lluvia_intensidad,
      AVG(lluvia_acumulada)::numeric(7,1)     AS lluvia_acumulada
    FROM datos_meteorologicos
    WHERE zona_id = $1
      AND registrado_at >= $2
      AND registrado_at <= $3
    GROUP BY date_bin('5 minutes', registrado_at, TIMESTAMPTZ '2001-01-01')
    ORDER BY registrado_at ASC
  `;
      params = [zona_id, desde, hasta];
    } else {
      const limitNum = Number(limit ?? 20);
      query = `
        SELECT
          registrado_at,
          temperatura,
          humedad,
          velocidad_viento,
          radiacion_solar,
          presion_atmosferica,
          lluvia_intensidad,
          lluvia_acumulada
        FROM datos_meteorologicos
        WHERE zona_id = $1
        ORDER BY registrado_at DESC
        LIMIT $2
      `;
      params = [zona_id, limitNum];
    }

    const result = await pool.query(query, params);
    res.status(200).json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("Error obteniendo historial:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
