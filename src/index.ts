import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import pool from "./config/db";

dotenv.config();

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
  },
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rutas
import tinkerRoutes from "./routes/tinker.routes";
import controlRoutes from "./routes/control.routes";
import automatizacionRoutes from "./routes/automatizacion.routes";
import authRoutes from "./routes/auth.routes";
import zonasRoutes from "./routes/zonas.routes";
import configuracionRoutes from "./routes/configuracion.routes";
import usuariosRoutes from "./routes/usuarios.routes";
import meteorologiaRoutes from "./routes/meteorologia.routes";

app.use("/api/tinker", tinkerRoutes);
app.use("/api/control", controlRoutes);
app.use("/api/automatizacion", automatizacionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/zonas", zonasRoutes);
app.use("/api/configuracion", configuracionRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/meteorologia", meteorologiaRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", project: "Malima Backend", version: "1.0.0" });
});

// WebSocket
io.on("connection", (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id}`);

  socket.on("join-zona", (zona_id: number) => {
    socket.join(`zona-${zona_id}`);
    console.log(`📡 Cliente ${socket.id} unido a zona-${zona_id}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });
});

// Verificar conexión a DB
pool
  .query("SELECT NOW()")
  .then(() => console.log("🗄️  Base de datos conectada"))
  .catch((err) => console.error("❌ Error conectando a DB:", err.message));

httpServer.listen(PORT, () => {
  console.log(`🌿 Malima Backend corriendo en puerto ${PORT}`);
});