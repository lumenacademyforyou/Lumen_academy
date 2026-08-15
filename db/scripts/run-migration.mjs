import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Runs one db/migrations/<name>.sql file followed by its matching
// db/verify/verify_<name>.sql, against DATABASE_URL. Exists because this
// environment doesn't have psql installed; uses the `pg` driver instead,
// which is already a project dependency (see backend/db.ts).
//
// Usage: node db/scripts/run-migration.mjs <migration-name-without-.sql>

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

const migration = process.argv[2];
if (!migration) {
  console.error("usage: node db/scripts/run-migration.mjs <migration-name-without-.sql>");
  process.exit(1);
}

const migrationPath = path.join(PROJECT_ROOT, "db/migrations", `${migration}.sql`);
const verifyPath = path.join(PROJECT_ROOT, "db/verify", `verify_${migration}.sql`);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in the environment");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes("sslmode=require") || databaseUrl.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

client.on("notice", (msg) => {
  console.log("NOTICE:", msg.message);
});

try {
  await client.connect();
  const versionRes = await client.query("select version();");
  console.log("Connected:", versionRes.rows[0].version);

  console.log(`\n--- running db/migrations/${migration}.sql ---`);
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await client.query(migrationSql);
  console.log(`migration ${migration} applied.`);

  console.log(`\n--- running db/verify/verify_${migration}.sql ---`);
  const verifySql = fs.readFileSync(verifyPath, "utf8");
  await client.query(verifySql);
  console.log(`verify_${migration} passed.`);
} catch (err) {
  console.error("FAILED:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
