import pptxgen from "pptxgenjs";

const pptx = new pptxgen();

// Set presentation properties
pptx.title = "Lumen Academy Database Schema Architecture";
pptx.subject = "Database Schema & Architecture Overview";
pptx.author = "Antigravity AI / Lumen Academy Engineering";
pptx.company = "Lumen Academy";
pptx.layout = "LAYOUT_16x9";

// Define Color Palette
const COLORS = {
  NAVY: "1C2B4A",
  BLUE_HEADER: "2563EB",
  EMERALD: "059669",
  ACCENT_GOLD: "D97706",
  DARK_TEXT: "1F2937",
  LIGHT_BG: "F8FAFC",
  WHITE: "FFFFFF",
  CARD_BG: "EFF6FF",
  CARD_BORDER: "BFDBFE",
  MUTED: "64748B",
};

function addHeader(slide, titleText, subtitleText) {
  // Top Banner
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 1.1,
    fill: { color: COLORS.NAVY },
    line: { color: COLORS.NAVY },
  });

  slide.addText(titleText, {
    x: 0.6,
    y: 0.2,
    w: 12,
    h: 0.45,
    fontSize: 24,
    bold: true,
    color: COLORS.WHITE,
  });

  if (subtitleText) {
    slide.addText(subtitleText, {
      x: 0.6,
      y: 0.65,
      w: 12,
      h: 0.35,
      fontSize: 14,
      color: "94A3B8",
    });
  }
}

