import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";

// Phase F5 (LA-APP-COMPLETION-001) — the automated version of Phase E's
// manual verification (db/scripts/manual/verify-phase-e-session.ts), which
// exercises this same logic over real HTTP against a running server. This
// test calls session.service.ts's functions directly against the live DB
// instead — no server process needed, so it's fast and CI-friendly; the
// manual script remains the one place that also proves the HTTP wiring
// (requireAuth.ts, authSessionController.ts) is correct end to end.
// Same DATABASE_URL-skip convention as questionController.test.ts.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "session.service: idle/absolute expiry, revocation, and per-activity touch semantics",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live core.app_user/core.user_session database" },
  async (t) => {
    const { pool } = await import("../../../db/shared/pool.js");
    const { checkAndTouchOnAuth, touchActivity, revokeSession } = await import("./session.service.js");
    const { AppError } = await import("../middleware/errorHandler.js");

    try {
      const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user limit 1`);
      if (userRes.rowCount === 0) throw new Error("no core.app_user row — needed to own the session rows this test creates");
      const userId = userRes.rows[0].user_id;

      await t.test("first sight of a session_id lazily creates the row", async () => {
        const sessionId = crypto.randomUUID();
        const info = await checkAndTouchOnAuth(sessionId, userId);
        assert.equal(info.sessionId, sessionId);
        assert.equal(info.idleTimeoutMs, 30 * 60 * 1000);
        const row = await pool.query<{ user_id: string; revoked_at: string | null }>(`select user_id, revoked_at from core.user_session where session_id = $1`, [sessionId]);
        assert.equal(row.rowCount, 1);
        assert.equal(row.rows[0].user_id, userId);
        assert.equal(row.rows[0].revoked_at, null);
      });

      await t.test("a passing check does not touch last_activity_at (only touchActivity does)", async () => {
        const sessionId = crypto.randomUUID();
        await checkAndTouchOnAuth(sessionId, userId);
        const before = (await pool.query<{ last_activity_at: Date }>(`select last_activity_at from core.user_session where session_id = $1`, [sessionId])).rows[0].last_activity_at;
        await new Promise((r) => setTimeout(r, 1100));
        await checkAndTouchOnAuth(sessionId, userId);
        const after = (await pool.query<{ last_activity_at: Date }>(`select last_activity_at from core.user_session where session_id = $1`, [sessionId])).rows[0].last_activity_at;
        assert.equal(before.getTime(), after.getTime(), "checkAndTouchOnAuth must not extend the idle timer on a passing check");

        await touchActivity(sessionId);
        const afterHeartbeat = (await pool.query<{ last_activity_at: Date }>(`select last_activity_at from core.user_session where session_id = $1`, [sessionId])).rows[0].last_activity_at;
        assert.ok(afterHeartbeat.getTime() > after.getTime(), "touchActivity must extend the idle timer");
      });

      await t.test("a session past its idle timeout is rejected and marked revoked server-side", async () => {
        const sessionId = crypto.randomUUID();
        await checkAndTouchOnAuth(sessionId, userId);
        await pool.query(`update core.user_session set last_activity_at = now() - interval '31 minutes' where session_id = $1`, [sessionId]);

        await assert.rejects(
          () => checkAndTouchOnAuth(sessionId, userId),
          (err: unknown) => {
            assert.ok(err instanceof AppError);
            assert.equal((err as InstanceType<typeof AppError>).statusCode, 401);
            assert.equal((err as InstanceType<typeof AppError>).code, "SESSION_EXPIRED");
            return true;
          }
        );
        const row = await pool.query<{ revoked_at: string | null; revoked_reason: string | null }>(`select revoked_at, revoked_reason from core.user_session where session_id = $1`, [sessionId]);
        assert.ok(row.rows[0].revoked_at, "row must be marked revoked at the moment the idle limit is detected, not just rejected in-memory");
        assert.equal(row.rows[0].revoked_reason, "idle_timeout");

        // Stays revoked — does not silently self-heal on a later check.
        await assert.rejects(() => checkAndTouchOnAuth(sessionId, userId));
      });

      await t.test("a session past its absolute cap is rejected with a distinct reason", async () => {
        const sessionId = crypto.randomUUID();
        await checkAndTouchOnAuth(sessionId, userId);
        await pool.query(`update core.user_session set absolute_expires_at = now() - interval '1 second' where session_id = $1`, [sessionId]);

        await assert.rejects(
          () => checkAndTouchOnAuth(sessionId, userId),
          (err: unknown) => {
            assert.ok(err instanceof AppError);
            assert.equal((err as InstanceType<typeof AppError>).code, "SESSION_EXPIRED");
            return true;
          }
        );
        const row = await pool.query<{ revoked_reason: string | null }>(`select revoked_reason from core.user_session where session_id = $1`, [sessionId]);
        assert.equal(row.rows[0].revoked_reason, "absolute_timeout");
      });

      await t.test("explicit revokeSession rejects immediately, independent of idle/absolute timing", async () => {
        const sessionId = crypto.randomUUID();
        await checkAndTouchOnAuth(sessionId, userId);
        await revokeSession(sessionId, "user_logout");
        const row = await pool.query<{ revoked_reason: string | null }>(`select revoked_reason from core.user_session where session_id = $1`, [sessionId]);
        assert.equal(row.rows[0].revoked_reason, "user_logout");
        await assert.rejects(() => checkAndTouchOnAuth(sessionId, userId));
      });

      await t.test("two different session_ids for the same user are tracked and revoked independently", async () => {
        const sessionA = crypto.randomUUID();
        const sessionB = crypto.randomUUID();
        await checkAndTouchOnAuth(sessionA, userId);
        await checkAndTouchOnAuth(sessionB, userId);
        await revokeSession(sessionA, "user_logout");

        await assert.rejects(() => checkAndTouchOnAuth(sessionA, userId));
        const infoB = await checkAndTouchOnAuth(sessionB, userId);
        assert.equal(infoB.sessionId, sessionB, "revoking one login must not affect a different login for the same user");
      });
    } finally {
      await pool.end();
    }
  }
);
