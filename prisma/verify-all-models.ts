import {
  AuditAction,
  AuditEntity,
  BadgeCondition,
  Board,
  Designation,
  Difficulty,
  Locale,
  Medium,
  NotificationType,
  PomodoroMode,
  PrismaClient,
  QStatus,
  QuestionType,
  ReservationCategory,
  ResourceType,
  Role,
  SchoolPlan,
  SchoolStatus,
  SchoolType,
  TargetExam,
  Theme,
  TestType,
  AttemptStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting Comprehensive Database Schema & Field Validity Verification...\n");

  const testUserId = "test-user-validity-check-uuid-001";
  const testSchoolId = "test-school-validity-uuid-001";
  const testSubjectId = "test-subject-validity-uuid-001";
  const testUnitId = "test-unit-validity-uuid-001";
  const testTopicId = "test-topic-validity-uuid-001";
  const testQuestionId = "test-question-validity-uuid-001";
  const testOptionId = "test-option-validity-uuid-001";
  const testTestId = "test-test-validity-uuid-001";
  const testSectionId = "test-section-validity-uuid-001";
  const testAttemptId = "test-attempt-validity-uuid-001";
  const testLessonId = "test-lesson-validity-uuid-001";
  const testBadgeId = "test-badge-validity-uuid-001";
  const testStudyPlanId = "test-plan-validity-uuid-001";
  const testFlashcardId = "test-flashcard-validity-uuid-001";
  const testVideoId = "test-video-validity-uuid-001";

  // 1. User
  console.log("🔹 Testing [User]...");
  const user = await prisma.user.upsert({
    where: { id: testUserId },
    update: {
      displayName: "Test User Validation",
      email: "student@lumenacademy.in",
      phone: "+919876543210",
      passwordHash: "$2b$10$e7Z1wKqXJz9s7h4vF5wQYe2j8L0mK1nP2qR3sT4uV5wX6yZ7a8b9c",
    },
    create: {
      id: testUserId,
      email: "student@lumenacademy.in",
      phone: "+919876543210",
      passwordHash: "$2b$10$e7Z1wKqXJz9s7h4vF5wQYe2j8L0mK1nP2qR3sT4uV5wX6yZ7a8b9c",
      role: Role.STUDENT,
      locale: Locale.EN,
      targetExam: TargetExam.NEET,
      displayName: "Test User Validation",
    },
  });

  // 2. School
  console.log("🔹 Testing [School]...");
  const school = await prisma.school.upsert({
    where: { code: "VALIDITY_SCH_01" },
    update: {},
    create: {
      id: testSchoolId,
      name: "Lumen Test Academy",
      code: "VALIDITY_SCH_01",
      board: Board.CBSE,
      schoolType: SchoolType.PRIVATE,
      medium: Medium.ENGLISH,
      address: "123 Test Street",
      district: "Chennai",
      state: "Tamil Nadu",
      pincode: "600001",
      maxStudents: 500,
      plan: SchoolPlan.PREMIUM,
      status: SchoolStatus.ACTIVE,
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // 3. SchoolAdmin
  console.log("🔹 Testing [SchoolAdmin]...");
  await prisma.schoolAdmin.upsert({
    where: { id: "test-admin-uuid-001" },
    update: {},
    create: {
      id: "test-admin-uuid-001",
      schoolId: school.id,
      fullName: "Dr. Admin Test",
      designation: Designation.PRINCIPAL,
      email: "admin@testacademy.edu",
      phone: "+919876543210",
    },
  });

  // 4. StudentProfile
  console.log("🔹 Testing [StudentProfile]...");
  await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      fullName: "Test Student",
      dob: new Date("2005-05-15"),
      class: 12,
      examYear: 2026,
      phoneDisplay: "+919876543210",
      avatarUrl: "https://example.com/avatar.png",
      profileCompleted: true,
      schoolName: school.name,
      schoolId: school.id,
      state: "Tamil Nadu",
      category: ReservationCategory.GENERAL,
    },
  });

  // 5. UserPreference
  console.log("🔹 Testing [UserPreference]...");
  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      theme: Theme.DARK,
      notificationsEnabled: true,
      emailAlerts: true,
      mutePomodoroSound: false,
    },
  });

  // 6. AuditLog
  console.log("🔹 Testing [AuditLog]...");
  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: AuditAction.CREATE,
      entityType: AuditEntity.USER,
      entityId: user.id,
      metadata: { note: "Validity test audit event" },
      ipHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      userAgent: "ValidityTester/1.0",
    },
  });

  // 7. Subject
  console.log("🔹 Testing [Subject]...");
  const subject = await prisma.subject.upsert({
    where: { slug: "validity_physics" },
    update: {},
    create: {
      id: testSubjectId,
      slug: "validity_physics",
      nameEn: "Validity Test Physics",
      nameTa: "சோதனை இயற்பியல்",
      order: 99,
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN],
    },
  });

  // 8. Unit
  console.log("🔹 Testing [Unit]...");
  const unit = await prisma.unit.upsert({
    where: { slug: "validity_phy_01" },
    update: {},
    create: {
      id: testUnitId,
      slug: "validity_phy_01",
      nameEn: "Test Mechanics",
      nameTa: "இயக்கவியல்",
      order: 1,
      classLevel: 11,
      weightage: 8.5,
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN],
      subjectId: subject.id,
    },
  });

  // 9. Topic
  console.log("🔹 Testing [Topic]...");
  const topic = await prisma.topic.upsert({
    where: { slug: "validity_topic_01" },
    update: {},
    create: {
      id: testTopicId,
      slug: "validity_topic_01",
      nameEn: "Vectors and Scalars",
      nameTa: "வெக்டார்கள்",
      unitId: unit.id,
    },
  });

  // 10. Question
  console.log("🔹 Testing [Question]...");
  const question = await prisma.question.upsert({
    where: { id: testQuestionId },
    update: {},
    create: {
      id: testQuestionId,
      type: QuestionType.SINGLE_CORRECT,
      stemEn: "What is the magnitude of unit vector?",
      stemTa: "அலகு வெக்டரின் அளவு என்ன?",
      stemImageUrl: "https://example.com/vector.png",
      explanationEn: "A unit vector has a magnitude of 1 by definition.",
      explanationTa: "அலகு வெக்டரின் அளவு 1 ஆகும்.",
      marks: 4,
      negativeMarks: 1,
      difficulty: Difficulty.EASY,
      status: QStatus.PUBLISHED,
      version: 1,
      contentSchemaVersion: 1,
      contentHash: "validity-test-hash-001",
      selectionBucket: 50,
      publishedAt: new Date(),
      examTypes: [TargetExam.NEET, TargetExam.JEE_MAIN],
      source: "Validity Test Suite",
      ncertReference: "Class 11, Ch 4, p. 66",
      subjectId: subject.id,
      unitId: unit.id,
      topicId: topic.id,
    },
  });

  // 11. Option
  console.log("🔹 Testing [Option]...");
  const option = await prisma.option.upsert({
    where: { questionId_label: { questionId: question.id, label: "A" } },
    update: {},
    create: {
      id: testOptionId,
      label: "A",
      textEn: "1",
      textTa: "1",
      orderIndex: 0,
      isCorrect: true,
      questionId: question.id,
    },
  });

  // 12. Test
  console.log("🔹 Testing [Test]...");
  const test = await prisma.test.upsert({
    where: { id: testTestId },
    update: {},
    create: {
      id: testTestId,
      name: "__VALIDITY_CHECK__ Mock Exam",
      type: TestType.FULL,
      examType: TargetExam.NEET,
      isPublished: true,
      durationSeconds: 1800,
      focusUnitSlugs: [unit.slug],
      ownerUserId: user.id,
    },
  });

  // 13. TestSection
  console.log("🔹 Testing [TestSection]...");
  const testSection = await prisma.testSection.upsert({
    where: { testId_orderIndex: { testId: test.id, orderIndex: 0 } },
    update: {},
    create: {
      id: testSectionId,
      testId: test.id,
      name: "Physics Section A",
      orderIndex: 0,
      subjectId: subject.id,
      durationSeconds: 900,
    },
  });

  // 14. TestQuestion
  console.log("🔹 Testing [TestQuestion]...");
  await prisma.testQuestion.upsert({
    where: { testId_questionId: { testId: test.id, questionId: question.id } },
    update: {},
    create: {
      testId: test.id,
      sectionId: testSection.id,
      questionId: question.id,
      orderIndex: 0,
    },
  });

  // 15. Attempt
  console.log("🔹 Testing [Attempt]...");
  const attempt = await prisma.attempt.upsert({
    where: { id: testAttemptId },
    update: {},
    create: {
      id: testAttemptId,
      userId: user.id,
      testId: test.id,
      status: AttemptStatus.SUBMITTED,
      startedAt: new Date(Date.now() - 100000),
      durationSeconds: 1800,
      deadlineAt: new Date(Date.now() + 1700000),
      submittedAt: new Date(),
      score: 4,
      maxScore: 4,
      correctCount: 1,
      wrongCount: 0,
      skippedCount: 0,
      accuracy: 100,
      percentile: 99.9,
      predictedAirRank: 15,
      sectionBreakdownJson: [{ sectionName: "Physics Section A", accuracy: 100 }],
      unitBreakdownJson: [{ unitSlug: unit.slug, accuracy: 100 }],
    },
  });

  // 16. AttemptSection
  console.log("🔹 Testing [AttemptSection]...");
  await prisma.attemptSection.upsert({
    where: { attemptId_sectionId: { attemptId: attempt.id, sectionId: testSection.id } },
    update: {},
    create: {
      attemptId: attempt.id,
      sectionId: testSection.id,
      startedAt: new Date(Date.now() - 100000),
      deadlineAt: new Date(Date.now() + 800000),
      lockedAt: new Date(),
    },
  });

  // 17. AttemptQuestion
  console.log("🔹 Testing [AttemptQuestion]...");
  await prisma.attemptQuestion.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
    update: {},
    create: {
      attemptId: attempt.id,
      questionId: question.id,
      sectionId: testSection.id,
      position: 1,
      optionOrder: [option.id],
      chosenOptionIds: [option.id],
      contentSnapshot: { stem: question.stemEn },
      questionVersionSnapshot: 1,
      correctOptionIdsSnapshot: [option.id],
      marksSnapshot: 4,
      negativeMarksSnapshot: 1,
      isCorrect: true,
      marksAwarded: 4,
      timeSpentMs: 45000,
    },
  });

  // 18. AiExplanationCache
  console.log("🔹 Testing [AiExplanationCache]...");
  await prisma.aiExplanationCache.upsert({
    where: { questionId_language: { questionId: question.id, language: Locale.EN } },
    update: {},
    create: {
      questionId: question.id,
      language: Locale.EN,
      text: "Detailed AI physics explanation for vector unit magnitude.",
      model: "gemini-1.5-pro",
      promptVersion: "v1.2",
    },
  });

  // 19. UnitMastery
  console.log("🔹 Testing [UnitMastery]...");
  await prisma.unitMastery.upsert({
    where: { userId_unitId: { userId: user.id, unitId: unit.id } },
    update: {},
    create: {
      userId: user.id,
      unitId: unit.id,
      attempted: 1,
      correct: 1,
      wrong: 0,
      accuracy: 100,
      lastAttemptedAt: new Date(),
    },
  });

  // 20. Streak
  console.log("🔹 Testing [Streak]...");
  await prisma.streak.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      currentStreak: 5,
      longestStreak: 12,
      lastActivityDate: new Date(),
    },
  });

  // 21. Badge & 22. UserBadge
  console.log("🔹 Testing [Badge & UserBadge]...");
  const badge = await prisma.badge.upsert({
    where: { id: testBadgeId },
    update: {},
    create: {
      id: testBadgeId,
      name: "Physics Wizard",
      description: "Scored 100% in a Physics module",
      icon: "⚡",
      conditionType: BadgeCondition.ACCURACY_GTE,
      conditionValue: 100,
    },
  });

  await prisma.userBadge.upsert({
    where: { userId_badgeId: { userId: user.id, badgeId: badge.id } },
    update: {},
    create: {
      userId: user.id,
      badgeId: badge.id,
      awardedAt: new Date(),
    },
  });

  // 23. DailyGoal
  console.log("🔹 Testing [DailyGoal]...");
  await prisma.dailyGoal.upsert({
    where: { userId_date: { userId: user.id, date: new Date() } },
    update: {},
    create: {
      userId: user.id,
      goalText: "Complete 1 Validity Physics Test",
      date: new Date(),
    },
  });

  // 24. Notification
  console.log("🔹 Testing [Notification]...");
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: NotificationType.BADGE_AWARDED,
      message: "Congratulations! You unlocked the Physics Wizard badge.",
    },
  });

  // 25. PomodoroSession
  console.log("🔹 Testing [PomodoroSession]...");
  await prisma.pomodoroSession.create({
    data: {
      userId: user.id,
      subjectId: subject.id,
      mode: PomodoroMode.FOCUS,
      goalText: "Study Vector Algebra",
      plannedSeconds: 1500,
      actualSeconds: 1500,
      startedAt: new Date(Date.now() - 1500000),
      finishedAt: new Date(),
    },
  });

  // 26. StudyPlan & 27. StudyPlanChapter
  console.log("🔹 Testing [StudyPlan & StudyPlanChapter]...");
  const studyPlan = await prisma.studyPlan.upsert({
    where: { id: testStudyPlanId },
    update: {},
    create: {
      id: testStudyPlanId,
      userId: user.id,
      examYear: 2026,
      currentScore: 520,
      targetScore: 680,
      timetableJson: { week1: "Vectors & Kinematics" },
      isActive: true,
    },
  });

  await prisma.studyPlanChapter.upsert({
    where: { planId_unitId: { planId: studyPlan.id, unitId: unit.id } },
    update: {},
    create: {
      planId: studyPlan.id,
      unitId: unit.id,
      targetHours: 10,
      completed: true,
      completedAt: new Date(),
    },
  });

  // 28. RevisionNote
  console.log("🔹 Testing [RevisionNote]...");
  await prisma.revisionNote.create({
    data: {
      userId: user.id,
      subjectId: subject.id,
      title: "Vector Formula Sheet",
      content: "# Dot Product\nA · B = |A||B| cos(θ)",
    },
  });

  // 29. Flashcard & 30. UserFlashcardDaily
  console.log("🔹 Testing [Flashcard & UserFlashcardDaily]...");
  const flashcard = await prisma.flashcard.upsert({
    where: { id: testFlashcardId },
    update: {},
    create: {
      id: testFlashcardId,
      subjectId: subject.id,
      concept: "Unit Vector",
      explanation: "A vector of magnitude 1 pointing in a given direction.",
    },
  });

  await prisma.userFlashcardDaily.upsert({
    where: { userId_shownDate: { userId: user.id, shownDate: new Date() } },
    update: {},
    create: {
      userId: user.id,
      flashcardId: flashcard.id,
      shownDate: new Date(),
    },
  });

  // 31. Lesson, 32. LessonVideo, 33. VideoTimestamp, 34. LessonResource, 35. LessonProgress, 36. Bookmark
  console.log("🔹 Testing [LMS Models: Lesson, LessonVideo, VideoTimestamp, LessonResource, LessonProgress, Bookmark]...");
  const lesson = await prisma.lesson.upsert({
    where: { id: testLessonId },
    update: {},
    create: {
      id: testLessonId,
      unitId: unit.id,
      nameEn: "Introduction to Vectors",
      nameTa: "வெக்டார்கள் அறிமுகம்",
      overviewEn: "Overview of vector addition and dot product.",
      keyTakeaways: "Vectors have magnitude and direction.",
      ncertNotes: "NCERT Class 11 Physics Chapter 4",
      orderIndex: 1,
    },
  });

  const lessonVideo = await prisma.lessonVideo.upsert({
    where: { id: testVideoId },
    update: {},
    create: {
      id: testVideoId,
      lessonId: lesson.id,
      language: Locale.EN,
      youtubeId: "dQw4w9WgXcQ",
      title: "Vector Lecture 1",
      durationSeconds: 600,
    },
  });

  await prisma.videoTimestamp.create({
    data: {
      videoId: lessonVideo.id,
      label: "Vector Components",
      seconds: 120,
    },
  });

  await prisma.lessonResource.create({
    data: {
      lessonId: lesson.id,
      titleEn: "Vectors Formula Summary PDF",
      titleTa: "சூத்திரங்கள் PDF",
      fileUrl: "https://example.com/vectors.pdf",
      type: ResourceType.PDF,
    },
  });

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    update: {},
    create: {
      userId: user.id,
      lessonId: lesson.id,
      watchPercent: 100,
      completed: true,
      completedAt: new Date(),
    },
  });

  await prisma.bookmark.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
    update: {},
    create: {
      userId: user.id,
      lessonId: lesson.id,
    },
  });

  console.log("\n🎉 ALL 36 PRISMA MODELS INSERTED & VALIDATED SUCCESSFULLY!\n");

  const counts = {
    User: await prisma.user.count(),
    StudentProfile: await prisma.studentProfile.count(),
    UserPreference: await prisma.userPreference.count(),
    AuditLog: await prisma.auditLog.count(),
    Subject: await prisma.subject.count(),
    Unit: await prisma.unit.count(),
    Topic: await prisma.topic.count(),
    Question: await prisma.question.count(),
    Option: await prisma.option.count(),
    Test: await prisma.test.count(),
    TestSection: await prisma.testSection.count(),
    TestQuestion: await prisma.testQuestion.count(),
    Attempt: await prisma.attempt.count(),
    AttemptSection: await prisma.attemptSection.count(),
    AttemptQuestion: await prisma.attemptQuestion.count(),
    AiExplanationCache: await prisma.aiExplanationCache.count(),
    UnitMastery: await prisma.unitMastery.count(),
    Streak: await prisma.streak.count(),
    Badge: await prisma.badge.count(),
    UserBadge: await prisma.userBadge.count(),
    DailyGoal: await prisma.dailyGoal.count(),
    Notification: await prisma.notification.count(),
    PomodoroSession: await prisma.pomodoroSession.count(),
    StudyPlan: await prisma.studyPlan.count(),
    StudyPlanChapter: await prisma.studyPlanChapter.count(),
    RevisionNote: await prisma.revisionNote.count(),
    Flashcard: await prisma.flashcard.count(),
    UserFlashcardDaily: await prisma.userFlashcardDaily.count(),
    Lesson: await prisma.lesson.count(),
    LessonVideo: await prisma.lessonVideo.count(),
    VideoTimestamp: await prisma.videoTimestamp.count(),
    LessonResource: await prisma.lessonResource.count(),
    LessonProgress: await prisma.lessonProgress.count(),
    Bookmark: await prisma.bookmark.count(),
    School: await prisma.school.count(),
    SchoolAdmin: await prisma.schoolAdmin.count(),
  };

  console.log("📊 Model Record Count Verification Report:");
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((err) => {
    console.error("❌ Verification failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
