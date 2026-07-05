import { Router } from "express";
import { login, register, me } from "../controllers/auth.controller";
import { verificarToken, soloAdmin } from "../middlewares/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/register", verificarToken, soloAdmin, register);
router.get("/me", verificarToken, me);

export default router;