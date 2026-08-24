import { Router } from "express";
import {
  controlarInvernadero,
  controlarZona,
  cambiarModo,
  controlarGrupo,
} from "../controllers/control.controller";
import { verificarToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/invernadero/:id", controlarInvernadero);
router.post("/zona/:zona_id", controlarZona);
router.patch("/invernadero/:id/modo", cambiarModo);
router.post('/grupo/:grupo_id', verificarToken, controlarGrupo);

export default router;
