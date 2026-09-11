-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('STUDENT', 'EDUCATOR', 'REVIEWER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "question_type" AS ENUM ('MCQ', 'NUMERICAL', 'INTEGER', 'MULTIPLE_CORRECT', 'MATCHING');

-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "ai_usage" DROP CONSTRAINT "ai_usage_user_id_fkey";

-- DropIndex
DROP INDEX "questions_unit_id_idx";

-- AlterTable
-- A14: users.role text -> enum. NOT a plain DROP/ADD (the auto-generated
-- version would silently discard any non-default value) -- add the enum
-- column alongside the old one, map known values, then swap. Verified live
-- data first: `select distinct role from users` returned only 'student'
-- (2 rows), so the ELSE branch below is a safety net, not a real mapping.
ALTER TABLE "users" ADD COLUMN     "last_activity_date" DATE,
ADD COLUMN     "role_new" "user_role";

UPDATE "users" SET "role_new" = CASE lower("role")
  WHEN 'student' THEN 'STUDENT'::"user_role"
  WHEN 'educator' THEN 'EDUCATOR'::"user_role"
  WHEN 'reviewer' THEN 'REVIEWER'::"user_role"
  WHEN 'admin' THEN 'ADMIN'::"user_role"
  WHEN 'super_admin' THEN 'SUPER_ADMIN'::"user_role"
  ELSE 'STUDENT'::"user_role"
END;

ALTER TABLE "users" ALTER COLUMN "role_new" SET NOT NULL,
ALTER COLUMN "role_new" SET DEFAULT 'STUDENT';

ALTER TABLE "users" DROP COLUMN "role";
ALTER TABLE "users" RENAME COLUMN "role_new" TO "role";

-- A13: enforce that every user has a way to be contacted/identified.
-- Data risk checked before writing this: `select count(*) from users where
-- email is null and phone is null` returned 0 -- safe to add directly, no
-- backfill needed.
ALTER TABLE "users" ADD CONSTRAINT "chk_users_email_or_phone"
  CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "question_type" "question_type" NOT NULL DEFAULT 'MCQ',
ADD COLUMN     "review_status" "review_status" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "marks" SET DEFAULT 4,
ALTER COLUMN "marks" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "negative_marks" SET DEFAULT 1,
ALTER COLUMN "negative_marks" SET DATA TYPE DECIMAL(5,2);

-- A11: an active question must have passed review. Data risk checked before
-- writing this: `select is_active, count(*) from questions group by
-- is_active` returned 0 rows -- the public.questions table is currently
-- empty (real content lives in content.question, the separate db/ schema
-- built this session), so there is nothing to backfill today. The UPDATE
-- below is kept as a defensive no-op so this migration stays correct if
-- questions ever land in this table before it is applied.
UPDATE "questions" SET "review_status" = 'APPROVED' WHERE "is_active" = true AND "review_status" != 'APPROVED';

ALTER TABLE "questions" ADD CONSTRAINT "chk_questions_active_requires_approved"
  CHECK ("is_active" = false OR "review_status" = 'APPROVED');

-- Partial index: only actively-served, approved questions are looked up by
-- the paper-generation path, so index only those rows.
CREATE INDEX "idx_questions_servable" ON "questions" ("unit_id", "difficulty")
  WHERE "is_active" = true AND "review_status" = 'APPROVED';

-- AlterTable
ALTER TABLE "question_options" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "test_attempts" ALTER COLUMN "score" SET DATA TYPE DECIMAL(8,2),
ALTER COLUMN "max_score" SET DATA TYPE DECIMAL(8,2);

-- AlterTable
ALTER TABLE "attempt_answers" ADD COLUMN     "marked_for_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marks_awarded" DECIMAL(5,2),
ADD COLUMN     "numeric_answer" DECIMAL(18,6),
ADD COLUMN     "question_revision_id" UUID,
ADD COLUMN     "response_json" JSONB,
ADD COLUMN     "selected_option_ids" UUID[];

-- AlterTable
ALTER TABLE "ai_cache" DROP COLUMN "hit_count",
ADD COLUMN     "expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "job_id" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL,
ALTER COLUMN "cost_usd" SET DATA TYPE DECIMAL(12,6);

-- CreateTable
CREATE TABLE "user_daily_activity" (
    "user_id" UUID NOT NULL,
    "activity_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_daily_activity_pkey" PRIMARY KEY ("user_id","activity_date")
);

-- CreateTable
CREATE TABLE "question_revisions" (
    "id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "snapshot_version" INTEGER NOT NULL DEFAULT 1,
    "stem_en" TEXT NOT NULL,
    "stem_ta" TEXT,
    "marks" DECIMAL(5,2) NOT NULL,
    "negative_marks" DECIMAL(5,2) NOT NULL,
    "options_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_assets" (
    "id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "option_id" TEXT,
    "role" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width_px" INTEGER,
    "height_px" INTEGER,
    "alt_text_en" TEXT,
    "alt_text_ta" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_tests" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "exam_type" TEXT NOT NULL DEFAULT 'NEET',
    "total_marks" DECIMAL(8,2),
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_test_sections" (
    "id" UUID NOT NULL,
    "mock_test_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "question_count" INTEGER NOT NULL,
    "questions_to_attempt" INTEGER NOT NULL,
    "duration_seconds" INTEGER,
    "marks_per_question" DECIMAL(5,2),
    "negative_marks_per_question" DECIMAL(5,2),

    CONSTRAINT "mock_test_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_test_questions" (
    "mock_test_id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "section_name" TEXT,
    "section_id" UUID,
    "marks_override" DECIMAL(5,2),
    "negative_marks_override" DECIMAL(5,2),

    CONSTRAINT "mock_test_questions_pkey" PRIMARY KEY ("mock_test_id","question_id")
);

-- CreateTable
CREATE TABLE "attempt_questions" (
    "attempt_id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "section_name" TEXT,
    "served_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_questions_pkey" PRIMARY KEY ("attempt_id","question_id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "question_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_revisions_question_id_idx" ON "question_revisions"("question_id");

-- CreateIndex
CREATE INDEX "question_assets_question_id_idx" ON "question_assets"("question_id");

-- CreateIndex
CREATE INDEX "question_assets_option_id_idx" ON "question_assets"("option_id");

-- CreateIndex
CREATE UNIQUE INDEX "mock_test_sections_mock_test_id_display_order_key" ON "mock_test_sections"("mock_test_id", "display_order");

-- CreateIndex
CREATE INDEX "mock_test_questions_section_id_idx" ON "mock_test_questions"("section_id");

-- CreateIndex
CREATE UNIQUE INDEX "mock_test_questions_mock_test_id_display_order_key" ON "mock_test_questions"("mock_test_id", "display_order");

-- CreateIndex
CREATE INDEX "attempt_questions_question_id_idx" ON "attempt_questions"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attempt_id_display_order_key" ON "attempt_questions"("attempt_id", "display_order");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_created_at_idx" ON "bookmarks"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_user_id_question_id_key" ON "bookmarks"("user_id", "question_id");

-- CreateIndex
CREATE INDEX "notes_user_id_created_at_idx" ON "notes"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_type_idx" ON "notifications"("user_id", "type");

-- CreateIndex
CREATE INDEX "questions_unit_id_difficulty_question_type_idx" ON "questions"("unit_id", "difficulty", "question_type");

-- CreateIndex
CREATE INDEX "attempt_answers_question_revision_id_idx" ON "attempt_answers"("question_revision_id");

-- CreateIndex
CREATE INDEX "ai_cache_expires_at_idx" ON "ai_cache"("expires_at");

-- CreateIndex
CREATE INDEX "ai_usage_job_id_idx" ON "ai_usage"("job_id");

-- AddForeignKey
ALTER TABLE "user_daily_activity" ADD CONSTRAINT "user_daily_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_revisions" ADD CONSTRAINT "question_revisions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_assets" ADD CONSTRAINT "question_assets_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_assets" ADD CONSTRAINT "question_assets_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "question_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_test_sections" ADD CONSTRAINT "mock_test_sections_mock_test_id_fkey" FOREIGN KEY ("mock_test_id") REFERENCES "mock_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_test_questions" ADD CONSTRAINT "mock_test_questions_mock_test_id_fkey" FOREIGN KEY ("mock_test_id") REFERENCES "mock_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_test_questions" ADD CONSTRAINT "mock_test_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_test_questions" ADD CONSTRAINT "mock_test_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "mock_test_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_revision_id_fkey" FOREIGN KEY ("question_revision_id") REFERENCES "question_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
