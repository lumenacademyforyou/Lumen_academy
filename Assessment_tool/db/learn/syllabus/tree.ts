/**
 * LL-P0 — syllabus read model (LA-BE-ENGINE-001 Section 7 / LA-PLAN-002 Day 1).
 * Shared by the test engine's scope resolution and the learn layer's tree —
 * one reading of catalog.syllabus_node, never two (brief §3.3).
 *
 * Substitution vs the brief's D-9 wording ("published syllabus version"):
 * catalog.syllabus_version.version_status has no 'published' value —
 * confirmed live, its check constraint is draft|active|retired. 'active' is
 * used as the equivalent everywhere below.
 *
 * Availability count is "published" content.question rows reachable via
 * content.question_node_map for that node — content.v_question_eligibility
 * (the brief's assumed source) does not exist (docs/DB_STATE.md §6).
 */
import { pool } from "../../shared/pool.js";

export interface ExamSubjectSummary {
  subjectId: string;
  subjectCode: string;
  displayName: string;
  availableQuestions: number;
}

export interface ExamSummary {
  examId: string;
  examCode: string;
  familyCode: string | null;
  displayName: string;
  syllabusVersionId: string;
  syllabusVersionLabel: string;
  subjects: ExamSubjectSummary[];
}

/**
 * D-9: every exam with an active syllabus version appears because a row
 * exists, not because it's named in code. Adding an exam is an insert.
 */
export async function listExams(): Promise<ExamSummary[]> {
  const examsRes = await pool.query<{
    exam_id: string;
    exam_code: string;
    display_name: string;
    family_code: string | null;
    syllabus_version_id: string;
    effective_year: number | null;
  }>(
    `select e.exam_id, e.exam_code, e.display_name, ef.family_code,
            sv.syllabus_version_id, sv.effective_year
       from catalog.exam e
       join catalog.syllabus_version sv on sv.exam_id = e.exam_id and sv.version_status = 'active'
       left join catalog.exam_family ef on ef.family_id = e.family_id
      where e.is_active = true
      order by e.exam_code`
  );

  const summaries: ExamSummary[] = [];
  for (const exam of examsRes.rows) {
    const subjectsRes = await pool.query<{
      subject_id: string;
      subject_code: string;
      subject_name: string;
      available_questions: string;
    }>(
      `select s.subject_id, s.subject_code, s.subject_name,
              count(q.question_id) filter (where q.lifecycle_status = 'published') as available_questions
         from catalog.subject s
         left join catalog.syllabus_node sn on sn.subject_id = s.subject_id and sn.syllabus_version_id = $2
         left join content.question_node_map qnm on qnm.node_id = sn.node_id
         left join content.question q on q.question_id = qnm.question_id
        where s.exam_id = $1
        group by s.subject_id, s.subject_code, s.subject_name, s.display_order
        order by s.display_order nulls last, s.subject_code`,
      [exam.exam_id, exam.syllabus_version_id]
    );

    summaries.push({
      examId: exam.exam_id,
      examCode: exam.exam_code,
      familyCode: exam.family_code,
      displayName: exam.display_name,
      syllabusVersionId: exam.syllabus_version_id,
      syllabusVersionLabel: exam.effective_year ? String(exam.effective_year) : exam.syllabus_version_id,
      subjects: subjectsRes.rows.map((s) => ({
        subjectId: s.subject_id,
        subjectCode: s.subject_code,
        displayName: s.subject_name,
        availableQuestions: Number(s.available_questions),
      })),
    });
  }
  return summaries;
}

export interface SyllabusTreeNode {
  nodeId: string;
  code: string;
  title: string;
  level: number;
  ordinal: number;
  availableQuestions: number;
  children: SyllabusTreeNode[];
}

export interface SyllabusTreeResult {
  examCode: string;
  subjectCode: string | null;
  syllabusVersionLabel: string;
  nodes: SyllabusTreeNode[];
}

interface NodeRow {
  node_id: string;
  parent_node_id: string | null;
  node_code: string | null;
  tag_code: string;
  title: string;
  depth: number;
  sort_order: number;
  available_questions: string;
}

/**
 * @param examCode required
 * @param subjectCode optional — omit for every subject's tree in one call
 * @param depth optional — caps how many levels deep the returned tree goes (root = level 0)
 */
export async function getSyllabusTree(examCode: string, subjectCode?: string, depth?: number): Promise<SyllabusTreeResult> {
  const examRes = await pool.query<{ exam_id: string; syllabus_version_id: string; effective_year: number | null }>(
    `select e.exam_id, sv.syllabus_version_id, sv.effective_year
       from catalog.exam e
       join catalog.syllabus_version sv on sv.exam_id = e.exam_id and sv.version_status = 'active'
      where e.exam_code = $1`,
    [examCode]
  );
  if (examRes.rowCount === 0) {
    return { examCode, subjectCode: subjectCode ?? null, syllabusVersionLabel: "", nodes: [] };
  }
  const { exam_id: examId, syllabus_version_id: syllabusVersionId, effective_year: effectiveYear } = examRes.rows[0];

  const nodesRes = await pool.query<NodeRow>(
    `select sn.node_id, sn.parent_node_id, sn.node_code, sn.tag_code, sn.title, sn.depth, sn.sort_order,
            count(q.question_id) filter (where q.lifecycle_status = 'published') as available_questions
       from catalog.syllabus_node sn
       join catalog.subject s on s.subject_id = sn.subject_id
       left join content.question_node_map qnm on qnm.node_id = sn.node_id
       left join content.question q on q.question_id = qnm.question_id
      where sn.syllabus_version_id = $1
        and s.exam_id = $2
        and ($3::text is null or s.subject_code = $3)
      group by sn.node_id, sn.parent_node_id, sn.node_code, sn.tag_code, sn.title, sn.depth, sn.sort_order
      order by sn.depth, sn.sort_order, sn.title`,
    [syllabusVersionId, examId, subjectCode ?? null]
  );

  const byParent = new Map<string | null, NodeRow[]>();
  for (const row of nodesRes.rows) {
    const list = byParent.get(row.parent_node_id) ?? [];
    list.push(row);
    byParent.set(row.parent_node_id, list);
  }

  function build(parentId: string | null, level: number): SyllabusTreeNode[] {
    if (depth !== undefined && level >= depth) return [];
    const children = byParent.get(parentId) ?? [];
    return children.map((row) => ({
      nodeId: row.node_id,
      code: row.node_code ?? row.tag_code,
      title: row.title,
      level,
      ordinal: row.sort_order,
      availableQuestions: Number(row.available_questions),
      children: build(row.node_id, level + 1),
    }));
  }

  return {
    examCode,
    subjectCode: subjectCode ?? null,
    syllabusVersionLabel: effectiveYear ? String(effectiveYear) : syllabusVersionId,
    nodes: build(null, 0),
  };
}
