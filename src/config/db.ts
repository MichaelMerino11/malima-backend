import { Pool } from "pg";

const pool = new Pool({
  host: "aws-1-us-east-2.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: "postgres.dnfekqqeahcbdmjawbat",
  password: "NmZVKjz8a0OtDZU5",
  ssl: { rejectUnauthorized: false },
});

pool
  .query("SELECT NOW()")
  .then(() => console.log("🗄️  Base de datos conectada"))
  .catch((err) => console.error("❌ Error conectando a DB:", err.message));

export default pool;
