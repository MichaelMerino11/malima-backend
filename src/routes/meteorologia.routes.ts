import { Router } from "express";
import { obtenerHistorial } from "../controllers/tinker.controller";

const router = Router();

router.get("/historial/:zona_id", obtenerHistorial);

export default router;
