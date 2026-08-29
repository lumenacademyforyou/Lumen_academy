import { Pool } from "pg";
import { dbConfig } from "../config/env.js";

// One pool for the whole db/ layer. Session-mode connection (port 5432, per
// SETUP.md) — safe for both DDL (migrations) and normal query traffic.
//
// Supabase's session-mode pooler caps the whole project at pool_size: 15
// connections (EMAXCONNSESSION if exceeded). `max` here is deliberately well
// under that — both this pool and Prisma's separate pool (backend/src/lib/db.ts)
// draw from the same 15-connection budget, and `tsx watch` restarts the
// server on every save, so a generous per-process max exhausts the pooler
// after a handful of restarts. Paired with server.ts's graceful shutdown,
// which calls pool.end() so restarts release connections instead of leaking
// them until the pooler notices the socket died.
export const pool = new Pool({
  connectionString: dbConfig.databaseUrl,
  ssl: dbConfig.databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
  max: 4,
  idleTimeoutMillis: 10_000,
});
