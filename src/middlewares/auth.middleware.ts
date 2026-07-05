import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "malima_secret_key";

export interface TokenPayload {
  id: number;
  email: string;
  rol: "admin" | "operador" | "supervisor";
}

declare global {
  namespace Express {
    interface Request {
      usuario?: TokenPayload;
    }
  }
}

export const verificarToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, mensaje: "Token requerido" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.usuario = payload;
    next();
  } catch {
    res.status(401).json({ ok: false, mensaje: "Token inválido o expirado" });
  }
};

export const soloAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.usuario?.rol !== "admin") {
    res
      .status(403)
      .json({ ok: false, mensaje: "Acceso restringido a administradores" });
    return;
  }
  next();
};

export const soloOperadorOAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!["admin", "operador"].includes(req.usuario?.rol ?? "")) {
    res.status(403).json({ ok: false, mensaje: "Acceso restringido" });
    return;
  }
  next();
};
