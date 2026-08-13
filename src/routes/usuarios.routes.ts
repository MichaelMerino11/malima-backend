import { Router } from "express";
import {
  listarUsuarios,
  actualizarUsuario,
  desactivarUsuario,
  actualizarPerfil,
  cambiarPassword,
  solicitarReset,
  restablecerPassword,
} from "../controllers/usuarios.controller";
import { verificarToken, soloAdmin } from "../middlewares/auth.middleware";

const router = Router();

// Públicos
router.post("/solicitar-reset", solicitarReset);
router.post("/restablecer-password", restablecerPassword);

// Autenticados
router.patch("/perfil", verificarToken, actualizarPerfil);
router.patch("/cambiar-password", verificarToken, cambiarPassword);

// Solo admin
router.get("/", verificarToken, soloAdmin, listarUsuarios);
router.patch("/:id", verificarToken, soloAdmin, actualizarUsuario);
router.delete("/:id", verificarToken, soloAdmin, desactivarUsuario);

export default router;
