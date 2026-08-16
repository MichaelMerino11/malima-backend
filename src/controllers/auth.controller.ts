import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db";

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
      `SELECT id, nombre, email, rol, avatar_url, created_at FROM usuarios WHERE id = $1`,
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
