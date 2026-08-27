import PDFDocument from "pdfkit";
import { prisma } from "../lib/db.js";
import { getResult, type AttemptResult, type ResultQuestion } from "./attempt.service.js";

const COLOR_NAVY = "#00243B";
const COLOR_TEAL = "#115D75";
const COLOR_GOLD = "#FCB824";
const COLOR_TEXT = "#1f2937";
const COLOR_MUTED = "#64748b";

type Locale = "en" | "ta";

function renderPdfToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
  doc.rect(doc.page.margins.left, doc.page.margins.top, doc.page.width - doc.page.margins.left - doc.page.margins.right, 60).fill(COLOR_NAVY);

  doc
    .fillColor(COLOR_GOLD)
    .fontSize(16)
    .text("LUMEN ACADEMY", doc.page.margins.left + 16, doc.page.margins.top + 12, { continued: false });

  doc
    .fillColor("#ffffff")
    .fontSize(11)
    .text(title, doc.page.margins.left + 16, doc.page.margins.top + 34);

  doc.moveDown(2.5);
  doc.fillColor(COLOR_MUTED).fontSize(9).text(subtitle, { align: "left" });
  doc.moveDown(1);
  doc
    .strokeColor(COLOR_TEAL)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(1);
  doc.fillColor(COLOR_TEXT);
}

function questionStem(q: ResultQuestion, locale: Locale): string {
  return (locale === "ta" ? q.stemTa : null) ?? q.stemEn;
}

function optionText(option: { textEn: string; textTa: string | null }, locale: Locale): string {
  return (locale === "ta" ? option.textTa : null) ?? option.textEn;
}

function explanationText(q: ResultQuestion, locale: Locale): string | null {
  return (locale === "ta" ? q.explanationTa : null) ?? q.explanationEn;
}

function isWrong(q: ResultQuestion): boolean {
  if (q.selectedOptionId === null) return false;
  const option = q.options.find((o) => o.id === q.selectedOptionId);
  return option ? !option.isCorrect : false;
}

function drawQuestionBlock(
  doc: PDFKit.PDFDocument,
  index: number,
  q: ResultQuestion,
  locale: Locale,
  opts: { revealAnswer: boolean }
): void {
  doc.fontSize(9).fillColor(COLOR_TEAL).text(`${q.subject} • ${q.unit}`);
  doc
    .fontSize(11)
    .fillColor(COLOR_TEXT)
    .text(`Q${index + 1}. ${questionStem(q, locale)}`, { paragraphGap: 4 });

  const sortedOptions = q.options.slice().sort((a, b) => a.label.localeCompare(b.label));
  for (const option of sortedOptions) {
    const marker = opts.revealAnswer && option.isCorrect ? " (Correct)" : "";
    const color = opts.revealAnswer && option.isCorrect ? COLOR_TEAL : COLOR_TEXT;
    doc.fontSize(10).fillColor(color).text(`   ${option.label}. ${optionText(option, locale)}${marker}`);
  }

  if (opts.revealAnswer) {
    const explanation = explanationText(q, locale);
    if (explanation) {
      doc.fontSize(9).fillColor(COLOR_MUTED).text(`   Explanation: ${explanation}`, { paragraphGap: 8 });
    }
  }

  doc.moveDown(0.75);
}

export async function buildQuestionPaperPdf(result: AttemptResult, locale: Locale): Promise<Buffer> {
  return renderPdfToBuffer((doc) => {
    drawHeader(doc, "Question Paper", `${result.questions.length} questions • No answers marked`);
    result.questions.forEach((q, index) => drawQuestionBlock(doc, index, q, locale, { revealAnswer: false }));
  });
}

export async function buildAnswerKeyPdf(result: AttemptResult, locale: Locale): Promise<Buffer> {
  return renderPdfToBuffer((doc) => {
    drawHeader(doc, "Answer Key", `${result.questions.length} questions • Correct options marked`);
    result.questions.forEach((q, index) => drawQuestionBlock(doc, index, q, locale, { revealAnswer: true }));
  });
}

export async function buildReportPdf(result: AttemptResult, locale: Locale): Promise<Buffer> {
  return renderPdfToBuffer((doc) => {
    drawHeader(doc, "Performance Report", `Attempt ${result.id} • ${result.status}`);

    // Score summary
    doc.fontSize(13).fillColor(COLOR_NAVY).text("Score Summary", { underline: false });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor(COLOR_TEXT)
      .text(`Score: ${result.score ?? 0} / ${result.maxScore ?? 0}`)
      .text(`Correct: ${result.correctCount ?? 0}`)
      .text(`Wrong: ${result.wrongCount ?? 0}`)
      .text(`Skipped: ${result.skippedCount ?? 0}`);
    doc.moveDown(1);

    // Per-unit accuracy
    doc.fontSize(13).fillColor(COLOR_NAVY).text("Per-Unit Accuracy");
    doc.moveDown(0.3);
    const byUnit = new Map<string, { correct: number; total: number }>();
    for (const q of result.questions) {
      const entry = byUnit.get(q.unit) ?? { correct: 0, total: 0 };
      entry.total += 1;
      const option = q.options.find((o) => o.id === q.selectedOptionId);
      if (option?.isCorrect) entry.correct += 1;
      byUnit.set(q.unit, entry);
    }
    for (const [unit, stats] of byUnit) {
      const pct = Math.round((stats.correct / stats.total) * 100);
      doc.fontSize(10).fillColor(COLOR_TEXT).text(`${unit}: ${stats.correct}/${stats.total} (${pct}%)`);
    }
    doc.moveDown(1);

    // Time analysis
    doc.fontSize(13).fillColor(COLOR_NAVY).text("Time Analysis");
    doc.moveDown(0.3);
    const totalTimeMs = result.questions.reduce((sum, q) => sum + (q.timeSpentMs ?? 0), 0);
    const avgTimeSeconds = result.questions.length > 0 ? Math.round(totalTimeMs / result.questions.length / 1000) : 0;
    doc
      .fontSize(10)
      .fillColor(COLOR_TEXT)
      .text(`Total time: ${Math.round(totalTimeMs / 1000 / 60)} minutes`)
      .text(`Average time per question: ${avgTimeSeconds} seconds`);
    doc.moveDown(1);

    // Incorrect questions
    const wrongQuestions = result.questions.filter(isWrong);
    doc.fontSize(13).fillColor(COLOR_NAVY).text(`Incorrect Questions (${wrongQuestions.length})`);
    doc.moveDown(0.3);
    if (wrongQuestions.length === 0) {
      doc.fontSize(10).fillColor(COLOR_TEXT).text("None — every attempted question was answered correctly.");
    } else {
      wrongQuestions.forEach((q, index) => drawQuestionBlock(doc, index, q, locale, { revealAnswer: true }));
    }
  });
}

export async function getAttemptForDownload(userId: string, attemptId: string): Promise<{ result: AttemptResult; locale: Locale }> {
  const result = await getResult(userId, attemptId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  const locale: Locale = user?.locale === "ta" ? "ta" : "en";
  return { result, locale };
}
