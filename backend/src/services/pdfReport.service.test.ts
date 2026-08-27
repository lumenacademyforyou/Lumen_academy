import assert from "node:assert/strict";
import { test } from "node:test";
import { PDFParse } from "pdf-parse";
import { buildAnswerKeyPdf, buildQuestionPaperPdf, buildReportPdf } from "./pdfReport.service.js";
import type { AttemptResult } from "./attempt.service.js";

async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

const SECRET_EXPLANATION = "ZZZ_SECRET_EXPLANATION_MARKER_ZZZ";

function buildFixture(): AttemptResult {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    status: "submitted",
    score: 3,
    maxScore: 4,
    correctCount: 0,
    wrongCount: 1,
    skippedCount: 0,
    submittedAt: new Date(),
    questions: [
      {
        id: "q_1",
        stemEn: "Which codon is the universal start codon?",
        stemTa: null,
        explanationEn: SECRET_EXPLANATION,
        explanationTa: null,
        selectedOptionId: "q_1_B",
        timeSpentMs: 12000,
        subject: "Botany",
        unit: "Genetics & Molecular Inheritance",
        options: [
          { id: "q_1_A", label: "A", textEn: "AUG (Methionine)", textTa: null, isCorrect: true },
          { id: "q_1_B", label: "B", textEn: "UAA (Stop)", textTa: null, isCorrect: false },
        ],
      },
    ],
  };
}

test("question paper PDF never contains the correct-answer marker or explanation", async () => {
  const buffer = await buildQuestionPaperPdf(buildFixture(), "en");
  const text = await extractText(buffer);

  assert.ok(!text.includes(SECRET_EXPLANATION), "question paper must not contain the explanation text");
  assert.ok(!text.includes("(Correct)"), "question paper must not mark the correct option");
  assert.ok(text.includes("AUG (Methionine)"), "question paper should still list all options");
});

test("answer key PDF contains the correct-answer marker and explanation", async () => {
  const buffer = await buildAnswerKeyPdf(buildFixture(), "en");
  const text = await extractText(buffer);

  assert.ok(text.includes(SECRET_EXPLANATION), "answer key must contain the explanation text");
  assert.ok(text.includes("(Correct)"), "answer key must mark the correct option");
});

test("report PDF contains the score summary and the incorrect question", async () => {
  const buffer = await buildReportPdf(buildFixture(), "en");
  const text = await extractText(buffer);

  assert.ok(text.includes("Score Summary"));
  assert.ok(text.includes("Score: 3 / 4"));
  assert.ok(text.includes(SECRET_EXPLANATION), "report should explain the incorrect question");
});
