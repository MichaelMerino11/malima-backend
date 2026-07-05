import { Router } from "express";
import {
  evaluarZona,
  obtenerUmbrales,
  evaluarTodasLasZonas,
} from "../controllers/automatizacion.controller";

const router = Router();

router.post("/evaluar/:zona_id", evaluarZona);
router.post("/evaluar-todas", evaluarTodasLasZonas);
router.get("/umbrales", obtenerUmbrales);

export default router;
