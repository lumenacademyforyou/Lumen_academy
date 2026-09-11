import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../../shared/pool.js";
import { uploadAsset, resolveAssetUrl } from "../../content/asset-resolver.js";

// CL-3 proof (LA-PLAN-002 Day 1, G4) — uploads one of batch-2's real diagram
// images against a real, already-live content.question row (one of the 20
// legacy fixture questions TE-P3 restored), then confirms resolveAssetUrl
// returns a URL that actually opens. No fabricated data: real file, real
// question row, real HTTP fetch of the result.

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const IMAGE_PATH = path.resolve(REPO_ROOT, "db", "content", "content-batches", "assets", "batch-2", "CHE_SOMBAS_DIAG_0001.png");

async function main() {
  const qRes = await pool.query<{ question_id: string; question_uid: string }>(
    `select question_id, question_uid from content.question order by question_id limit 1`
  );
  if (qRes.rowCount === 0) throw new Error("no live content.question row to attach the proof asset to");
  const { question_id: questionId, question_uid: questionUid } = qRes.rows[0];
  console.log(`using real live question: ${questionUid} (${questionId})`);

  const asset = await uploadAsset({
    localFilePath: IMAGE_PATH,
    questionId,
    targetRole: "stem",
    assetType: "diagram",
    altText: "CL-3 proof upload — batch-2 chemistry diagram",
  });
  console.log("content.asset row:", asset);

  const url = resolveAssetUrl(asset.storage_uri);
  console.log("resolved URL:", url);

  const res = await fetch(url);
  console.log(`GET ${url} -> ${res.status} ${res.headers.get("content-type")}`);
  if (!res.ok) throw new Error(`resolved URL did not open: HTTP ${res.status}`);

  console.log("\nCL-3 PASS — asset uploaded, content.asset row landed, resolved URL opens.");
  await pool.end();
}

main().catch((err) => {
  console.error("CL-3 proof failed:", err);
  process.exitCode = 1;
});
