import { Router } from "express";
import {
  listarAlarmas,
  resolverAlarma,
  resolverTodasAlarmas,
  resumenAlarmas,
} from "../controllers/alarmas.controller";
import { verificarToken } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", verificarToken, listarAlarmas);
router.get("/resumen", verificarToken, resumenAlarmas);
router.patch("/resolver-todas", verificarToken, resolverTodasAlarmas);
router.patch("/:id/resolver", verificarToken, resolverAlarma);

export default router;