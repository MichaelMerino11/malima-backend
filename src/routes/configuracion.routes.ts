import { Router } from "express";
import {
  obtenerConfiguracion,
  actualizarConfiguracion,
} from "../controllers/configuracion.controller";
import { verificarToken, soloAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", verificarToken, obtenerConfiguracion);
router.patch("/:clave", verificarToken, soloAdmin, actualizarConfiguracion);

export default router;
