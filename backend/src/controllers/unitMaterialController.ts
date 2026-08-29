import { NextFunction, Request, Response } from "express";
import { pool } from "../../../db/shared/pool.js";
import { unitMaterialRepository } from "../../../db/learn/unit_material/unit_material.repository.js";

// docs/neet-tool-fix-prompt.md Task 4 — real Drive-file materials mapped to
// catalog units (learn.unit_material, seeded by db/scripts/seed/05_unit_materials.ts
// from db/books/I20_23_Resource_Library_Book_List_REAL.md). Both routes sit
// behind requireAuth (learn.routes.ts), same as the rest of the
// student-facing app — a student must already be signed in to reach the
// syllabus/materials page these serve.

export async function listUnitMaterials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await unitMaterialRepository.findByUnit(req.params.unitId) });
  } catch (err) {
    next(err);
  }
}

/**
 * Task 4c — "materials render grouped under their unit" across possibly many
 * units in one page (e.g. a whole-subject syllabus view), keyed by the
 * catalog tag_code the frontend already has from GET /catalog/tree — avoids
 * one round trip per unit.
 */
export async function listUnitMaterialsByTagCodes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = req.query.unitTagCodes;
    const tagCodes = (Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : []).map(String).filter(Boolean);
    res.json({ data: tagCodes.length > 0 ? await unitMaterialRepository.findByUnitTagCodes(tagCodes) : [] });
  } catch (err) {
    next(err);
  }
}

/**
 * Task 4c — "our own Download button... hitting a backend endpoint we
 * control... authenticated and, ideally, logged per user." Redirects to
 * Drive's direct-download form rather than proxying the bytes (the same
 * lower-effort tradeoff Task 4b's own text names for the viewer) — this is
 * the one place a Drive URL is ever built from a stored file id, so nothing
 * else in the app string-concatenates a Drive link.
 */
export async function downloadUnitMaterial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const material = await unitMaterialRepository.findById(req.params.materialId);
    await pool.query(
      // actor_type: learn.audit_log's ck_audit_log_actor_type only allows
      // 'user' | 'system' | null (db/migrations/012_domain_checks.sql) —
      // not an arbitrary role name.
      `insert into learn.audit_log (actor_user_id, actor_type, action_name, entity_name, entity_key, occurred_at)
       values ($1, 'user', 'material_download', 'learn.unit_material', $2, now())`,
      [req.user!.appUserId, material.id]
    );
    res.redirect(`https://drive.google.com/uc?export=download&id=${encodeURIComponent(material.drive_file_id)}`);
  } catch (err) {
    next(err);
  }
}
