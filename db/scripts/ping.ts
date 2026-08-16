import { pool } from "../shared/pool.js";

// STAGE 0 diagnostic: lists the 5 domain schemas and a row count per table.
// Uses db/shared/pool.ts (direct Postgres), not the Supabase JS client —
// these schemas aren't exposed to PostgREST (see CLAUDE.md), so a REST-based
// admin client couldn't see them anyway.
// Usage: npx tsx db/scripts/ping.ts

const SCHEMAS = ["catalog", "core", "content", "assess", "learn"];

async function main() {
  const versionRes = await pool.query("select version()");
  console.log("Connected:", versionRes.rows[0].version);
  console.log();

  const tablesRes = await pool.query<{ table_schema: string; table_name: string }>(
    `select table_schema, table_name
       from information_schema.tables
      where table_schema = any($1)
      order by table_schema, table_name`,
    [SCHEMAS]
  );

  let totalTables = 0;
  let totalRows = 0;
  let currentSchema = "";

  for (const { table_schema, table_name } of tablesRes.rows) {
    if (table_schema !== currentSchema) {
      currentSchema = table_schema;
      console.log(`\n${currentSchema}`);
    }
    const countRes = await pool.query(`select count(*)::int as n from ${table_schema}.${table_name}`);
    const n = countRes.rows[0].n;
    console.log(`  ${table_name.padEnd(28)} ${n}`);
    totalTables++;
    totalRows += n;
  }

  console.log(`\n${totalTables} tables across ${SCHEMAS.length} schemas, ${totalRows} total rows.`);
  await pool.end();
}

main().catch((err) => {
  console.error("ping failed:", err);
  process.exitCode = 1;
});
