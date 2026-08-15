import "dotenv/config";
import { z } from "zod";

/**
 * Boot-time config for the db/ layer, independent of backend/config.ts so
 * this layer (migrations, workers, repositories) can run without the
 * Express app. Fails loudly and lists every missing key — never falls back
 * to a default for a value that must come from the environment.
 *
 * Only DATABASE_URL and SUPABASE_URL are required: they're the only ones any
 * code in db/ actually reads today (db/shared/pool.ts). The rest
 * (SUPABASE_SERVICE_ROLE_KEY, REDIS_URL, OBJECT_STORAGE_BUCKET) are declared
 * but optional until Storage/Redis-backed code exists to consume them —
 * requiring them earlier just blocks the repository layer on unrelated
 * features. Move a key to required when something starts reading it.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SUPABASE_URL: z.string().min(1, "SUPABASE_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  OBJECT_STORAGE_BUCKET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid db/ environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const dbConfig = Object.freeze({
  databaseUrl: env.DATABASE_URL,
  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  redisUrl: env.REDIS_URL,
  objectStorageBucket: env.OBJECT_STORAGE_BUCKET,
});
