import { pool } from "../../shared/pool.js";

// One-off verification that C5's section-order shuffle actually fires
// through the real HTTP controller (backend/src/controllers/sessionController.ts),
// not just the DB layer prove-c1-sessions.ts exercises directly (which
// bypasses sessionController.ts's toLines()/shuffled() entirely, since it
// calls createPracticeTest directly).

async function main() {
  const userRes = await pool.query<{ user_id: string }>(
    `select user_id from core.app_user where email = 'lumenacademyforyou@gmail.com'`
  );
  const userId = userRes.rows[0].user_id;

  const { createSession } = await import("../../../backend/src/controllers/sessionController.js");

  const orders: string[] = [];
  for (let i = 0; i < 5; i++) {
    const req = { body: { mode: "full-mock" }, user: { appUserId: userId } } as any;
    const result = await new Promise<any>((resolve, reject) => {
      const res = { status: () => res, json: (body: any) => resolve(body) } as any;
      createSession(req, res, reject as any).catch(reject);
    });
    const order = result.data.sections.map((s: any) => s.sectionName).join(",");
    orders.push(order);
    console.log(`run ${i + 1}: ${order}`);
  }

  const distinct = new Set(orders).size;
  console.log(`\n${distinct} distinct section orderings out of 5 runs (expect > 1)`);
  await pool.end();
}

main().catch((err) => {
  console.error("verify-c5-shuffle failed:", err);
  process.exitCode = 1;
});
