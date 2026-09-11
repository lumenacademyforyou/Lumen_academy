// measure-raw-query-latency.ts — one-off diagnostic (Phase H follow-up):
// establishes the baseline per-round-trip latency to the live remote
// database from this environment, to judge whether a query-count reduction
// (like batching attempt_question's inserts) can meaningfully help, or
// whether raw network RTT dominates regardless of query count.
import "dotenv/config";
import { pool } from "../../shared/pool.js";

async function main() {
  const n = 10;
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const t0 = Date.now();
    await pool.query("select 1");
    times.push(Date.now() - t0);
  }
  console.log(`${n} sequential trivial "select 1" round trips: ${times.join(", ")}ms`);
  console.log(`avg=${Math.round(times.reduce((a, b) => a + b, 0) / n)}ms, min=${Math.min(...times)}ms, max=${Math.max(...times)}ms`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
