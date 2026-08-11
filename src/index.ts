import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron";
import zonasRoutes from "./routes/zonas.routes";
import authRoutes from "./routes/auth.routes";
import tinkerRoutes from "./routes/tinker.routes";
import controlRoutes from "./routes/control.routes";
import automatizacionRoutes from "./routes/automatizacion.routes";
import configuracionRoutes from "./routes/configuracion.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/api/tinker", tinkerRoutes);
app.use("/api/control", controlRoutes);
app.use("/api/automatizacion", automatizacionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/zonas", zonasRoutes);
app.use("/api/configuracion", configuracionRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", project: "Malima Backend", version: "1.0.0" });
});

import pool from "./config/db";

pool
  .query("SELECT NOW()")
  .then(() => console.log("🗄️  Base de datos conectada"))
  .catch((err) => console.error("❌ Error conectando a DB:", err.message));

// DESACTIVADO — la lógica automática la maneja el PLC, no el backend
// cron.schedule('*/5 * * * *', async () => {
//   console.log('🤖 Evaluando zonas automáticamente...');
//   try {
//     await fetch(`http://localhost:${PORT}/api/automatizacion/evaluar-todas`, {
//       method: 'POST'
//     });
//   } catch (error) {
//     console.error('Error en cron de automatización:', error);
//   }
// });

app.listen(PORT, () => {
  console.log(`🌿 Malima Backend corriendo en puerto ${PORT}`);
});
