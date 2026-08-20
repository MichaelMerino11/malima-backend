import { Router } from "express";
import {
  obtenerZonas,
  obtenerResumen,
  obtenerEventos,
  obtenerVariadores,
} from "../controllers/zonas.controller";

const router = Router();

router.get("/", obtenerZonas);
router.get("/resumen", obtenerResumen);
router.get("/eventos", obtenerEventos);
router.get('/:zona_id/variadores', obtenerVariadores);

export default router;
