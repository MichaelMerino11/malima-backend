import { Router } from "express";
import {
  recibirDatos,
  recibirConfirmacion,
  obtenerUltimoEstado,
} from "../controllers/tinker.controller";
import { verificarApiKey } from "../middlewares/auth.middleware";

const router = Router();

router.post("/datos", verificarApiKey, recibirDatos);
router.post("/confirmacion", verificarApiKey, recibirConfirmacion);
router.get("/ultimo-estado/:zona_id", obtenerUltimoEstado);

export default router;
