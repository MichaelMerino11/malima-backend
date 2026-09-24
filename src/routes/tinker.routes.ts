import { Router } from "express";
import {
  recibirDatos,
  recibirConfirmacion,
  obtenerUltimoEstado,
} from "../controllers/tinker.controller";
import { verificarApiKey } from "../middlewares/auth.middleware";
import { recibirEventoEstado } from "../controllers/estadoNaves.controller";

const router = Router();

router.post("/datos", verificarApiKey, recibirDatos);
router.post("/confirmacion", verificarApiKey, recibirConfirmacion);
router.post("/evento-estado", recibirEventoEstado);
router.get("/ultimo-estado/:zona_id", obtenerUltimoEstado);

export default router;
