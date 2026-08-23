import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { makeCrudRouter } from "../lib/dbCrudRouter.js";
import { examRepository } from "../../db/catalog/exam/exam.repository.js";
import { markingSchemeRepository } from "../../db/catalog/marking_scheme/marking_scheme.repository.js";
import { examCycleRepository } from "../../db/catalog/exam/exam_cycle/exam_cycle.repository.js";
import { subjectRepository } from "../../db/catalog/exam/subject/subject.repository.js";
import { syllabusVersionRepository } from "../../db/catalog/exam/syllabus_version/syllabus_version.repository.js";
import { examPatternRepository } from "../../db/catalog/exam/exam_cycle/exam_pattern/exam_pattern.repository.js";
import { patternSectionRepository } from "../../db/catalog/exam/exam_cycle/exam_pattern/pattern_section/pattern_section.repository.js";
import { syllabusNodeRepository } from "../../db/catalog/exam/syllabus_version/syllabus_node/syllabus_node.repository.js";
import { nodeWeightageRepository } from "../../db/catalog/exam/exam_cycle/exam_pattern/node_weightage/node_weightage.repository.js";

// Catalog is platform-owned reference data (exams, patterns, syllabus) — see
// docs/design/02_conceptual_er_high_level_revA.md: "a tenant reads them but
// never writes to them." Reads are open here (same as the existing
// /questions and /syllabus endpoints); writes require the catalog:write
// permission (LA-BE-CORE-002 CL-P6) — previously this list only required
// requireAuth, so any signed-in student could write platform-owned catalog
// data; catalog:write is granted only to super_admin/platform_admin/
// content_admin/system (db/scripts/seed/00_core_roles.ts).
const authed = [requireAuth, requirePermission("catalog:write")];

const router = Router();

router.use("/exams", makeCrudRouter(examRepository, { writeMiddleware: authed }));
router.use("/marking-schemes", makeCrudRouter(markingSchemeRepository, { writeMiddleware: authed }));
router.use("/exam-cycles", makeCrudRouter(examCycleRepository, { writeMiddleware: authed }));
router.use("/subjects", makeCrudRouter(subjectRepository, { writeMiddleware: authed }));
router.use("/syllabus-versions", makeCrudRouter(syllabusVersionRepository, { writeMiddleware: authed }));
router.use("/exam-patterns", makeCrudRouter(examPatternRepository, { writeMiddleware: authed }));
router.use("/pattern-sections", makeCrudRouter(patternSectionRepository, { writeMiddleware: authed }));
router.use("/syllabus-nodes", makeCrudRouter(syllabusNodeRepository, { writeMiddleware: authed }));
router.use("/node-weightages", makeCrudRouter(nodeWeightageRepository, { writeMiddleware: authed }));

export default router;
