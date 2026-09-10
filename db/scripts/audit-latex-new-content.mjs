import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("db/content/content-batches/new_content");

function listJsonFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

const RE_CARET = /\^/;
const RE_UNDERSCORE = /_/;
const RE_UNBRACED_MULTICHAR_EXP = /\^(?!\{)[A-Za-z0-9]{2,}/;
const RE_PAREN_EXP = /\^\(/;
const RE_FRAC = /\\frac/;
const RE_LATEX_CMD = /\\[a-zA-Z]+/;
const RE_SQRT_FN = /sqrt\(/i;
const RE_DOLLAR = /\$/;

function scanText(text) {
  if (!text) return null;
  const issues = [];
  if (RE_CARET.test(text)) issues.push("caret");
  if (RE_UNDERSCORE.test(text)) issues.push("underscore");
  if (RE_UNBRACED_MULTICHAR_EXP.test(text)) issues.push("unbraced_multichar_exponent");
  if (RE_PAREN_EXP.test(text)) issues.push("paren_exponent");
  if (RE_FRAC.test(text)) issues.push("frac");
  if (RE_LATEX_CMD.test(text)) issues.push("latex_command");
  if (RE_SQRT_FN.test(text)) issues.push("sqrt_function_style");
  if (RE_DOLLAR.test(text)) issues.push("dollar_delim");
  return issues.length ? issues : null;
}

const files = listJsonFiles(ROOT);
const report = {
  filesScanned: files.length,
  totalQuestions: 0,
  byIssue: {},
  byFile: [],
  stemFormatMismatch: [], // stemFormat=plain but text has math markup
  examples: {}, // issue -> up to 5 examples
};

function record(issue, example) {
  report.byIssue[issue] = (report.byIssue[issue] || 0) + 1;
  if (!report.examples[issue]) report.examples[issue] = [];
  if (report.examples[issue].length < 6) report.examples[issue].push(example);
}

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    report.byFile.push({ file: rel, error: `JSON parse failed: ${e.message}` });
    continue;
  }
  if (!Array.isArray(arr)) {
    report.byFile.push({ file: rel, error: "not an array" });
    continue;
  }

  let fileQuestionCount = 0;
  let fileIssueCount = 0;

  for (const q of arr) {
    fileQuestionCount++;
    report.totalQuestions++;

    const fields = [
      ["stemText", q.stemText],
      ["solution.explanationText", q.solution?.explanationText],
    ];
    (q.options || []).forEach((o, i) => fields.push([`options[${i}:${o.label}].text`, o.text]));
    (q.translations || []).forEach((t, i) => {
      fields.push([`translations[${i}:${t.languageCode}].stemText`, t.stemText]);
      (t.optionTexts || []).forEach((ot, j) => fields.push([`translations[${i}:${t.languageCode}].optionTexts[${j}]`, ot]));
    });

    let questionHasIssue = false;
    let questionHasMathMarkup = false;

    for (const [fieldName, text] of fields) {
      const issues = scanText(text);
      if (!issues) continue;
      questionHasIssue = true;
      if (issues.some((i) => ["caret", "underscore", "frac", "latex_command", "sqrt_function_style"].includes(i))) {
        questionHasMathMarkup = true;
      }
      for (const issue of issues) {
        record(issue, { file: rel, questionUid: q.questionUid, field: fieldName, snippet: text.slice(0, 140) });
      }
    }

    if (questionHasMathMarkup && q.stemFormat === "plain") {
      report.stemFormatMismatch.push({ file: rel, questionUid: q.questionUid, stemFormat: q.stemFormat });
    }

    if (questionHasIssue) fileIssueCount++;
  }

  report.byFile.push({ file: rel, questions: fileQuestionCount, questionsWithIssue: fileIssueCount });
}

console.log(JSON.stringify(report, null, 2));
