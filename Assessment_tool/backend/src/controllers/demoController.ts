import type { Request, Response, NextFunction } from "express";
import { pool } from "../../../db/shared/pool.js";
import { wipeUserOwnedData } from "../../../db/shared/wipe-user-data.js";
import { DEMO_EMAIL } from "../../../db/shared/demoAccount.js";

// BUG-02 (docs/assessment-tool-debug-plan.md) — "keep a demo user but do not
// store any data in it... must be fresh... automatically delete the data
// whenever completing a task." Recon (CONTEXT.md §2/§9) found the demo
// account is one single shared identity with no per-login isolation, and
// that leftover in_progress/paused attempts from an earlier demo session get
// auto-resumed by the very next login (App.tsx's getActiveSession effect) —
// that IS the reported "ghost test"/stale-data behavior for this account.
//
// Implements Option B from the plan (delete-on-login) rather than Option A
// (an ephemeral demo_session_id column added to every user-owned table, with
// a matching filter added to every existing read path). Option A is the
// plan's own "recommended" choice, but only because it anticipates *many
// concurrent* demo users; this account is a single low-traffic
// marketing/eval login, so Option B's stated downside (a slower login, a
// race if two people click "Quick Demo" at the exact same instant) is a
// reasonable trade for reusing BUG-01's existing wipe routine instead of a
// schema change touching dozens of files. Flagged explicitly, not guessed
// silently: this supersedes docs/ASSESSMENT_FIX_TRACKER.md item 6's earlier
// decision to keep 5 realistic pre-seeded scored attempts on this account for
// a polished first look — the two are in direct tension, and this is the
// more recent, explicit ask. db/scripts/demo/seed-demo-account.ts still works
// if a polished demo dataset is wanted again for a screenshot or walkthrough;
// it will simply be cleared again on the next real "Quick Demo" login.
export async function resetDemoAccountData(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query<{ email: string }>(`select email from core.app_user where user_id = $1`, [req.user!.appUserId]);
    const email = result.rows[0]?.email;
    if (email !== DEMO_EMAIL) {
      // Only ever called right after the frontend's "Quick Demo" flow signs
      // in — a real user's token hitting this by mistake must be a safe
      // no-op, not a 403 that could ever be user-visible.
      res.status(204).send();
      return;
    }
    const { counts } = await wipeUserOwnedData(pool, { userId: req.user!.appUserId });
    res.status(200).json({ reset: true, counts });
  } catch (err) {
    next(err);
  }
}
