/**
 * CL-1 stop-gate proof (LA-PLAN-002 Day 1, G1). Validates the three
 * required sample questions (image, LaTeX, Tamil translation) against
 * QuestionAuthoringSchema, plus two deliberately-broken samples proving the
 * schema actually rejects bad input, not just accepts good input.
 *
 * Usage: npx tsx schemas/validate-samples.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QuestionAuthoringSchema } from "./question-authoring.schema.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.join(SCRIPT_DIR, "samples");

const REQUIRED_SAMPLES = ["sample-01-image.json", "sample-02-latex-numeric.json", "sample-03-tamil-translation.json"];

let allPassed = true;

for (const file of REQUIRED_SAMPLES) {
  const raw = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), "utf8"));
  const result = QuestionAuthoringSchema.safeParse(raw);
  if (result.success) {
    console.log(`PASS ${file} — questionUid=${result.data.questionUid}`);
  } else {
    allPassed = false;
    console.log(`FAIL ${file}:`);
    for (const issue of result.error.issues) console.log(`  ${issue.path.join(".")}: ${issue.message}`);
  }
}

// Negative proof: the schema must reject bad input, not just accept good input.
const badCases: { name: string; data: unknown }[] = [
  {
    name: "single_choice with two correct options",
    data: {
      questionUid: "LMN-PHY-PHY01-000102",
      examCode: "NEET",
      subjectCode: "PHY",
      nodeTagCode: "phy_01",
      questionType: "single_choice",
      stemText: "test",
      options: [
        { label: "A", text: "x", isCorrect: true },
        { label: "B", text: "y", isCorrect: true },
      ],
      solution: { explanationText: "test" },
    },
  },
  {
    name: "numeric question carrying options (not allowed)",
    data: {
      questionUid: "LMN-PHY-PHY01-000103",
      examCode: "NEET",
      subjectCode: "PHY",
      nodeTagCode: "phy_01",
      questionType: "numeric",
      stemText: "test",
      numericAnswer: "1.5",
      options: [{ label: "A", text: "x", isCorrect: true }],
      solution: { explanationText: "test" },
    },
  },
  {
    name: "questionUid subject segment mismatched with subjectCode",
    data: {
      questionUid: "LMN-CHEM-PHY01-000104",
      examCode: "NEET",
      subjectCode: "PHY",
      nodeTagCode: "phy_01",
      questionType: "single_choice",
      stemText: "test",
      options: [
        { label: "A", text: "x", isCorrect: true },
        { label: "B", text: "y", isCorrect: false },
      ],
      solution: { explanationText: "test" },
    },
  },
];

for (const { name, data } of badCases) {
  const result = QuestionAuthoringSchema.safeParse(data);
  if (result.success) {
    allPassed = false;
    console.log(`FAIL (should have been rejected): ${name}`);
  } else {
    console.log(`PASS (correctly rejected): ${name}`);
  }
}

console.log(`\n${allPassed ? "ALL CHECKS PASS" : "SOME CHECKS FAILED"}`);
process.exitCode = allPassed ? 0 : 1;
