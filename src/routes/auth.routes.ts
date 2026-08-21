import { Router } from "express";
import {
  login,
  register,
  me,
  generarMFA,
  verificarMFA,
  desactivarMFA,
  validarLoginMFA,
} from "../controllers/auth.controller";

import { verificarToken, soloAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/register", verificarToken, soloAdmin, register);
router.get("/me", verificarToken, me);
router.post("/mfa/generar", verificarToken, generarMFA);
router.post("/mfa/verificar", verificarToken, verificarMFA);
router.post("/mfa/desactivar", verificarToken, desactivarMFA);
router.post("/mfa/validar-login", validarLoginMFA);

export default router;
