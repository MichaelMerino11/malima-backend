import { Router } from "express";
import { verificarToken } from '../middlewares/auth.middleware'
import {
  obtenerNotificaciones,
  crearNotificacion,
  marcarLeida,
  marcarTodasLeidas,
  eliminarNotificacion,
} from "../controllers/notificaciones.controller";

const router = Router();

router.use(verificarToken);

router.get("/", obtenerNotificaciones);
router.post("/", crearNotificacion);
router.patch("/:id/leer", marcarLeida);
router.patch("/leer-todas", marcarTodasLeidas);
router.delete("/:id", eliminarNotificacion);

export default router;