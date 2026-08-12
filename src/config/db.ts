import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool
  .query("SELECT NOW()")
  .then(() => console.log("🗄️  Base de datos conectada"))
  .catch((err) => console.error("❌ Error conectando a DB:", err.message));

export default pool;
