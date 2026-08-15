import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
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
// /questions and /syllabus endpoints); writes require sign-in.
//
// NOT admin-gated: no admin role value exists anywhere in this codebase yet
// (prisma/schema.prisma's User.role defaults to "student"; requireRole() is
// defined but unused everywhere). Add requireRole("admin") once that role
// actually exists — inventing a role string here would be guessing.
const authed = [requireAuth];

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
