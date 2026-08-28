import { apiFetch } from "./api";
import type { CatalogTree } from "../types";

// GET /api/catalog/tree (backend/src/controllers/catalogTreeController.ts,
// LA-APP-COMPLETION-001 Phase D). Subject -> unit tree with real uuids and
// live published-question counts — the one source of truth for the test
// directory, subject drill-down, and custom builder (D3/D4/D6). No auth
// required (read-open, same as GET /questions).
export async function getCatalogTree(): Promise<CatalogTree> {
  const res = await apiFetch<{ data: CatalogTree }>("/catalog/tree");
  return res.data;
}
