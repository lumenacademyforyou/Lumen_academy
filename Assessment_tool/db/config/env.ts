import "dotenv/config";
import { z } from "zod";

/**
 * Boot-time config for the db/ layer, independent of backend/config.ts so
 * this layer (migrations, workers, repositories) can run without the
 * Express app. Fails loudly and lists every missing key — never falls back
 * to a default for a value that must come from the environment.
 *
 * Only DATABASE_URL and SUPABASE_URL are required at boot (db/shared/pool.ts).
 * REDIS_URL stays optional/unconsumed — no Redis-backed code exists yet.
 * OBJECT_STORAGE_BUCKET is schema-optional here (so importing this module
 * never fails boot on its own), but is genuinely required at runtime by
 * db/content/asset-resolver.ts (resolveAssetUrl/uploadAsset both throw
 * immediately if it's unset) — real, live image-bearing questions have
 * depended on it since Phase B3. Left schema-optional rather than required
 * so this file's own import doesn't gate every db/ script on Storage being
 * configured, not because it's actually unused.
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
