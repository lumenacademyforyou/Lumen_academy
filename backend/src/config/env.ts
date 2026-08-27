import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Same project the frontend points VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
  // at. The publishable key is public by design (Supabase's newer name for the
  // anon key) — safe to reuse here. The backend verifies tokens by asking
  // Supabase's Auth API directly (auth.getUser), so it never needs a signing
  // secret, regardless of whether the project uses legacy HS256 or newer
  // asymmetric signing keys.
  SUPABASE_URL: z.string().min(1, "SUPABASE_URL is required"),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "SUPABASE_PUBLISHABLE_KEY is required"),
  // Server-only, elevated privileges (bypasses RLS, can call the Auth Admin
  // API). Optional at boot — only admin scripts (backend/supabaseAdmin.ts)
  // need it, not normal request serving. Never expose to the frontend/Vite
  // bundle (only VITE_-prefixed vars reach the client; this one deliberately
  // isn't).
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  AI_PROVIDER: z.enum(["mock", "openrouter"]).default("mock"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = Object.freeze({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  supabaseUrl: env.SUPABASE_URL,
  supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  corsOrigins: env.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
  logLevel: env.LOG_LEVEL,
  aiProvider: env.AI_PROVIDER,
  openrouterApiKey: env.OPENROUTER_API_KEY,
  openrouterModel: env.OPENROUTER_MODEL,
});
