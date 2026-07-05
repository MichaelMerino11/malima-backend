import { Pool } from "pg";

const pool = new Pool({
  host: "aws-1-us-west-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  user: "postgres.msthwugxxwrobndtscix",
  password: "2ShNalZwzjLTQ654",
  ssl: { rejectUnauthorized: false },
});

pool
  .query("SELECT NOW()")
  .then(() => console.log("🗄️  Base de datos conectada"))
  .catch((err) => console.error("❌ Error conectando a DB:", err.message));

export default pool;
