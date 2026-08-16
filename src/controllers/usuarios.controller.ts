import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../config/db";
import { enviarCorreoRestablecimiento } from "../services/email.service";

// GET /api/usuarios — solo admin
export const listarUsuarios = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, rol, activo, created_at
       FROM usuarios ORDER BY created_at DESC`,
    );
    res.status(200).json({ ok: true, data: result.rows });
  } catch (error) {
    console.error("Error listando usuarios:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// PATCH /api/usuarios/:id — solo admin
export const actualizarUsuario = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { nombre, email, rol, activo } = req.body;

    await pool.query(
      `UPDATE usuarios SET
        nombre = COALESCE($1, nombre),
        email = COALESCE($2, email),
        rol = COALESCE($3, rol),
        activo = COALESCE($4, activo)
       WHERE id = $5`,
      [nombre, email, rol, activo, id],
    );

    res.status(200).json({ ok: true, mensaje: "Usuario actualizado" });
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// DELETE /api/usuarios/:id — solo admin
export const desactivarUsuario = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    await pool.query(`UPDATE usuarios SET activo = false WHERE id = $1`, [id]);

    res.status(200).json({ ok: true, mensaje: "Usuario desactivado" });
  } catch (error) {
    console.error("Error desactivando usuario:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// PATCH /api/usuarios/perfil — usuario autenticado
export const actualizarPerfil = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { nombre, email, avatar_url } = req.body;
    const id = req.usuario?.id;

    await pool.query(
      `UPDATE usuarios SET
        nombre = COALESCE($1, nombre),
        email = COALESCE($2, email),
        avatar_url = COALESCE($3, avatar_url)
       WHERE id = $4`,
      [nombre, email, avatar_url, id],
    );

    res.status(200).json({ ok: true, mensaje: "Perfil actualizado" });
  } catch (error) {
    console.error("Error actualizando perfil:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// PATCH /api/usuarios/cambiar-password — usuario autenticado
export const cambiarPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { password_actual, password_nuevo } = req.body;
    const id = req.usuario?.id;

    if (!password_actual || !password_nuevo) {
      res.status(400).json({
        ok: false,
        mensaje: "password_actual y password_nuevo son requeridos",
      });
      return;
    }

    const result = await pool.query(
      `SELECT password_hash FROM usuarios WHERE id = $1`,
      [id],
    );

    const valido = await bcrypt.compare(
      password_actual,
      result.rows[0].password_hash,
    );
    if (!valido) {
      res
        .status(401)
        .json({ ok: false, mensaje: "La contraseña actual es incorrecta" });
      return;
    }

    const hash = await bcrypt.hash(password_nuevo, 10);
    await pool.query(`UPDATE usuarios SET password_hash = $1 WHERE id = $2`, [
      hash,
      id,
    ]);

    res
      .status(200)
      .json({ ok: true, mensaje: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error cambiando password:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/usuarios/solicitar-reset — público
export const solicitarReset = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ ok: false, mensaje: "Email es requerido" });
      return;
    }

    const result = await pool.query(
      `SELECT id, nombre FROM usuarios WHERE email = $1 AND activo = true`,
      [email],
    );

    // Siempre responder ok para no revelar si el email existe
    if (result.rows.length === 0) {
      res.status(200).json({
        ok: true,
        mensaje: "Si el correo existe, recibirás un enlace en breve",
      });
      return;
    }

    const usuario = result.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + 3600000); // 1 hora

    await pool.query(
      `UPDATE usuarios SET reset_token = $1, reset_token_expira = $2 WHERE id = $3`,
      [token, expira, usuario.id],
    );

    await enviarCorreoRestablecimiento(email, usuario.nombre, token);

    res.status(200).json({
      ok: true,
      mensaje: "Si el correo existe, recibirás un enlace en breve",
    });
  } catch (error) {
    console.error("Error solicitando reset:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/usuarios/restablecer-password — público
export const restablecerPassword = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { token, password_nuevo } = req.body;

    if (!token || !password_nuevo) {
      res
        .status(400)
        .json({ ok: false, mensaje: "token y password_nuevo son requeridos" });
      return;
    }

    const result = await pool.query(
      `SELECT id FROM usuarios
       WHERE reset_token = $1
       AND reset_token_expira > NOW()
       AND activo = true`,
      [token],
    );

    if (result.rows.length === 0) {
      res.status(400).json({ ok: false, mensaje: "Token inválido o expirado" });
      return;
    }

    const hash = await bcrypt.hash(password_nuevo, 10);

    await pool.query(
      `UPDATE usuarios SET
        password_hash = $1,
        reset_token = NULL,
        reset_token_expira = NULL
       WHERE id = $2`,
      [hash, result.rows[0].id],
    );

    res
      .status(200)
      .json({ ok: true, mensaje: "Contraseña restablecida correctamente" });
  } catch (error) {
    console.error("Error restableciendo password:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
