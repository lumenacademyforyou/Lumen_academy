import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// Test-layer hardening E2 (docs/BUGS.md#E2, docs/test-layer-hardening-prompt.md).
// content.question.has_image used to be a plain boolean nothing in the real
// import path ever set — migration 028_has_image_computed.sql made it
// trigger-maintained instead (content.trg_asset_sync_has_image, fired on
// insert/delete/update of content.asset's question_id/target_role columns).
// This proves the trigger live, in a transaction rolled back at the end so
// no real content.question/content.asset row is permanently touched.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "content.asset insert/delete keeps content.question.has_image in sync via the trigger (E2)",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live content database" },
  async () => {
    const { pool } = await import("../shared/pool.js");
    const client = await pool.connect();
    try {
      await client.query("begin");

      const qRes = await client.query<{ question_id: string }>(`select question_id from content.question where has_image = false limit 1`);
      if (qRes.rowCount === 0) throw new Error("no has_image=false content.question row found to test with");
      const questionId = qRes.rows[0].question_id;

      const insertRes = await client.query<{ asset_id: string }>(
        `insert into content.asset (question_id, asset_type, target_role, storage_uri) values ($1, 'image', 'stem', 'test://e2-trigger-proof') returning asset_id`,
        [questionId]
      );
      const assetId = insertRes.rows[0].asset_id;

      const afterInsert = await client.query<{ has_image: boolean }>(`select has_image from content.question where question_id = $1`, [questionId]);
      assert.equal(afterInsert.rows[0].has_image, true, "inserting a stem-role asset did not flip has_image to true");

      // A solution-role asset must NOT count — matches envelope.ts's own
      // stem/option-only "does this render during the exam" definition, not
      // a stricter one invented for has_image alone.
      await client.query(
        `insert into content.asset (question_id, asset_type, target_role, storage_uri) values ($1, 'image', 'solution', 'test://e2-trigger-proof-solution')`,
        [questionId]
      );
      const afterSolutionInsert = await client.query<{ has_image: boolean }>(`select has_image from content.question where question_id = $1`, [questionId]);
      assert.equal(afterSolutionInsert.rows[0].has_image, true, "has_image should still be true (from the stem asset) after adding an unrelated solution-role asset");

      await client.query(`delete from content.asset where asset_id = $1`, [assetId]);
      const afterDelete = await client.query<{ has_image: boolean }>(`select has_image from content.question where question_id = $1`, [questionId]);
      assert.equal(afterDelete.rows[0].has_image, false, "deleting the only stem/option asset (a solution-role asset still remains) did not flip has_image back to false");
    } finally {
      await client.query("rollback");
      client.release();
      await pool.end();
    }
  }
);
