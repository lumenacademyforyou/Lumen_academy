-- Second pass over the schema audit/upgrade. Supersedes A5's per-MockTest
-- MockTestSection with a versioned, reusable ExamPattern (see the model
-- comment in schema.prisma). mock_tests / mock_test_sections /
-- mock_test_questions were created by the previous migration
-- (20260820140818_schema_audit_upgrade), which is itself still unapplied —
-- so the DROP COLUMN/DROP TABLE below touch no live data.

-- CreateEnum
CREATE TYPE "exam_type" AS ENUM ('NEET', 'JEE_MAIN', 'JEE_ADVANCED');

-- CreateEnum
CREATE TYPE "partial_marking_mode" AS ENUM ('NONE', 'PER_CORRECT_OPTION', 'ALL_OR_NOTHING');

-- CreateEnum
CREATE TYPE "section_navigation_rule" AS ENUM ('FREE_NAVIGATION', 'LOCK_ON_EXIT', 'SEQUENTIAL_ONLY');

-- DropForeignKey
ALTER TABLE "mock_test_sections" DROP CONSTRAINT "mock_test_sections_mock_test_id_fkey";

-- DropForeignKey
ALTER TABLE "mock_test_questions" DROP CONSTRAINT "mock_test_questions_section_id_fkey";

-- DropIndex
DROP INDEX "mock_test_questions_section_id_idx";

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "exam_paper" TEXT,
ADD COLUMN     "exam_year" INTEGER;

-- AlterTable
ALTER TABLE "mock_tests" ADD COLUMN     "exam_pattern_id" UUID;

-- AlterTable
ALTER TABLE "mock_test_questions" DROP COLUMN "section_id",
ADD COLUMN     "exam_pattern_section_id" UUID;

-- AlterTable
ALTER TABLE "attempt_answers" ADD COLUMN     "client_answered_at" TIMESTAMP(3);

-- DropTable
DROP TABLE "mock_test_sections";

-- CreateTable
CREATE TABLE "exam_patterns" (
    "id" UUID NOT NULL,
    "exam_type" "exam_type" NOT NULL,
    "exam_year" INTEGER NOT NULL,
    "paper" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_pattern_sections" (
    "id" UUID NOT NULL,
    "exam_pattern_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject_id" TEXT,
    "question_count" INTEGER NOT NULL,
    "attempt_count" INTEGER,
    "duration_seconds" INTEGER,
    "display_order" INTEGER NOT NULL,
    "navigation_rule" "section_navigation_rule" NOT NULL DEFAULT 'FREE_NAVIGATION',
    "requires_explicit_section_submit" BOOLEAN NOT NULL DEFAULT false,
    "marks_override" DECIMAL(5,2),
    "negative_marks_override" DECIMAL(5,2),

    CONSTRAINT "exam_pattern_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_rules" (
    "id" UUID NOT NULL,
    "exam_pattern_id" UUID NOT NULL,
    "question_type" "question_type" NOT NULL,
    "marks" DECIMAL(5,2) NOT NULL,
    "negative_marks" DECIMAL(5,2) NOT NULL,
    "partial_marking_mode" "partial_marking_mode" NOT NULL DEFAULT 'NONE',
    "marks_per_correct_option" DECIMAL(5,2),
    "max_marks" DECIMAL(5,2),

    CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_section_states" (
    "attempt_id" UUID NOT NULL,
    "exam_pattern_section_id" UUID NOT NULL,
    "entered_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "attempt_section_states_pkey" PRIMARY KEY ("attempt_id","exam_pattern_section_id")
);

-- CreateTable
CREATE TABLE "exam_calendar_events" (
    "id" UUID NOT NULL,
    "exam_type" "exam_type" NOT NULL,
    "exam_year" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_patterns_exam_type_exam_year_idx" ON "exam_patterns"("exam_type", "exam_year");

-- CreateIndex
CREATE UNIQUE INDEX "exam_patterns_exam_type_exam_year_paper_version_key" ON "exam_patterns"("exam_type", "exam_year", "paper", "version");

-- CreateIndex
CREATE INDEX "exam_pattern_sections_exam_pattern_id_idx" ON "exam_pattern_sections"("exam_pattern_id");

-- CreateIndex
CREATE INDEX "exam_pattern_sections_subject_id_idx" ON "exam_pattern_sections"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_pattern_sections_exam_pattern_id_display_order_key" ON "exam_pattern_sections"("exam_pattern_id", "display_order");

-- CreateIndex
CREATE INDEX "scoring_rules_exam_pattern_id_idx" ON "scoring_rules"("exam_pattern_id");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rules_exam_pattern_id_question_type_key" ON "scoring_rules"("exam_pattern_id", "question_type");

-- CreateIndex
CREATE INDEX "attempt_section_states_exam_pattern_section_id_idx" ON "attempt_section_states"("exam_pattern_section_id");

-- CreateIndex
CREATE INDEX "exam_calendar_events_exam_type_exam_year_idx" ON "exam_calendar_events"("exam_type", "exam_year");

-- CreateIndex
CREATE INDEX "exam_calendar_events_event_date_idx" ON "exam_calendar_events"("event_date");

-- CreateIndex
CREATE INDEX "mock_tests_exam_pattern_id_idx" ON "mock_tests"("exam_pattern_id");

-- CreateIndex
CREATE INDEX "mock_test_questions_exam_pattern_section_id_idx" ON "mock_test_questions"("exam_pattern_section_id");

-- AddForeignKey
ALTER TABLE "exam_pattern_sections" ADD CONSTRAINT "exam_pattern_sections_exam_pattern_id_fkey" FOREIGN KEY ("exam_pattern_id") REFERENCES "exam_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_pattern_sections" ADD CONSTRAINT "exam_pattern_sections_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_rules" ADD CONSTRAINT "scoring_rules_exam_pattern_id_fkey" FOREIGN KEY ("exam_pattern_id") REFERENCES "exam_patterns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_tests" ADD CONSTRAINT "mock_tests_exam_pattern_id_fkey" FOREIGN KEY ("exam_pattern_id") REFERENCES "exam_patterns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_test_questions" ADD CONSTRAINT "mock_test_questions_exam_pattern_section_id_fkey" FOREIGN KEY ("exam_pattern_section_id") REFERENCES "exam_pattern_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_section_states" ADD CONSTRAINT "attempt_section_states_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_section_states" ADD CONSTRAINT "attempt_section_states_exam_pattern_section_id_fkey" FOREIGN KEY ("exam_pattern_section_id") REFERENCES "exam_pattern_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
