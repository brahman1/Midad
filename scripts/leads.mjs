import "dotenv/config";
import { Pool } from "pg";
const db = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const r = await db.query(
    "SELECT name,email,school,message,created_at FROM inquiries ORDER BY created_at DESC LIMIT 100",
  );
  console.table(r.rows);
} finally {
  await db.end();
}
