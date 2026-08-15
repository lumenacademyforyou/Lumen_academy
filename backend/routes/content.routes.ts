import { Router } from "express";
import { makeCrudRouter } from "../lib/dbCrudRouter.js";
import { aiGenerationJobRepository } from "../../db/content/ai_generation_job/ai_generation_job.repository.js";
import { sourceDocumentRepository } from "../../db/content/source_document/source_document.repository.js";
import { questionRepository } from "../../db/content/ai_generation_job/question/question.repository.js";
import { documentChunkRepository } from "../../db/content/source_document/document_chunk/document_chunk.repository.js";
import { questionOptionRepository } from "../../db/content/ai_generation_job/question/question_option/question_option.repository.js";
import { questionSolutionRepository } from "../../db/content/ai_generation_job/question/question_solution/question_solution.repository.js";
import { questionTranslationRepository } from "../../db/content/ai_generation_job/question/question_translation/question_translation.repository.js";
import { questionReviewRepository } from "../../db/content/ai_generation_job/question/question_review/question_review.repository.js";
import { assetRepository } from "../../db/content/ai_generation_job/question/asset/asset.repository.js";

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
