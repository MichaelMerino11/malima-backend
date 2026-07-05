import { Router } from "express";
import { obtenerZonas } from "../controllers/zonas.controller";

const router = Router();

router.get("/", obtenerZonas);

export default router;
