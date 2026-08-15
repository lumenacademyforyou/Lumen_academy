import { Pool } from "pg";
import { dbConfig } from "../config/env.js";

// One pool for the whole db/ layer. Session-mode connection (port 5432, per
// SETUP.md) — safe for both DDL (migrations) and normal query traffic.
export const pool = new Pool({
  connectionString: dbConfig.databaseUrl,
  ssl: dbConfig.databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});
