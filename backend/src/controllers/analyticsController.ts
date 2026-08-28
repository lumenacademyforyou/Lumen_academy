import { Request, Response, NextFunction } from "express";
import { pool } from "../../../db/shared/pool.js";
import { getDashboardAnalytics } from "../../../db/assess/analytics/dashboard.js";

// LA-APP-COMPLETION-001 Phase G (G1/G2) — replaces the old getAnalytics stub
// below, which had no real source at all (assess.attempt was empty and the
// prior mock's "latestProjectedRank"/"averageAccuracy" were hardcoded demo
// values). Real, auth-gated, SQL-aggregated per-user analytics — no
// client-side aggregation, nothing seeded. See db/assess/analytics/
// dashboard.ts for the query set and the "unattempted = no attempt_response
// row, or one whose is_correct stayed null" definition it uses throughout.
export const getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await getDashboardAnalytics(req.user!.appUserId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};

interface SyllabusNodeRow {
  tag_code: string;
  title: string;
  class_level: string | null;
  display_order: number | null;
  subject_code: string;
  subject_name: string;
}

// db/catalog-backed, real (non-mock). Shape is intentionally smaller than
// the old mock's SyllabusUnit — catalog.syllabus_node only has the columns
// SCHEMA_SPEC.md defines (tag_code, title, class_level, display_order); it
// has no weightageMarks/expectedQuestions/weightagePercent/subtopics/
// keyFormulas/overview/highYieldNCERTChapter/materials, none of which have a
// column anywhere in the schema (see db/scripts/seed/01_catalog.ts's header
// for why those were dropped, not invented, during Stage 1 seeding).
export const getSyllabus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await pool.query<SyllabusNodeRow>(
      `select sn.tag_code, sn.title, sn.class_level, sn.display_order, s.subject_code, s.subject_name
         from catalog.syllabus_node sn
         join catalog.subject s on s.subject_id = sn.subject_id
        order by s.display_order, sn.display_order`
    );
    const units = result.rows.map((row) => ({
      id: row.tag_code,
      subject: row.subject_code,
      subjectLabel: row.subject_name,
      ncertClass: row.class_level,
      unitName: row.title,
    }));
    res.json({ status: "success", units });
  } catch (err) {
    next(err);
  }
};
