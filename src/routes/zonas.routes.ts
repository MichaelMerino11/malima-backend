import { Router } from "express";
import {
  obtenerZonas,
  obtenerResumen,
  obtenerEventos,
} from "../controllers/zonas.controller";

const router = Router();

router.get("/", obtenerZonas);
router.get("/resumen", obtenerResumen);
router.get("/eventos", obtenerEventos);

export default router;
