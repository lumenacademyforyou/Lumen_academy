import { apiFetch } from "./api";
import type { CatalogTree } from "../types";

// GET /api/catalog/tree (backend/src/controllers/catalogTreeController.ts,
// LA-APP-COMPLETION-001 Phase D). Subject -> unit tree with real uuids and
// live published-question counts — the one source of truth for the test
// directory, subject drill-down, and custom builder (D3/D4/D6). Still
// read-open. (GET /api/questions, which this used to cite as the precedent
// for that, is no longer open — it now requires a token and pages its
// results, because it returned the whole question bank in one anonymous
// call. This route returns the syllabus structure plus counts, not question
// content, so it stays public.)
export async function getCatalogTree(): Promise<CatalogTree> {
  const res = await apiFetch<{ data: CatalogTree }>("/catalog/tree");
  return res.data;
}
