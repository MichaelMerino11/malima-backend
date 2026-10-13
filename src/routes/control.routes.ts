import { Router } from "express";
import {
  controlarInvernadero,
  controlarZona,
  cambiarModo,
  controlarGrupo,
} from "../controllers/control.controller";
import { verificarToken } from "../middlewares/auth.middleware";
import {
  configurarMeteorologica,
  obtenerConfigMeteorologica,
  obtenerEstadoPredictor,
} from "../controllers/control.controller";

const router = Router();

router.post("/invernadero/:id", controlarInvernadero);
router.post("/zona/:zona_id", controlarZona);
router.patch("/invernadero/:id/modo", cambiarModo);
router.post("/grupo/:grupo_id", verificarToken, controlarGrupo);
router.post("/meteorologia", configurarMeteorologica);
router.get("/meteorologia/config", verificarToken, obtenerConfigMeteorologica);
router.get("/predictor/estado", verificarToken, obtenerEstadoPredictor);

export default router;