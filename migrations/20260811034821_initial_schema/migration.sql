-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'FACULTY', 'ADMIN');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('EN', 'TA');

-- CreateEnum
CREATE TYPE "TargetExam" AS ENUM ('NEET', 'JEE_MAIN', 'JEE_ADVANCED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'PUBLISH', 'RETIRE', 'SUBMIT', 'SCORE', 'DELETE_REQUEST', 'DELETE_COMPLETE');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('USER', 'QUESTION', 'TEST', 'ATTEMPT', 'SCHOOL');

-- CreateEnum
CREATE TYPE "ReservationCategory" AS ENUM ('GENERAL', 'EWS', 'OBC_NCL', 'SC', 'ST');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CORRECT', 'MULTIPLE_CORRECT', 'NUMERICAL', 'MATCHING', 'ASSERTION_REASON');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'RETIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('FULL', 'SUBJECT', 'CUSTOM', 'AI_REVISION', 'PYQ');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "BadgeCondition" AS ENUM ('SCORE_GTE', 'ACCURACY_GTE', 'STREAK_DAYS_GTE', 'TESTS_COMPLETED', 'LESSONS_COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BADGE_AWARDED', 'STREAK_REMINDER', 'REPORT_READY', 'PLAN_REMINDER', 'GENERAL');

-- CreateEnum
CREATE TYPE "PomodoroMode" AS ENUM ('FOCUS', 'SHORT_BREAK', 'LONG_BREAK');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PDF', 'NOTES', 'SLIDES');

-- CreateEnum
CREATE TYPE "Board" AS ENUM ('CBSE', 'ICSE', 'STATE_BOARD', 'IB', 'OTHER');

-- CreateEnum
CREATE TYPE "SchoolType" AS ENUM ('GOVERNMENT', 'PRIVATE', 'AIDED');

-- CreateEnum
CREATE TYPE "Medium" AS ENUM ('ENGLISH', 'TAMIL', 'TAMIL_ENGLISH', 'OTHER');

-- CreateEnum
CREATE TYPE "SchoolPlan" AS ENUM ('BASIC', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Designation" AS ENUM ('PRINCIPAL', 'VICE_PRINCIPAL', 'ADMINISTRATOR', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "locale" "Locale" NOT NULL DEFAULT 'EN',
    "targetExam" "TargetExam" NOT NULL DEFAULT 'NEET',
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "dataDeletionRequestedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "dob" TIMESTAMP(3),
    "class" INTEGER,
    "examYear" INTEGER,
    "phoneDisplay" TEXT,
    "avatarUrl" TEXT,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "schoolName" TEXT,
    "schoolId" TEXT,
    "state" TEXT,
    "category" "ReservationCategory",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "userId" TEXT NOT NULL,
    "theme" "Theme" NOT NULL DEFAULT 'LIGHT',
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailAlerts" BOOLEAN NOT NULL DEFAULT true,
    "mutePomodoroSound" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTa" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "examTypes" "TargetExam"[] DEFAULT ARRAY[]::"TargetExam"[],

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTa" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "classLevel" INTEGER,
    "weightage" DECIMAL(4,2),
    "examTypes" "TargetExam"[] DEFAULT ARRAY[]::"TargetExam"[],
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTa" TEXT,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'SINGLE_CORRECT',
    "stemEn" TEXT NOT NULL,
    "stemTa" TEXT,
    "stemImageUrl" TEXT,
    "explanationEn" TEXT,
    "explanationTa" TEXT,
    "marks" INTEGER NOT NULL DEFAULT 4,
    "negativeMarks" INTEGER NOT NULL DEFAULT 1,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
    "status" "QStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "contentSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "interactionConfig" JSONB,
    "scoringConfig" JSONB,
    "contentHash" TEXT,
    "selectionBucket" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "examTypes" "TargetExam"[] DEFAULT ARRAY[]::"TargetExam"[],
    "source" TEXT,
    "promptVersion" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "criticVerdict" JSONB,
    "numericalAnswer" DECIMAL(12,4),
    "numericalTolerance" DECIMAL(12,4),
    "numericalUnit" TEXT,
    "ncertReference" TEXT,
    "subjectId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "topicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "textEn" TEXT NOT NULL,
    "textTa" TEXT,
    "imageUrl" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TestType" NOT NULL,
    "examType" "TargetExam" NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "durationSeconds" INTEGER NOT NULL,
    "ownerUserId" TEXT,
    "sourceAttemptId" TEXT,
    "focusUnitSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_sections" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "subjectId" TEXT,
    "durationSeconds" INTEGER,

    CONSTRAINT "test_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_questions" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "sectionId" TEXT,
    "questionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" INTEGER NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER,
    "maxScore" INTEGER,
    "correctCount" INTEGER,
    "wrongCount" INTEGER,
    "skippedCount" INTEGER,
    "accuracy" INTEGER,
    "percentile" DECIMAL(5,2),
    "predictedAirRank" INTEGER,
    "scoringPolicyVersion" TEXT,
    "sectionBreakdownJson" JSONB,
    "unitBreakdownJson" JSONB,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_sections" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "attempt_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_questions" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sectionId" TEXT,
    "position" INTEGER NOT NULL,
    "optionOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chosenOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chosenNumericalAnswer" DECIMAL(12,4),
    "chosenInteractionAnswer" JSONB,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "contentSnapshot" JSONB NOT NULL,
    "questionVersionSnapshot" INTEGER NOT NULL,
    "correctOptionIdsSnapshot" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correctNumericalAnswerSnapshot" DECIMAL(12,4),
    "numericalToleranceSnapshot" DECIMAL(12,4),
    "answerKeySnapshot" JSONB,
    "marksSnapshot" INTEGER,
    "negativeMarksSnapshot" INTEGER,
    "isCorrect" BOOLEAN,
    "marksAwarded" INTEGER,
    "timeSpentMs" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "attempt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_explanation_cache" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "language" "Locale" NOT NULL,
    "text" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_explanation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_mastery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "attempted" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "wrong" INTEGER NOT NULL DEFAULT 0,
    "accuracy" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_mastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streaks" (
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" DATE NOT NULL,

    CONSTRAINT "streaks_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "conditionType" "BadgeCondition" NOT NULL,
    "conditionValue" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalText" TEXT NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "daily_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pomodoro_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "mode" "PomodoroMode" NOT NULL,
    "goalText" TEXT,
    "plannedSeconds" INTEGER NOT NULL,
    "actualSeconds" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "pomodoro_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examYear" INTEGER NOT NULL,
    "currentScore" DOUBLE PRECISION,
    "targetScore" DOUBLE PRECISION,
    "timetableJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plan_chapters" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "targetHours" DOUBLE PRECISION,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "study_plan_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revision_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcards" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_flashcard_daily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "shownDate" DATE NOT NULL,

    CONSTRAINT "user_flashcard_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameTa" TEXT,
    "overviewEn" TEXT,
    "keyTakeaways" TEXT,
    "ncertNotes" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_videos" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "language" "Locale" NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,

    CONSTRAINT "lesson_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_timestamps" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,

    CONSTRAINT "video_timestamps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_resources" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleTa" TEXT,
    "fileUrl" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,

    CONSTRAINT "lesson_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "watchPercent" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "board" "Board",
    "schoolType" "SchoolType",
    "medium" "Medium",
    "address" TEXT,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Tamil Nadu',
    "pincode" TEXT,
    "maxStudents" INTEGER,
    "plan" "SchoolPlan",
    "subscriptionStart" TIMESTAMP(3),
    "subscriptionEnd" TIMESTAMP(3),
    "status" "SchoolStatus" NOT NULL DEFAULT 'TRIAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_admins" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "designation" "Designation",
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "student_profiles_schoolId_idx" ON "student_profiles"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_slug_key" ON "subjects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "units_slug_key" ON "units"("slug");

-- CreateIndex
CREATE INDEX "units_subjectId_order_idx" ON "units"("subjectId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

-- CreateIndex
CREATE INDEX "topics_unitId_idx" ON "topics"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "questions_contentHash_key" ON "questions"("contentHash");

-- CreateIndex
CREATE INDEX "questions_unitId_status_idx" ON "questions"("unitId", "status");

-- CreateIndex
CREATE INDEX "questions_subjectId_status_idx" ON "questions"("subjectId", "status");

-- CreateIndex
CREATE INDEX "questions_status_subjectId_unitId_difficulty_selectionBucke_idx" ON "questions"("status", "subjectId", "unitId", "difficulty", "selectionBucket");

-- CreateIndex
CREATE INDEX "questions_status_type_difficulty_idx" ON "questions"("status", "type", "difficulty");

-- CreateIndex
CREATE INDEX "questions_examTypes_idx" ON "questions" USING GIN ("examTypes");

-- CreateIndex
CREATE INDEX "questions_topicId_idx" ON "questions"("topicId");

-- CreateIndex
CREATE INDEX "questions_status_reviewedById_idx" ON "questions"("status", "reviewedById");

-- CreateIndex
CREATE INDEX "options_questionId_idx" ON "options"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "options_questionId_label_key" ON "options"("questionId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "options_questionId_orderIndex_key" ON "options"("questionId", "orderIndex");

-- CreateIndex
CREATE INDEX "tests_examType_type_isPublished_idx" ON "tests"("examType", "type", "isPublished");

-- CreateIndex
CREATE INDEX "tests_ownerUserId_idx" ON "tests"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "test_sections_testId_orderIndex_key" ON "test_sections"("testId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "test_questions_testId_questionId_key" ON "test_questions"("testId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "test_questions_testId_orderIndex_key" ON "test_questions"("testId", "orderIndex");

-- CreateIndex
CREATE INDEX "attempts_userId_startedAt_idx" ON "attempts"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "attempts_status_deadlineAt_idx" ON "attempts"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "attempts_testId_idx" ON "attempts"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_sections_attemptId_sectionId_key" ON "attempt_sections"("attemptId", "sectionId");

-- CreateIndex
CREATE INDEX "attempt_questions_attemptId_position_idx" ON "attempt_questions"("attemptId", "position");

-- CreateIndex
CREATE INDEX "attempt_questions_attemptId_sectionId_idx" ON "attempt_questions"("attemptId", "sectionId");

-- CreateIndex
CREATE INDEX "attempt_questions_questionId_idx" ON "attempt_questions"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attemptId_questionId_key" ON "attempt_questions"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_explanation_cache_questionId_language_key" ON "ai_explanation_cache"("questionId", "language");

-- CreateIndex
CREATE INDEX "unit_mastery_userId_accuracy_idx" ON "unit_mastery"("userId", "accuracy");

-- CreateIndex
CREATE UNIQUE INDEX "unit_mastery_userId_unitId_key" ON "unit_mastery"("userId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_userId_badgeId_key" ON "user_badges"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_goals_userId_date_key" ON "daily_goals"("userId", "date");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "pomodoro_sessions_userId_startedAt_idx" ON "pomodoro_sessions"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "study_plans_userId_isActive_idx" ON "study_plans"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "study_plan_chapters_planId_unitId_key" ON "study_plan_chapters"("planId", "unitId");

-- CreateIndex
CREATE INDEX "revision_notes_userId_idx" ON "revision_notes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_flashcard_daily_userId_shownDate_key" ON "user_flashcard_daily"("userId", "shownDate");

-- CreateIndex
CREATE INDEX "lessons_unitId_orderIndex_idx" ON "lessons"("unitId", "orderIndex");

-- CreateIndex
CREATE INDEX "lesson_videos_lessonId_idx" ON "lesson_videos"("lessonId");

-- CreateIndex
CREATE INDEX "video_timestamps_videoId_idx" ON "video_timestamps"("videoId");

-- CreateIndex
CREATE INDEX "lesson_resources_lessonId_idx" ON "lesson_resources"("lessonId");

-- CreateIndex
CREATE INDEX "lesson_progress_userId_lessonId_idx" ON "lesson_progress"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_userId_lessonId_key" ON "lesson_progress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "bookmarks_userId_idx" ON "bookmarks"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_userId_lessonId_key" ON "bookmarks"("userId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "schools_code_key" ON "schools"("code");

-- CreateIndex
CREATE INDEX "schools_status_idx" ON "schools"("status");

-- CreateIndex
CREATE INDEX "school_admins_schoolId_idx" ON "school_admins"("schoolId");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options" ADD CONSTRAINT "options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES "attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sections" ADD CONSTRAINT "test_sections_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sections" ADD CONSTRAINT "test_sections_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "test_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_sections" ADD CONSTRAINT "attempt_sections_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_sections" ADD CONSTRAINT "attempt_sections_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "test_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "test_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_explanation_cache" ADD CONSTRAINT "ai_explanation_cache_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_mastery" ADD CONSTRAINT "unit_mastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_mastery" ADD CONSTRAINT "unit_mastery_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_goals" ADD CONSTRAINT "daily_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pomodoro_sessions" ADD CONSTRAINT "pomodoro_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pomodoro_sessions" ADD CONSTRAINT "pomodoro_sessions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plans" ADD CONSTRAINT "study_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plan_chapters" ADD CONSTRAINT "study_plan_chapters_planId_fkey" FOREIGN KEY ("planId") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plan_chapters" ADD CONSTRAINT "study_plan_chapters_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_notes" ADD CONSTRAINT "revision_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_notes" ADD CONSTRAINT "revision_notes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_flashcard_daily" ADD CONSTRAINT "user_flashcard_daily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_flashcard_daily" ADD CONSTRAINT "user_flashcard_daily_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "flashcards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_videos" ADD CONSTRAINT "lesson_videos_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_timestamps" ADD CONSTRAINT "video_timestamps_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "lesson_videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_admins" ADD CONSTRAINT "school_admins_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
