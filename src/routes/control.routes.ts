import { Router } from "express";
import {
  controlarInvernadero,
  controlarZona,
  cambiarModo,
} from "../controllers/control.controller";

const router = Router();

router.post("/invernadero/:id", controlarInvernadero);
router.post("/zona/:zona_id", controlarZona);
router.patch("/invernadero/:id/modo", cambiarModo);

export default router;
