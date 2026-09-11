import { pool } from "../shared/pool.js";

// BUG-18 (docs/assessment-tool-debug-plan.md Phase 6). The view/download
// code path (frontend CoursesView.tsx's iframe preview + downloadUnitMaterial's
// redirect, backend unitMaterialController.ts) is correct; live checks via a
// plain HTTP client with no Google session showed learn.unit_material rows
// redirect to accounts.google.com / return 401 instead of the file, meaning
// the Drive file isn't shared "Anyone with the link — Viewer". Re-run this
// after fixing sharing on the flagged files to confirm the fix, and again any
// time new materials are added.
//
// A false "blocked" here is possible for a signed-in-as-owner browser session
// (which would see the file fine) — this script has no Google session at
// all, so it reproduces exactly what an anonymous/other-account viewer (i.e.
// every real student) would hit, which is the actual bug report.

interface Row {
  id: string;
  title: string;
  drive_file_id: string;
  tag_code: string;
}

const { rows } = await pool.query<Row>(`
  select m.id, m.title, m.drive_file_id, sn.tag_code
  from learn.unit_material m
  join catalog.syllabus_node sn on sn.node_id = m.unit_id
  where m.is_active
  order by sn.tag_code, m.sort_order
`);

const blocked: Row[] = [];
const ok: Row[] = [];

for (const row of rows) {
  const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(row.drive_file_id)}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    let isBlocked = res.status === 401 || res.status === 403;
    let hop = res.headers.get("location") ?? "";
    let hops = 0;
    while (!isBlocked && hop && hops < 5) {
      if (hop.includes("accounts.google.com")) {
        isBlocked = true;
        break;
      }
      const hopRes = await fetch(hop, { redirect: "manual" });
      if (hopRes.status === 401 || hopRes.status === 403) {
        isBlocked = true;
        break;
      }
      hop = hopRes.headers.get("location") ?? "";
      hops++;
    }
    (isBlocked ? blocked : ok).push(row);
  } catch {
    blocked.push(row);
  }
}

console.log(`Checked ${rows.length} active materials.`);
console.log(`OK (publicly accessible): ${ok.length}`);
console.log(`BLOCKED (needs "Anyone with the link" sharing fixed in Drive): ${blocked.length}`);
if (blocked.length > 0) {
  console.log("\nBlocked rows (fix sharing on these drive_file_id values, then re-run this script):");
  for (const r of blocked) {
    console.log(`  [${r.tag_code}] ${r.title} — drive_file_id=${r.drive_file_id}`);
  }
}

await pool.end();
