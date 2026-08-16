import { pool } from "../shared/pool.js";

// Ad-hoc SQL runner for checking table rows/data from the terminal, since
// psql isn't installed in this environment. Uses the same DATABASE_URL /
// pool as every other db/ script.
//
// Usage:
//   npx tsx db/scripts/query.ts "select * from catalog.exam limit 5"
//   npx tsx db/scripts/query.ts "select count(*) from content.question"

const sql = process.argv[2];
if (!sql) {
  console.error('usage: npx tsx db/scripts/query.ts "<sql>"');
  process.exit(1);
}

pool
  .query(sql)
  .then((res) => {
    if (res.rows.length === 0) {
      console.log("(0 rows)");
    } else {
      console.table(res.rows);
      console.log(`(${res.rows.length} row${res.rows.length === 1 ? "" : "s"})`);
    }
  })
  .catch((err) => {
    console.error("query failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
