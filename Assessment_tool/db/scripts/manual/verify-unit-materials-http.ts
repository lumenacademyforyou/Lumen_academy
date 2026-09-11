import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";

// docs/neet-tool-fix-prompt.md Task 4 — one-off HTTP smoke test for the new
// learn/unit-materials endpoints, against the real running server (same
// demo-account convention as verify-phase-d-http-flow.ts).

const BASE = "http://localhost:4000/api";
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const DEMO_EMAIL = "demo.student@lumenacademy.dev";
const DEMO_PASSWORD = "Demo-Student-Session-2026";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let { data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error?.message === "Email not confirmed") {
    const admin = getSupabaseAdmin();
    const { data: list } = await admin.auth.admin.listUsers();
    const user = list.users.find((u: { email?: string }) => u.email === DEMO_EMAIL);
    if (user) await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    ({ data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD }));
  }
  if (error || !data?.session) throw new Error(`sign-in failed: ${error?.message}`);
  const token = data.session.access_token;
  const headers = { Authorization: `Bearer ${token}` };
  console.log("signed in as demo account\n");

  // 1. list-by-tag-codes, unauthenticated -> expect 401
  const noAuthRes = await fetch(`${BASE}/learn/unit-materials/by-tag-codes?unitTagCodes=phy_01`);
  console.log(`GET by-tag-codes (no auth): ${noAuthRes.status} (expect 401)`);

  // 2. list-by-tag-codes, authenticated, real unit with materials
  const listRes = await fetch(`${BASE}/learn/unit-materials/by-tag-codes?unitTagCodes=phy_01,chem_08`, { headers });
  const listBody = await listRes.json();
  console.log(`GET by-tag-codes (phy_01,chem_08): ${listRes.status}, ${listBody.data?.length ?? 0} material(s)`);
  console.log(listBody.data?.map((m: { unit_tag_code: string; title: string; drive_file_id: string }) => `  ${m.unit_tag_code}  ${m.title}  (${m.drive_file_id})`).join("\n"));

  // 3. list-by-unitId (real node_id) for one unit
  const unitIdRes = await fetch(`${BASE}/catalog/tree`);
  const tree = await unitIdRes.json();
  const phy01 = tree.data?.subjects?.flatMap((s: { units: { tagCode: string; nodeId: string }[] }) => s.units).find((u: { tagCode: string }) => u.tagCode === "phy_01");
  if (!phy01) throw new Error("phy_01 not found in /catalog/tree — cannot test /unit/:unitId");
  const byUnitRes = await fetch(`${BASE}/learn/unit-materials/unit/${phy01.nodeId}`, { headers });
  const byUnitBody = await byUnitRes.json();
  console.log(`\nGET /unit/${phy01.nodeId} (phy_01): ${byUnitRes.status}, ${byUnitBody.data?.length ?? 0} material(s)`);

  // 4. download redirect for the first material found
  const firstMaterial = listBody.data?.[0];
  if (firstMaterial) {
    const downloadRes = await fetch(`${BASE}/learn/unit-materials/${firstMaterial.id}/download`, { headers, redirect: "manual" });
    console.log(`\nGET /unit-materials/${firstMaterial.id}/download: ${downloadRes.status} (expect 302), Location: ${downloadRes.headers.get("location")}`);
  }

  // 5. an empty/no-materials unit should return an empty array, not an error
  const emptyRes = await fetch(`${BASE}/learn/unit-materials/by-tag-codes?unitTagCodes=nonexistent_unit`, { headers });
  const emptyBody = await emptyRes.json();
  console.log(`\nGET by-tag-codes (nonexistent_unit): ${emptyRes.status}, ${emptyBody.data?.length ?? 0} material(s) (expect 0, not an error)`);
}

main().catch((err) => {
  console.error("verify-unit-materials-http failed:", err);
  process.exitCode = 1;
});
