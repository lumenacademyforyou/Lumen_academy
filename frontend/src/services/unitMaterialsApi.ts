import { apiFetch } from "./api.js";
import { supabase } from "./supabase.js";

// docs/neet-tool-fix-prompt.md Task 4 — real Drive-backed syllabus
// materials, replacing data/syllabusData.ts's DEFAULT_MATERIALS (the same
// fabricated 4-entry array reused verbatim on every one of the 38 units,
// with a fake in-app "preview" and a download button that only ever showed
// an alert() — confirmed by grep before writing this, not assumed).

export interface UnitMaterial {
  id: string;
  unit_id: string;
  title: string;
  drive_file_id: string;
  mime_type: string;
  sort_order: number;
  is_active: boolean;
  unit_tag_code?: string;
}

export function getUnitMaterials(unitId: string): Promise<{ data: UnitMaterial[] }> {
  return apiFetch<{ data: UnitMaterial[] }>(`/learn/unit-materials/unit/${unitId}`);
}

export function getUnitMaterialsByTagCodes(unitTagCodes: string[]): Promise<{ data: UnitMaterial[] }> {
  const qs = new URLSearchParams({ unitTagCodes: unitTagCodes.join(",") });
  return apiFetch<{ data: UnitMaterial[] }>(`/learn/unit-materials/by-tag-codes?${qs.toString()}`);
}

export function driveEmbedUrl(material: Pick<UnitMaterial, "drive_file_id">): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(material.drive_file_id)}/preview`;
}

const BASE_URL: string = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

/**
 * Task 4c — "our own Download button... hitting a backend endpoint we
 * control." apiFetch always parses JSON, so this bypasses it: fetch the
 * authenticated redirect endpoint directly (the browser follows the 302 to
 * Drive's real file bytes — the Authorization header is not forwarded across
 * that cross-origin hop, by the fetch spec itself, so the bearer token never
 * reaches Google), pull the response down as a Blob, and save it via a
 * synthetic <a download> click — the standard pattern for a browser download
 * that has to be authenticated first.
 */
export async function downloadUnitMaterial(material: Pick<UnitMaterial, "id" | "title">): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${BASE_URL}/learn/unit-materials/${material.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${material.title.replace(/[^\w\s-]/g, "").trim() || "material"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
