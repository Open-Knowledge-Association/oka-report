import { Hono } from "hono";
import { prisma } from "@repo/db";
import "dotenv/config";
const app = new Hono();

// --- Tambahkan Log Ini ---
console.log("------------------------------------------------");
console.log("🔍 CEK ENV VARS:");
console.log("DATABASE_URL:", Bun.env.DATABASE_URL ? "✅ Terbaca" : "❌ Kosong");
// Kalau mau lihat isinya (Hati-hati, jangan dicommit):
// console.log("Isi URL:", Bun.env.DATABASE_URL)
console.log("------------------------------------------------");
// -------------------------

app.get("/", (c) => {
  return c.json({
    message: "Hello Hono!",
    db_status: Bun.env.DATABASE_URL,
  });
});

export default app;
