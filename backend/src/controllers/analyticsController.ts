import { Request, Response, NextFunction } from "express";
import { pool } from "../../../db/shared/pool.js";

// getAnalytics: no real source anymore. assess.attempt is empty (no real
// attempts exist yet), and the old mock's "latestProjectedRank": "AIR 140" /
// "averageAccuracy": "88%" were hardcoded demo values, not derived from
// INITIAL_ATTEMPTS — carrying them forward would be inventing data. This
// route also has no auth, so there's no user to scope real analytics to even
// once assess.attempt has rows; that's a separate decision (add requireAuth
// here) this rewrite doesn't make unilaterally. Returns an honest empty
// shell instead of fake numbers.
export const getAnalytics = (_req: Request, res: Response): void => {
  res.json({
    status: "success",
    attempts: [],
    latestProjectedRank: null,
    averageAccuracy: null,
  });
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
