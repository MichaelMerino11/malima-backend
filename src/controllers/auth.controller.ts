import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

const JWT_SECRET = process.env.JWT_SECRET ?? "malima_secret_key";
const JWT_EXPIRES = "8h";

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res
        .status(400)
        .json({ ok: false, mensaje: "Email y password son requeridos" });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM usuarios WHERE email = $1 AND activo = true`,
      [email],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ ok: false, mensaje: "Credenciales incorrectas" });
      return;
    }

    const usuario = result.rows[0];
    const passwordValida = await bcrypt.compare(
      password,
      usuario.password_hash,
    );

    if (!passwordValida) {
      res.status(401).json({ ok: false, mensaje: "Credenciales incorrectas" });
      return;
    }

    // Verificar si tiene MFA activo
    if (usuario.mfa_activo) {
      res.status(200).json({
        ok: true,
        requiere_mfa: true,
        email: usuario.email,
      });
      return;
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES },
    );

    res.status(200).json({
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/auth/register (solo admin)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nombre, email, password, rol = "operador" } = req.body;

    if (!nombre || !email || !password) {
      res.status(400).json({
        ok: false,
        mensaje: "Nombre, email y password son requeridos",
      });
      return;
    }

    const existe = await pool.query(
      `SELECT id FROM usuarios WHERE email = $1`,
      [email],
    );

    if (existe.rows.length > 0) {
      res
        .status(409)
        .json({ ok: false, mensaje: "El email ya está registrado" });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, email, rol, created_at`,
      [nombre, email, password_hash, rol],
    );

    res.status(201).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error en register:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// GET /api/auth/me
export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, email, rol, avatar_url, mfa_activo, created_at FROM usuarios WHERE id = $1`,
      [req.usuario?.id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ ok: false, mensaje: "Usuario no encontrado" });
      return;
    }

    res.status(200).json({ ok: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error en me:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/auth/mfa/generar
export const generarMFA = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = req.usuario?.id;

    const secret = speakeasy.generateSecret({
      name: `Grupo Malima (${req.usuario?.email})`,
      length: 20,
    });

    // Guardar secret temporalmente (no activado aún)
    await pool.query(`UPDATE usuarios SET mfa_secret = $1 WHERE id = $2`, [
      secret.base32,
      id,
    ]);

    // Generar QR
    const qrUrl = await QRCode.toDataURL(secret.otpauth_url ?? "");

    res.status(200).json({
      ok: true,
      data: {
        secret: secret.base32,
        qr: qrUrl,
      },
    });
  } catch (error) {
    console.error("Error generando MFA:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/auth/mfa/verificar
export const verificarMFA = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { codigo } = req.body;
    const id = req.usuario?.id;

    if (!codigo) {
      res.status(400).json({ ok: false, mensaje: "Código requerido" });
      return;
    }

    const result = await pool.query(
      `SELECT mfa_secret FROM usuarios WHERE id = $1`,
      [id],
    );

    const secret = result.rows[0]?.mfa_secret;
    if (!secret) {
      res.status(400).json({ ok: false, mensaje: "MFA no configurado" });
      return;
    }

    const valido = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: codigo,
      window: 1,
    });

    if (!valido) {
      res.status(401).json({ ok: false, mensaje: "Código incorrecto" });
      return;
    }

    // Activar MFA
    await pool.query(`UPDATE usuarios SET mfa_activo = true WHERE id = $1`, [
      id,
    ]);

    res.status(200).json({ ok: true, mensaje: "MFA activado correctamente" });
  } catch (error) {
    console.error("Error verificando MFA:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/auth/mfa/desactivar
export const desactivarMFA = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { codigo } = req.body;
    const id = req.usuario?.id;

    const result = await pool.query(
      `SELECT mfa_secret FROM usuarios WHERE id = $1`,
      [id],
    );

    const secret = result.rows[0]?.mfa_secret;
    if (!secret) {
      res.status(400).json({ ok: false, mensaje: "MFA no configurado" });
      return;
    }

    const valido = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: codigo,
      window: 1,
    });

    if (!valido) {
      res.status(401).json({ ok: false, mensaje: "Código incorrecto" });
      return;
    }

    await pool.query(
      `UPDATE usuarios SET mfa_activo = false, mfa_secret = NULL WHERE id = $1`,
      [id],
    );

    res
      .status(200)
      .json({ ok: true, mensaje: "MFA desactivado correctamente" });
  } catch (error) {
    console.error("Error desactivando MFA:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};

// POST /api/auth/mfa/validar-login
export const validarLoginMFA = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
      res.status(400).json({ ok: false, mensaje: "Email y código requeridos" });
      return;
    }

    const result = await pool.query(
      `SELECT id, nombre, email, rol, mfa_secret FROM usuarios WHERE email = $1 AND activo = true`,
      [email],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ ok: false, mensaje: "Usuario no encontrado" });
      return;
    }

    const usuario = result.rows[0];
    const valido = speakeasy.totp.verify({
      secret: usuario.mfa_secret,
      encoding: "base32",
      token: codigo,
      window: 1,
    });

    if (!valido) {
      res.status(401).json({ ok: false, mensaje: "Código MFA incorrecto" });
      return;
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES },
    );

    res.status(200).json({
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error("Error validando MFA login:", error);
    res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
  }
};
