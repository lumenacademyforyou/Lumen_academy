import { Request, Response, NextFunction } from "express";
import { pool } from "../../../db/shared/pool.js";
import { AppError } from "../middleware/errorHandler.js";

// GET /api/catalog/tree (LA-APP-COMPLETION-001 Phase D, D3/D4/D6). Phase D's
// research pass found no endpoint anywhere that returns a subject->unit tree
// with live published-question counts — catalog.routes.ts only ever mounted
// generic CRUD routers (db-crud, single-row GET /:id only, no list route),
// and GET /api/syllabus (analyticsController.getSyllabus) returns a flat
// list with no counts and no subjectId/nodeId uuids (only tag_code), so it
// can't drive a builder that has to pass real uuids to POST /assess/sessions.
// This is genuinely new backend work, not a rename of something existing.
//
// Confirmed live via Phase B4's inventory (docs/APP_COMPLETION_PLAN.md): the
// real catalog.syllabus_node table is flat today — 38 units across 4
// subjects, no parent_node_id/depth beyond 0 — so "subject -> unit" is the
// full real hierarchy; this endpoint does not invent a deeper
// module/chapter/topic level the data doesn't have.
//
// Counts use q.primary_node_id (same join questionController.ts's
// PUBLISHED_SUBJECT_FILTER uses), not content.question_node_map — confirmed
// via a live query that the two are 1:1 today (1400 rows each), and B4's
// per-unit inventory (built the same way) already summed exactly to the
// per-subject totals, so this stays consistent with already-verified data
// rather than introducing a second counting method.
interface SubjectRow {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  display_order: number | null;
}

interface UnitRow {
  node_id: string;
  subject_id: string;
  tag_code: string;
  title: string;
  class_level: string | null;
  display_order: number | null;
}

interface CountRow {
  node_id: string;
  n: string;
}

export const getCatalogTree = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const examRes = await pool.query<{ exam_id: string; exam_code: string; display_name: string }>(
      `select exam_id, exam_code, display_name from catalog.exam where is_active = true order by exam_id limit 1`
    );
    if (examRes.rowCount === 0) {
      next(new AppError(500, "NO_ACTIVE_EXAM", "No active catalog.exam row exists."));
      return;
    }
    const exam = examRes.rows[0];

    const subjectsRes = await pool.query<SubjectRow>(
      `select subject_id, subject_code, subject_name, display_order
         from catalog.subject
        where exam_id = $1
        order by display_order`,
      [exam.exam_id]
    );

    const unitsRes = await pool.query<UnitRow>(
      `select sn.node_id, sn.subject_id, sn.tag_code, sn.title, sn.class_level, sn.display_order
         from catalog.syllabus_node sn
         join catalog.subject s on s.subject_id = sn.subject_id
        where s.exam_id = $1
        order by s.display_order, sn.display_order`,
      [exam.exam_id]
    );

    const countsRes = await pool.query<CountRow>(
      `select q.primary_node_id as node_id, count(*) as n
         from content.question q
         join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
         join catalog.subject s on s.subject_id = sn.subject_id
        where q.lifecycle_status = 'published' and s.exam_id = $1
        group by q.primary_node_id`,
      [exam.exam_id]
    );
    const countByNode = new Map(countsRes.rows.map((r) => [r.node_id, Number(r.n)]));

    const unitsBySubject = new Map<string, UnitRow[]>();
    for (const unit of unitsRes.rows) {
      const list = unitsBySubject.get(unit.subject_id) ?? [];
      list.push(unit);
      unitsBySubject.set(unit.subject_id, list);
    }

    const subjects = subjectsRes.rows.map((s) => {
      const units = (unitsBySubject.get(s.subject_id) ?? []).map((u) => ({
        nodeId: u.node_id,
        tagCode: u.tag_code,
        title: u.title,
        classLevel: u.class_level,
        displayOrder: u.display_order,
        publishedQuestionCount: countByNode.get(u.node_id) ?? 0,
      }));
      return {
        subjectId: s.subject_id,
        subjectCode: s.subject_code,
        subjectName: s.subject_name,
        displayOrder: s.display_order,
        publishedQuestionCount: units.reduce((sum, u) => sum + u.publishedQuestionCount, 0),
        units,
      };
    });

    // BUG-31 (docs/assessment-tool-debug-plan.md Phase 10) — "sensible
    // ETag/Cache-Control on content that rarely changes (syllabus, question
    // metadata)." This endpoint is read-open (no requireAuth above) and
    // platform-wide — identical for every caller, not personalized — so
    // it's safe to cache without any risk of the cross-user bleed BUG-04
    // flagged for attempt/user data. Express already sends a weak ETag on
    // every response by default (enables a conditional GET even without
    // this); the explicit max-age additionally lets the browser skip the
    // round trip entirely for 5 minutes, well under how often content
    // admins actually publish new questions/units.
    res.set("Cache-Control", "public, max-age=300");
    res.json({
      data: {
        examId: exam.exam_id,
        examCode: exam.exam_code,
        examName: exam.display_name,
        subjects,
      },
    });
  } catch (err) {
    next(err);
  }
};
