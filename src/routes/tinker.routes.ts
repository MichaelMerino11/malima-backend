import { Router } from "express";
import {
  recibirDatosMeteorologicos,
  recibirEstadoMotor,
  obtenerUltimoEstado,
} from "../controllers/tinker.controller";

const router = Router();

router.post("/meteorologia", recibirDatosMeteorologicos);
router.post("/estado-motor", recibirEstadoMotor);
router.get("/ultimo-estado/:zona_id", obtenerUltimoEstado);

export default router;
