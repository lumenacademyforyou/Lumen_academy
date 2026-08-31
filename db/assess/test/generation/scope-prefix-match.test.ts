import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// Test-layer hardening F1 (docs/BUGS.md#F1, docs/AUDIT.md). assemble.ts's
// LINE_CANDIDATE_SQL/LINE_AVAILABLE_SQL scope a blueprint line's descendant
// match to `target.node_path || '/%'` (fixed from a bare `|| '%'`, which had
// no separator before the wildcard). catalog.syllabus_node.node_path is
// generated as '/' || node_code per level with no delimiter of its own, so
// the old pattern also matched a *sibling* node whose node_code happens to
// share target's as a prefix (e.g. target node_code 'U1' -> path '/PHY/U1'
// would wrongly also match a sibling 'U10' -> path '/PHY/U10').
//
// Building full prefix-colliding catalog.syllabus_node + content.question
// fixture rows for this would mean inserting temporary rows across several
// tables with many NOT NULL columns into a shared dev database purely to
// prove a two-character SQL wildcard change — real risk (schema drift,
// leftover rows, constraint mistakes) for no more precision than testing the
// actual LIKE semantics directly. This runs the exact same pattern
// construction assemble.ts's fixed query now uses, against literal path
// strings, through a real Postgres connection (not a hand-rolled
// reimplementation of LIKE) — the fix is entirely in this wildcard
// construction, so this is a faithful, zero-fixture regression test for it.
// assemble.test.ts's existing live-fixture suite already exercises the
// surrounding orchestration (pickCount, dedup, insufficient-pool, etc.)
// end-to-end; this file is deliberately narrower and only about the pattern.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "descendant-scope LIKE pattern: matches true descendants, excludes prefix-colliding siblings and the target itself",
  { skip: hasDb ? false : "DATABASE_URL not set — this test needs a live database connection" },
  async () => {
    const { pool } = await import("../../../shared/pool.js");
    try {
      const targetPath = "/PHY/U1";

      const candidates: Record<string, string> = {
        trueDescendantOneLevel: "/PHY/U1/CH2",
        trueDescendantTwoLevels: "/PHY/U1/CH2/TOPIC5",
        prefixCollidingSibling: "/PHY/U10",
        prefixCollidingSiblingDeeper: "/PHY/U10/CH1",
        unrelatedSibling: "/PHY/U2",
        targetItself: "/PHY/U1",
      };

      const res = await pool.query<{ label: string; path: string; matches: boolean }>(
        `select t.label, t.path, (t.path like ($1::text || '/%')) as matches
           from unnest($2::text[], $3::text[]) as t(label, path)`,
        [targetPath, Object.keys(candidates), Object.values(candidates)]
      );
      const byLabel = new Map(res.rows.map((r) => [r.label, r.matches]));

      assert.equal(byLabel.get("trueDescendantOneLevel"), true, "a genuine direct child path did not match the fixed descendant pattern");
      assert.equal(byLabel.get("trueDescendantTwoLevels"), true, "a genuine grandchild path did not match the fixed descendant pattern");
      assert.equal(
        byLabel.get("prefixCollidingSibling"),
        false,
        "F1 regression: a sibling whose node_code is target's code plus more digits (/PHY/U10 vs target /PHY/U1) incorrectly matched the descendant pattern"
      );
      assert.equal(
        byLabel.get("prefixCollidingSiblingDeeper"),
        false,
        "F1 regression: a descendant of the prefix-colliding sibling incorrectly matched target's descendant pattern"
      );
      assert.equal(byLabel.get("unrelatedSibling"), false, "an unrelated sibling node incorrectly matched the descendant pattern");
      // The target's own path is deliberately excluded by this pattern now —
      // assemble.ts's actual query still includes the target node itself via
      // its separate `qnm.node_id = $5::uuid` OR-branch, not this LIKE.
      assert.equal(byLabel.get("targetItself"), false, "the target's own path matched its own descendant-only pattern (should be excluded, handled by a separate exact-match branch)");

      // Sanity-check the OLD (buggy) pattern really did have this defect,
      // so this test is proven to be testing something real, not a
      // pattern that was never actually broken.
      const oldPatternRes = await pool.query<{ matches: boolean }>(`select ($1::text like ($2::text || '%')) as matches`, [
        candidates.prefixCollidingSibling,
        targetPath,
      ]);
      assert.equal(oldPatternRes.rows[0].matches, true, "sanity check failed: the pre-fix pattern was expected to (incorrectly) match the colliding sibling");
    } finally {
      await pool.end();
    }
  }
);