function addFooter(slide, currentSlide, totalSlides = 10) {
  slide.addText(`Lumen Academy Database Architecture  |  Slide ${currentSlide} of ${totalSlides}`, {
    x: 0.6,
    y: 7.1,
    w: 12,
    h: 0.3,
    fontSize: 10,
    color: COLORS.MUTED,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1: Title Slide
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  // Background
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 7.5,
    fill: { color: COLORS.NAVY },
  });

  slide.addText("🏛️ Lumen Academy", {
    x: 1.0,
    y: 1.8,
    w: 11.33,
    h: 0.6,
    fontSize: 22,
    color: COLORS.ACCENT_GOLD,
    bold: true,
  });

  slide.addText("Database Schema & System Architecture", {
    x: 1.0,
    y: 2.5,
    w: 11.33,
    h: 1.2,
    fontSize: 38,
    color: COLORS.WHITE,
    bold: true,
  });

  slide.addText("Comprehensive Architecture Guide for NTA NEET & JEE Exam Prep Platform", {
    x: 1.0,
    y: 3.8,
    w: 11.33,
    h: 0.6,
    fontSize: 18,
    color: "CBD5E1",
  });

  // Pill badges
  const techBadges = ["PostgreSQL 16 (Supabase)", "Prisma ORM v6.14", "36 Models", "11 Domain Modules"];
  techBadges.forEach((badge, idx) => {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 1.0 + idx * 2.8,
      y: 5.2,
      w: 2.6,
      h: 0.5,
      fill: { color: "2B3F66" },
      line: { color: "3B82F6", width: 1 },
      rectRadius: 0.1,
    });
    slide.addText(badge, {
      x: 1.0 + idx * 2.8,
      y: 5.2,
      w: 2.6,
      h: 0.5,
      fontSize: 11,
      color: COLORS.WHITE,
      align: "center",
      bold: true,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2: Core Design Philosophy
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addHeader(slide, "1. Core Design Laws & Architectural Principles", "Enforced constraints at the database schema layer");
  addFooter(slide, 2);

  const pillars = [
    { title: "🔒 Zero-Leak Security", text: "Scoring keys and correct choices are strictly server-only until attempt submission." },
    { title: "🕒 Server Clock Control", text: "Server owns exam deadlines & sectional timing. Client clocks are strictly un-trusted." },
    { title: "🛡️ IDOR-Proof Access", text: "Every student-owned entity carries or joins on userId for explicit authorization." },
    { title: "🧊 Immutable Result Freeze", text: "Attempt rows snapshot question content and answer keys at submit time (Law 4)." },
  ];

  pillars.forEach((p, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const xPos = 0.8 + col * 5.9;
    const yPos = 1.6 + row * 2.6;

    slide.addShape(pptx.ShapeType.roundRect, {
      x: xPos,
      y: yPos,
      w: 5.6,
      h: 2.3,
      fill: { color: COLORS.CARD_BG },
      line: { color: COLORS.CARD_BORDER, width: 1.5 },
      rectRadius: 0.15,
    });

    slide.addText(p.title, {
      x: xPos + 0.3,
      y: yPos + 0.3,
      w: 5.0,
      h: 0.4,
      fontSize: 18,
      bold: true,
      color: COLORS.BLUE_HEADER,
    });

    slide.addText(p.text, {
      x: xPos + 0.3,
      y: yPos + 0.8,
      w: 5.0,
      h: 1.2,
      fontSize: 14,
      color: COLORS.DARK_TEXT,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3: 11 Domain Modules Overview
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addHeader(slide, "2. 11 Core Domain Modules Overview", "Complete application layout across 36 Prisma database models");
  addFooter(slide, 3);

  const modules = [
    { num: "01", name: "Identity & Profile", desc: "User, StudentProfile, Preferences, AuditLog" },
    { num: "02", name: "Syllabus Taxonomy", desc: "Subject, Unit, Topic" },
    { num: "03", name: "Question Bank", desc: "Question, Option (5 Interaction Types)" },
    { num: "04", name: "Tests (Templates)", desc: "Test, TestSection, TestQuestion" },
    { num: "05", name: "Attempt Engine", desc: "Attempt, AttemptSection, AttemptQuestion" },
    { num: "06", name: "AI Explanation Cache", desc: "AiExplanationCache" },
    { num: "07", name: "Analytics Rollup", desc: "UnitMastery (Accuracy & Weak Chapters)" },
    { num: "08", name: "Gamification", desc: "Streak, Badge, UserBadge, DailyGoal, Notifications" },
    { num: "09", name: "Study Tools", desc: "PomodoroSession, StudyPlan, Flashcards, RevisionNotes" },
    { num: "10", name: "LMS Content", desc: "Lesson, LessonVideo, LessonResource, Bookmark" },
    { num: "11", name: "Institutions (B2B)", desc: "School, SchoolAdmin" },
  ];

  modules.forEach((mod, idx) => {
    const col = Math.floor(idx / 4);
    const row = idx % 4;
    const xPos = 0.6 + col * 4.1;
    const yPos = 1.5 + row * 1.35;

    slide.addShape(pptx.ShapeType.roundRect, {
      x: xPos,
      y: yPos,
      w: 3.9,
      h: 1.2,
      fill: { color: COLORS.LIGHT_BG },
      line: { color: "CBD5E1", width: 1 },
      rectRadius: 0.1,
    });

    slide.addText(`${mod.num}. ${mod.name}`, {
      x: xPos + 0.2,
      y: yPos + 0.15,
      w: 3.5,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: COLORS.NAVY,
    });

    slide.addText(mod.desc, {
      x: xPos + 0.2,
      y: yPos + 0.55,
      w: 3.5,
      h: 0.5,
      fontSize: 11,
      color: COLORS.MUTED,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4: Identity & Profile Module
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addHeader(slide, "3. Module 1: Identity, Security & Profiles", "User management, Supabase Auth integration, and NTA reservation categories");
  addFooter(slide, 4);

  // Column 1: Table Details
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 1.6,
    w: 5.6,
    h: 5.0,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 1 },
    rectRadius: 0.15,
  });

  slide.addText("User & Profile Model Fields", {
    x: 1.1,
    y: 1.8,
    w: 5.0,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: COLORS.BLUE_HEADER,
  });

  const fieldsText = [
    "• User.id: Primary key matching Supabase auth.users.id",
    "• User.email: Unique user email address",
    "• User.phone: Contact phone number",
    "• User.passwordHash: Hashed credential string",
    "• User.role: STUDENT | FACULTY | ADMIN",
    "• StudentProfile.class: Class 11 or 12",
    "• StudentProfile.examYear: 2026 / 2027",
    "• StudentProfile.category: GENERAL | EWS | OBC_NCL | SC | ST",
    "• AuditLog: Security trail with hashed IPs",
  ].join("\n");

  slide.addText(fieldsText, {
    x: 1.1,
    y: 2.3,
    w: 5.0,
    h: 4.0,
    fontSize: 13,
    color: COLORS.DARK_TEXT,
    lineSpacing: 20,
  });

  // Column 2: Rank Predictor Card
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 6.8,
    y: 1.6,
    w: 5.7,
    h: 5.0,
    fill: { color: "ECFDF5" },
    line: { color: "A7F3D0", width: 1 },
    rectRadius: 0.15,
  });

  slide.addText("🎯 AIR Rank Predictor Inputs", {
    x: 7.1,
    y: 1.8,
    w: 5.0,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: COLORS.EMERALD,
  });

  const rankText = [
    "NTA Exam Rank Calculation Factors:",
    "",
    "1. Reservation Category:",
    "   Maps to NTA cutoffs (General, EWS, OBC-NCL, SC, ST).",
    "",
    "2. Home State:",
    "   Powers state counselling & home-state quota prediction.",
    "",
    "3. Target Exam:",
    "   NEET, JEE Main, or JEE Advanced dashboard mode.",
  ].join("\n");

  slide.addText(rankText, {
    x: 7.1,
    y: 2.3,
    w: 5.1,
    h: 4.0,
    fontSize: 13,
    color: COLORS.DARK_TEXT,
    lineSpacing: 18,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5: Question Bank & Review Pipeline
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addHeader(slide, "4. Module 3: Question Bank & Review Lifecycle", "Support for 5 NEET/JEE interaction formats and editorial publishing pipeline");
  addFooter(slide, 5);

  // 5 Question Types Table
  const rows = [
    [{ text: "Question Type", options: { bold: true, fill: COLORS.NAVY, color: COLORS.WHITE } },
     { text: "Supported Exams", options: { bold: true, fill: COLORS.NAVY, color: COLORS.WHITE } },
     { text: "Grading Mechanism", options: { bold: true, fill: COLORS.NAVY, color: COLORS.WHITE } }],

    [{ text: "SINGLE_CORRECT" }, { text: "NEET, JEE Main, JEE Adv" }, { text: "Graded against Option.isCorrect" }],
    [{ text: "MULTIPLE_CORRECT" }, { text: "JEE Advanced" }, { text: "Partial / All-or-Nothing scoring config" }],
    [{ text: "NUMERICAL" }, { text: "JEE Main, JEE Adv" }, { text: "Graded within numericalTolerance" }],
    [{ text: "MATCHING" }, { text: "JEE Advanced" }, { text: "Structured left/right item mapping" }],
    [{ text: "ASSERTION_REASON" }, { text: "JEE Advanced" }, { text: "Assertion & Reason pair evaluation" }],
  ];

  slide.addTable(rows, {
    x: 0.8,
    y: 1.6,
    w: 11.7,
    colW: [2.5, 3.2, 6.0],
    fontSize: 12,
    border: { pt: 1, color: "CBD5E1" },
  });

  // Review Pipeline Banner
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 4.8,
    w: 11.7,
    h: 1.8,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 1 },
    rectRadius: 0.1,
  });

  slide.addText("Editorial Quality Pipeline (DRAFT → PENDING_REVIEW → PUBLISHED)", {
    x: 1.0,
    y: 5.0,
    w: 11.3,
    h: 0.35,
    fontSize: 16,
    bold: true,
    color: COLORS.BLUE_HEADER,
  });

  slide.addText(
    "Questions written by faculty or drafted by AI pass through an automated critic verdict (criticVerdict) and human review before reaching PUBLISHED status. RETIRED questions remain in database so historical student attempt reports never dangle.",
    {
      x: 1.0,
      y: 5.4,
      w: 11.3,
      h: 1.0,
      fontSize: 12,
      color: COLORS.DARK_TEXT,
    }
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6: Assessment & Attempt Engine
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addHeader(slide, "5. Module 4 & 5: Assessment & Attempt Engine", "Test templates, sectional clock enforcement, and autosave loop");
  addFooter(slide, 6);

  const boxes = [
    {
      title: "📋 Test Templates (Test)",
      bullets: [
        "Types: FULL, SUBJECT, CUSTOM, AI_REVISION, PYQ",
        "Overall duration limit (durationSeconds)",
        "Sectional breakdown (TestSection)",
      ],
    },
    {
      title: "⏱️ Sectional Timing (AttemptSection)",
      bullets: [
        "Independent section deadlineAt clocks",
        "Per-section lock enforcement (lockedAt)",
        "Crucial for JEE sectional time limits",
      ],
    },
    {
      title: "💾 Resilient Autosave Loop",
      bullets: [
        "AttemptQuestion incremental upserts",
        "Shuffled option order per student (optionOrder)",
        "Mobile & poor-connectivity friendly",
      ],
    },
  ];

  boxes.forEach((b, idx) => {
    const xPos = 0.8 + idx * 3.95;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: xPos,
      y: 1.6,
      w: 3.7,
      h: 5.0,
      fill: { color: COLORS.LIGHT_BG },
      line: { color: "CBD5E1", width: 1.5 },
      rectRadius: 0.15,
    });

    slide.addText(b.title, {
      x: xPos + 0.2,
      y: 1.9,
      w: 3.3,
      h: 0.5,
      fontSize: 16,
      bold: true,
      color: COLORS.NAVY,
    });

    const bText = b.bullets.map((txt) => `• ${txt}`).join("\n\n");
    slide.addText(bText, {
      x: xPos + 0.2,
      y: 2.6,
      w: 3.3,
      h: 3.6,
      fontSize: 13,
      color: COLORS.DARK_TEXT,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7: Scoring & Immutable Result Freeze (Law 4)
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addHeader(slide, "6. Law 4: Immutable Result Snapshotting", "Freezing answer keys at submit time so historical attempts never change");
  addFooter(slide, 7);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 1.6,
    w: 11.7,
    h: 5.0,
    fill: { color: "FFFBEB" },
    line: { color: "FCD34D", width: 1.5 },
    rectRadius: 0.15,
  });

  slide.addText("🧊 How Law 4 Prevents Historical Result Corruption", {
    x: 1.1,
    y: 1.9,
    w: 11.1,
    h: 0.4,
    fontSize: 20,
    bold: true,
    color: COLORS.ACCENT_GOLD,
  });

  const lawText = [
    "When a student submits an attempt, the scoring transaction creates a frozen snapshot inside AttemptQuestion:",
    "",
    "1. Snapshot Fields Captured:",
    "   • contentSnapshot: Copy of stem, diagrams, and options displayed to the student.",
    "   • correctOptionIdsSnapshot / correctNumericalAnswerSnapshot: Frozen answer key.",
    "   • marksSnapshot / negativeMarksSnapshot: Marking scheme active at submit time.",
    "   • answerKeySnapshot: Frozen JSON contract for structured JEE matching questions.",
    "",
    "2. Business Guarantee:",
    "   If a question typo is corrected in June, a student who took the test in March will STILL see their exact historical score, question text, and answer key unaltered.",
  ].join("\n");

  slide.addText(lawText, {
    x: 1.1,
    y: 2.5,
    w: 11.1,
    h: 3.8,
    fontSize: 14,
    color: COLORS.DARK_TEXT,
    lineSpacing: 16,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8: LMS, Gamification & Study Tools
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addHeader(slide, "7. Modules 8, 9 & 10: LMS, Gamification & Tools", "Enhancing student retention through video lessons, streaks, and focus tools");
  addFooter(slide, 8);

  const sections = [
    {
      title: "📚 LMS & Content (Module 10)",
      bullets: [
        "Lesson: Video & text content by Unit",
        "LessonVideo: YouTube ID & duration",
        "VideoTimestamp: Key topic bookmarks",
        "LessonResource: Downloadable PDFs",
        "LessonProgress: Watch percentage",
      ],
    },
    {
      title: "⚡ Gamification (Module 8)",
      bullets: [
        "Streak: Consecutive daily study days",
        "Badge & UserBadge: Performance awards",
        "DailyGoal: Daily target completion",
        "Notification: In-app & push alert queue",
        "UnitMastery: Chapter accuracy radar",
      ],
    },
    {
      title: "⏱️ Productivity Tools (Module 9)",
      bullets: [
        "PomodoroSession: Focus & break timer",
        "StudyPlan: AI weekly schedule",
        "RevisionNote: Custom study notes",
        "Flashcard & Daily: Spaced repetition",
        "Bookmark: Saved lessons list",
      ],
    },
  ];

  sections.forEach((s, idx) => {
    const xPos = 0.8 + idx * 3.95;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: xPos,
      y: 1.6,
      w: 3.7,
      h: 5.0,
      fill: { color: COLORS.CARD_BG },
      line: { color: COLORS.CARD_BORDER, width: 1 },
      rectRadius: 0.15,
    });

    slide.addText(s.title, {
      x: xPos + 0.2,
      y: 1.85,
      w: 3.3,
      h: 0.45,
      fontSize: 15,
      bold: true,
      color: COLORS.BLUE_HEADER,
    });

    const sText = s.bullets.map((b) => `• ${b}`).join("\n\n");
    slide.addText(sText, {
      x: xPos + 0.2,
      y: 2.45,
      w: 3.3,
      h: 3.9,
      fontSize: 12,
      color: COLORS.DARK_TEXT,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9: B2B Institution Layer
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addHeader(slide, "8. Module 11: Institutional B2B Architecture", "School onboarding, administrative access, and B2C vs B2B dual student models");
  addFooter(slide, 9);

  // Box 1: Dual Onboarding Model
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 1.6,
    w: 5.6,
    h: 5.0,
    fill: { color: COLORS.LIGHT_BG },
    line: { color: "CBD5E1", width: 1 },
    rectRadius: 0.15,
  });

  slide.addText("🏫 Dual Student Model (B2C & B2B)", {
    x: 1.1,
    y: 1.9,
    w: 5.0,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: COLORS.NAVY,
  });

  const b2bText = [
    "• Retail (B2C) Student:",
    "  Fills schoolName as free-text; schoolId remains null.",
    "",
    "• Institutional (B2B) Student:",
    "  Linked via schoolId FK to an onboarded School row.",
    "",
    "• Shared Display:",
    "  schoolName is kept in sync on StudentProfile so UI screens render instantly without joining.",
  ].join("\n");

  slide.addText(b2bText, {
    x: 1.1,
    y: 2.5,
    w: 5.0,
    h: 3.8,
    fontSize: 13,
    color: COLORS.DARK_TEXT,
    lineSpacing: 14,
  });

  // Box 2: School Licensing & Plans
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 6.8,
    y: 1.6,
    w: 5.7,
    h: 5.0,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 1 },
    rectRadius: 0.15,
  });

  slide.addText("📋 School Subscription & Status", {
    x: 7.1,
    y: 1.9,
    w: 5.0,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: COLORS.BLUE_HEADER,
  });

  const planText = [
    "• School Entity Fields:",
    "  code (unique ID, e.g. CPS001), district, state, board (CBSE/ICSE/State Board), maxStudents.",
    "",
    "• Plan Levels:",
    "  BASIC | STANDARD | PREMIUM",
    "",
    "• Status Lifecycle:",
    "  TRIAL → ACTIVE → SUSPENDED → CANCELLED",
    "",
    "• SchoolAdmin Contact:",
    "  Tracks Principal / Administrator contact details.",
  ].join("\n");

  slide.addText(planText, {
    x: 7.1,
    y: 2.5,
    w: 5.1,
    h: 3.8,
    fontSize: 13,
    color: COLORS.DARK_TEXT,
    lineSpacing: 14,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10: Developer Operations & Commands
// ═══════════════════════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  addHeader(slide, "9. Developer Operations & Database Tooling", "CLI commands for schema validation, migration, seeding, and verification");
  addFooter(slide, 10);

  const cmdRows = [
    [{ text: "Command", options: { bold: true, fill: COLORS.NAVY, color: COLORS.WHITE } },
     { text: "Script Execution", options: { bold: true, fill: COLORS.NAVY, color: COLORS.WHITE } },
     { text: "Purpose & Role", options: { bold: true, fill: COLORS.NAVY, color: COLORS.WHITE } }],

    [{ text: "npm run db:validate" }, { text: "prisma validate --schema ./schema6.prisma" }, { text: "Validates Prisma schema syntax & relation constraints" }],
    [{ text: "npm run db:generate" }, { text: "prisma generate --schema ./schema6.prisma" }, { text: "Generates type-safe @prisma/client TypeScript definitions" }],
    [{ text: "npm run db:seed" }, { text: "tsx prisma/seed.ts" }, { text: "Seeds NEET & JEE subjects, topics, and demo tests" }],
    [{ text: "npm run db:verify-all" }, { text: "tsx prisma/verify-all-models.ts" }, { text: "Populates & tests all 36 Prisma models for schema validity" }],
    [{ text: "npm run db:studio" }, { text: "prisma studio --schema ./schema6.prisma" }, { text: "Opens interactive visual GUI inspector at http://localhost:5555" }],
    [{ text: "npm run typecheck" }, { text: "tsc --noEmit" }, { text: "Executes TypeScript compilation check across all project files" }],
  ];

  slide.addTable(cmdRows, {
    x: 0.8,
    y: 1.6,
    w: 11.7,
    colW: [2.5, 4.2, 5.0],
    fontSize: 11,
    border: { pt: 1, color: "CBD5E1" },
  });

  // Summary box at bottom
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 5.6,
    w: 11.7,
    h: 1.2,
    fill: { color: "ECFDF5" },
    line: { color: "A7F3D0", width: 1 },
    rectRadius: 0.1,
  });

  slide.addText("🚀 Production Verification Passed", {
    x: 1.0,
    y: 5.75,
    w: 11.3,
    h: 0.3,
    fontSize: 15,
    bold: true,
    color: COLORS.EMERALD,
  });

  slide.addText("All 36 Prisma models and relations are 100% validated on PostgreSQL 16 (Supabase) with zero typecheck errors.", {
    x: 1.0,
    y: 6.1,
    w: 11.3,
    h: 0.5,
    fontSize: 12,
    color: COLORS.DARK_TEXT,
  });
}

// Write presentation to file
const outputPath = "Lumen_Academy_Database_Schema_Presentation.pptx";
await pptx.writeFile({ fileName: outputPath });
console.log(`🎉 Presentation generated successfully at: ${outputPath}`);
