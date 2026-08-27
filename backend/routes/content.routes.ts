import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { makeCrudRouter } from "../lib/dbCrudRouter.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { validate } from "../middleware/validate.js";
import { aiGenerationJobRepository } from "../../db/content/ai_generation_job/ai_generation_job.repository.js";
import { sourceDocumentRepository } from "../../db/content/source_document/source_document.repository.js";
import { questionRepository } from "../../db/content/ai_generation_job/question/question.repository.js";
import { documentChunkRepository } from "../../db/content/source_document/document_chunk/document_chunk.repository.js";
import { questionOptionRepository } from "../../db/content/ai_generation_job/question/question_option/question_option.repository.js";
import { questionSolutionRepository } from "../../db/content/ai_generation_job/question/question_solution/question_solution.repository.js";
import { questionTranslationRepository } from "../../db/content/ai_generation_job/question/question_translation/question_translation.repository.js";
import { questionReviewRepository } from "../../db/content/ai_generation_job/question/question_review/question_review.repository.js";
import { assetRepository } from "../../db/content/ai_generation_job/question/asset/asset.repository.js";
import { submitForReview, decideReview, publishQuestion, retireQuestion, listReviewHistory } from "../../db/content/lifecycle.js";
import { pool } from "../../db/shared/pool.js";

// content is platform-owned and, per docs/design/LA-DBD-004_backend_schema_map.md,
// "written by workers only" — there's no worker/service-role concept built in
// this codebase yet (no queue, no service-role auth check), so rather than
// gate writes behind a check that doesn't really enforce "worker," these
// routes are read-only until that infrastructure exists. Writing a question
// through a plain user-facing endpoint would bypass the generation/validation
// pipeline entirely (docs/design/LA-ARC-004_generator_validator.md's four gates).
//
// question_node_map and question_chunk_ref are skipped — composite PKs
// (question_id + node_id / chunk_id), which makeCrudRouter's single-:id
// shape doesn't support.
const router = Router();

// ---------------------------------------------------------------------------
// CL-5 (LA-PLAN-002 Day 2, first pass) — CL-4's lifecycle state machine
// wired to real RBAC. Registered before the generic CRUD mounts below so
// "/questions/:id/submit-review" etc. and the "/questions" list route are
// matched by these specific handlers, not swallowed by makeCrudRouter's
// bare "GET /:id" (Express only falls through to a later handler if an
// earlier one doesn't match at all — these paths have an extra segment or
// method the CRUD router's single GET /:id route never matches).

const noteBodySchema = z.object({ note: z.string().optional() });
const decisionBodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().optional(),
  issueCodes: z.array(z.string()).optional(),
});
const listQuerySchema = z.object({ nodeTagCode: z.string().min(1) });

router.post(
  "/questions/:id/submit-review",
  requireAuth,
  requirePermission("content:submit_review"),
  validate({ body: noteBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await submitForReview(req.params.id, req.user!.appUserId, req.body.note) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/questions/:id/review-decision",
  requireAuth,
  requirePermission("content:review_decide"),
  validate({ body: decisionBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { decision, note, issueCodes } = req.body;
      res.json({ data: await decideReview(req.params.id, req.user!.appUserId, decision, note, issueCodes) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/questions/:id/publish",
  requireAuth,
  requirePermission("content:publish"),
  validate({ body: noteBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await publishQuestion(req.params.id, req.user!.appUserId, req.body.note) });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/questions/:id/retire",
  requireAuth,
  requirePermission("content:publish"),
  validate({ body: noteBodySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await retireQuestion(req.params.id, req.user!.appUserId, req.body.note) });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/questions/:id/review-history",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({ data: await listReviewHistory(req.params.id) });
    } catch (err) {
      next(err);
    }
  }
);

// Filter-by-node listing (LA-PLAN-002 Day 2 CL-5 "done when"). Role-scoped:
// a caller holding any content:* permission (educator/reviewer/admin) sees
// every lifecycle status for the node; anyone else (a plain student) sees
// only published questions — content still "written by workers only"
// (see file header), this is the read side, scoped by who's asking.
router.get(
  "/questions",
  requireAuth,
  validate({ query: listQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roleRes = await pool.query<{ permission_code: string }>(
        `select distinct p.permission_code
           from core.user_role_assignment ura
           join core.role r on r.role_id = ura.role_id
           join core.role_permission rp on rp.role_id = r.role_id
           join core.permission p on p.permission_id = rp.permission_id
          where ura.user_id = $1 and ura.revoked_at is null and p.permission_code like 'content:%'`,
        [req.user!.appUserId]
      );
      const isStaff = roleRes.rowCount! > 0;

      const { nodeTagCode } = req.query as unknown as { nodeTagCode: string };
      const rows = await pool.query(
        `select q.question_id, q.question_uid, q.stem_text, q.question_type, q.difficulty_band, q.lifecycle_status
           from content.question q
           join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
          where sn.tag_code = $1 ${isStaff ? "" : "and q.lifecycle_status = 'published'"}
          order by q.question_uid`,
        [nodeTagCode]
      );
      res.json({ data: rows.rows });
    } catch (err) {
      next(err);
    }
  }
);

router.use("/ai-generation-jobs", makeCrudRouter(aiGenerationJobRepository, { readOnly: true }));
router.use("/source-documents", makeCrudRouter(sourceDocumentRepository, { readOnly: true }));
router.use("/questions", makeCrudRouter(questionRepository, { readOnly: true }));
router.use("/document-chunks", makeCrudRouter(documentChunkRepository, { readOnly: true }));
router.use("/question-options", makeCrudRouter(questionOptionRepository, { readOnly: true }));
router.use("/question-solutions", makeCrudRouter(questionSolutionRepository, { readOnly: true }));
router.use("/question-translations", makeCrudRouter(questionTranslationRepository, { readOnly: true }));
router.use("/question-reviews", makeCrudRouter(questionReviewRepository, { readOnly: true }));
router.use("/assets", makeCrudRouter(assetRepository, { readOnly: true }));

export default router;
