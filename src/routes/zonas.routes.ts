import { Router } from "express";
import { obtenerZonas, obtenerResumen } from "../controllers/zonas.controller";

const router = Router();

router.get("/", obtenerZonas);
router.get('/resumen', obtenerResumen);

export default router;
