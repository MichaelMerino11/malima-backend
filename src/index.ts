import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import tinkerRoutes from './routes/tinker.routes';
import controlRoutes from './routes/control.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api/tinker', tinkerRoutes);
app.use('/api/control', controlRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", project: "Malima Backend", version: "1.0.0" });
});

import pool from "./config/db";

pool
  .query("SELECT NOW()")
  .then(() => console.log("🗄️  Base de datos conectada"))
  .catch((err) => console.error("❌ Error conectando a DB:", err.message));

app.listen(PORT, () => {
  console.log(`🌿 Malima Backend corriendo en puerto ${PORT}`);
});
