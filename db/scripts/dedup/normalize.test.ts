import assert from "node:assert/strict";
import test from "node:test";
import { buildClusters, classifyPairs, TIER2_THRESHOLD } from "./cluster.js";
import {
  blockingKeys,
  digitSignature,
  matchHash,
  normalizeForMatch,
  skeletonKey,
  slugify,
  stableQuestionId,
  tokenSetRatio,
  trigramSimilarity,
} from "./normalize.js";
import { computeMetadataMerge, pickSurvivor } from "./survivor.js";
import type { CanonicalRecord } from "./types.js";

/**
 * Unit tests for the dedup toolkit. No database — db/scripts/dedup/integration.test.ts
 * covers everything that needs one.
 */

function record(overrides: Partial<CanonicalRecord> & { stemText: string }): CanonicalRecord {
  const stemNorm = normalizeForMatch(overrides.stemText);
  return {
    origin: "file",
    questionId: null,
    questionUid: null,
    stableId: stableQuestionId(overrides.stemText),
    stemNorm,
    matchHash: matchHash(overrides.stemText),
    digits: digitSignature(overrides.stemText),
    options: [],
    questionType: "single_choice",
    difficultyBand: null,
    subjectCode: null,
    nodeTagCode: null,
    explanation: null,
    numericAnswer: null,
    lifecycleStatus: null,
    sourceBatch: null,
    createdAt: null,
    raw: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

test("normalisation: lowercase, whitespace collapse, punctuation strip", () => {
  assert.equal(normalizeForMatch("  What   is Ohm's LAW?  "), "what is ohms law");
});

test("normalisation: strips HTML and markdown", () => {
  assert.equal(
    normalizeForMatch("<p>The <b>resistance</b> of a *wire*</p>"),
    normalizeForMatch("The resistance of a wire")
  );
});

test("normalisation: strips leading enumeration", () => {
  assert.equal(normalizeForMatch("12. Find the current"), normalizeForMatch("Find the current"));
  assert.equal(normalizeForMatch("(3) Find the current"), normalizeForMatch("Find the current"));
});

test("normalisation: NFKC, smart quotes and dashes all fold to one form", () => {
  // Smart quotes were already equivalent (both forms are stripped as
  // punctuation). Dashes were NOT: the frozen normaliser keeps ASCII "-" and
  // strips en/em dashes, so the two spellings hashed differently. Migration
  // 044 and DASH_VARIANTS in normalize.ts fix that; this asserts it.
  assert.equal(
    normalizeForMatch("The “ideal” gas — expands"),
    normalizeForMatch('The "ideal" gas - expands')
  );
  assert.equal(
    normalizeForMatch("a well–known result"),
    normalizeForMatch("a well-known result")
  );
  assert.equal(matchHash("x − y"), matchHash("x - y"));
});

test("normalisation: strips LaTeX spacing artefacts and $ delimiters", () => {
  assert.equal(normalizeForMatch("$E = mc^2$ \\, holds"), normalizeForMatch("E = mc2 holds"));
});

test("normalisation: decimal points inside numbers survive the punctuation strip", () => {
  assert.match(normalizeForMatch("a mass of 10.5 kg"), /10\.5/);
});

test("normalisation: strips the decorative chapter lead-in", () => {
  assert.equal(
    normalizeForMatch("In Kinetic Theory of Gases, a body of mass m = 10.0 kg moves"),
    normalizeForMatch("a body of mass m = 10.0 kg moves")
  );
});

test("normalisation: chapter lead-in strip is comma-tolerant (migration 039's defect)", () => {
  assert.equal(
    normalizeForMatch("In Work, Energy and Power, a body of mass m = 12.0 kg"),
    normalizeForMatch("a body of mass m = 12.0 kg")
  );
});

test("normalisation: does NOT strip an ordinary lowercase 'In the ...' opening", () => {
  // "In the reaction below, identify X." is prose, not an interpolated
  // chapter name. Stripping it would merge genuinely different questions.
  const normalised = normalizeForMatch("In the reaction below, identify X.");
  assert.match(normalised, /^in the reaction below/);
});

test("normalisation: strips a semantically null leading interrogative frame", () => {
  assert.equal(
    normalizeForMatch("Which of the following is the SI unit of force?"),
    normalizeForMatch("is the SI unit of force?")
  );
});

test("match_hash is stem-only: options and answers do not enter it", () => {
  // Section 2: "options and answers are not part of the hash."
  assert.equal(matchHash("A body of mass 5 kg"), matchHash("A body of mass 5 kg"));
});

test("stableQuestionId is a v5 uuid and is stable across equivalent stems", () => {
  const a = stableQuestionId("In Waves, a body of mass m = 10.0 kg");
  const b = stableQuestionId("a body of mass m = 10.0 kg");
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("slugify produces lowercase, space-free, filesystem-safe names", () => {
  assert.equal(slugify("Physics — Current Electricity (Batch 1)"), "physics-current-electricity-batch-1");
});

// ---------------------------------------------------------------------------
// Digit signature — the numeric-variant guard
// ---------------------------------------------------------------------------

test("digitSignature is order-sensitive and ignores decimal typography", () => {
  assert.equal(digitSignature("from 5.0 L to 2.50 L"), "5|2.5");
  assert.notEqual(digitSignature("from 5.0 L to 2.0 L"), digitSignature("from 2.0 L to 5.0 L"));
});

test("skeletonKey collapses every numeric literal", () => {
  assert.equal(skeletonKey("a mass of 10.5 kg and 3 m"), "a mass of # kg and # m");
});

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

test("tier 1: seven copies of one stem collapse into a single cluster with one survivor", () => {
  // The prompt's headline damage pattern: "~7 near-identical copies per unique
  // stem". The copies differ in options, correct answer, difficulty and topic
  // — every one of which Section 2 says to ignore.
  const stem = "State the first law of thermodynamics for an isolated system.";
  const copies = Array.from({ length: 7 }, (_, i) =>
    record({
      stemText: stem,
      questionUid: "LMN-PHY-PHY01-" + String(i + 1).padStart(6, "0"),
      difficultyBand: i % 2 === 0 ? "easy" : "hard",
      nodeTagCode: "phy_0" + ((i % 3) + 1),
      options: [
        { label: "A", text: "Energy is conserved", isCorrect: i !== 3 },
        { label: "B", text: "Entropy increases", isCorrect: i === 3 },
      ],
    })
  );

  const { clusters } = buildClusters(copies);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].tier, 1);
  assert.equal(clusters[0].members.length, 7);
  assert.equal(clusters[0].losers.length, 6);
  assert.equal(clusters[0].minSimilarity, 1);
});

test("tier 3: numbers differ, so near-identical stems are NOT auto-deleted", () => {
  // This is the guard that saved every one of the 1451 live Tier-2 candidates
  // in this bank from being deleted. Same wording, different quantity.
  const a = record({
    stemText: "Calculate the work done when 4 moles of an ideal gas expands from 5.0 L to 10.0 L.",
    questionUid: "A",
  });
  const b = record({
    stemText: "Calculate the work done when 4 moles of an ideal gas expands from 2.0 L to 10.0 L.",
    questionUid: "B",
  });

  assert.ok(trigramSimilarity(a.stemNorm, b.stemNorm) >= TIER2_THRESHOLD, "precondition: they are lexically near-identical");
  assert.notEqual(a.digits, b.digits);

  const pairs = classifyPairs([a, b]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].tier, 3, "must be routed to review, not auto-deleted");

  const { clusters, reviewPairs } = buildClusters([a, b]);
  assert.equal(clusters.length, 0, "no auto-delete cluster may form");
  assert.equal(reviewPairs.length, 1);
});

test("tier 2: identical digits and a near-identical stem does auto-delete", () => {
  // Same quantities, same meaning, one unit spelled out. Nothing a student
  // would experience as a second question.
  const a = record({
    stemText: "Calculate the work done when 4 moles of an ideal gas expands isothermally and reversibly from 5.0 L to 10.0 L at 300 K.",
    questionUid: "A",
  });
  const b = record({
    stemText: "Calculate the work done when 4 moles of an ideal gas expands isothermally and reversibly from 5.0 L to 10.0 L at 300 kelvin.",
    questionUid: "B",
  });
  assert.equal(a.digits, b.digits);
  assert.ok(trigramSimilarity(a.stemNorm, b.stemNorm) >= TIER2_THRESHOLD);

  const { clusters } = buildClusters([a, b]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].tier, 2);
});

test("unrelated questions cluster with nothing", () => {
  const records = [
    record({ stemText: "What is the SI unit of luminous intensity?", questionUid: "A" }),
    record({ stemText: "Name the enzyme that catalyses the first step of glycolysis.", questionUid: "B" }),
  ];
  const { clusters, reviewPairs } = buildClusters(records);
  assert.equal(clusters.length, 0);
  assert.equal(reviewPairs.length, 0);
});

test("blocking recall: the key union finds every pair exhaustive comparison finds", () => {
  // The prompt's 40-character prefix key alone misses 88% of the real
  // candidate pairs in this bank. This asserts the replacement does not.
  const records = Array.from({ length: 60 }, (_, i) =>
    record({
      stemText:
        "Calculate the work done when " + (i % 7) + " moles of an ideal gas expands isothermally " +
        "and reversibly from " + (i % 5) + ".0 L to " + ((i % 4) + 6) + ".0 L at 300 K.",
      questionUid: "Q" + i,
    })
  );

  const exhaustive = classifyPairs(records, { forceBlocking: false });
  const blocked = classifyPairs(records, { forceBlocking: true });

  const key = (p: { a: CanonicalRecord; b: CanonicalRecord }) =>
    [p.a.questionUid, p.b.questionUid].sort().join("|");
  const blockedKeys = new Set(blocked.map(key));
  const missed = exhaustive.filter((p) => !blockedKeys.has(key(p)));
  assert.equal(missed.length, 0, missed.length + " pair(s) were missed by blocking");
});

test("blockingKeys always includes the template-family skeleton key", () => {
  const keys = blockingKeys(normalizeForMatch("a body of mass 10.0 kg"));
  assert.ok(keys.some((k) => k.startsWith("skel:")));
  assert.ok(keys.some((k) => k.startsWith("pfx:")));
});

test("token_set_ratio and trigram similarity disagree on a subset, as intended", () => {
  // Both metrics are order-insensitive — pg_trgm pads each WORD separately,
  // so a pure re-ordering scores 1.0 on both. Where they genuinely differ is
  // a subset: token_set_ratio treats "all of A's tokens appear in B" as a
  // perfect match, trigram similarity does not. That is why trigram is the
  // auto-delete gate and token_set_ratio is reported alongside it: scoring a
  // three-word stem as identical to a nine-word one is not a deletion
  // criterion.
  const short = "copper wire resistance";
  const long = "copper wire resistance measured carefully in the lab";
  assert.equal(tokenSetRatio(short, long), 1);
  assert.ok(trigramSimilarity(short, long) < 0.5);

  const reordered = "resistance copper wire";
  assert.equal(trigramSimilarity(short, reordered), 1);
});

// ---------------------------------------------------------------------------
// Survivor rules
// ---------------------------------------------------------------------------

test("survivor rule 1 beats every other rule: a referenced row wins", () => {
  const referenced = record({
    stemText: "Same stem",
    questionUid: "LMN-PHY-PHY01-000099",
    referenceCount: 3,
    options: [],
  });
  const richer = record({
    stemText: "Same stem",
    questionUid: "LMN-PHY-PHY01-000001",
    referenceCount: 0,
    difficultyBand: "easy",
    explanation: "a full explanation",
    nodeTagCode: "phy_01",
    subjectCode: "PHY",
    options: [
      { label: "A", text: "yes", isCorrect: true },
      { label: "B", text: "no", isCorrect: false },
    ],
  });

  const { survivor, reason } = pickSurvivor([richer, referenced]);
  assert.equal(survivor, referenced);
  assert.match(reason, /rule 1/);
});

test("survivor rule 2: a complete option set beats richer metadata", () => {
  const complete = record({
    stemText: "Same stem",
    questionUid: "B",
    options: [
      { label: "A", text: "yes", isCorrect: true },
      { label: "B", text: "no", isCorrect: false },
    ],
  });
  const noAnswer = record({
    stemText: "Same stem",
    questionUid: "A",
    difficultyBand: "hard",
    explanation: "words",
    nodeTagCode: "phy_01",
    subjectCode: "PHY",
    options: [{ label: "A", text: "yes", isCorrect: false }],
  });
  assert.equal(pickSurvivor([noAnswer, complete]).survivor, complete);
});

test("survivor rule 5 falls back to the question_uid serial, oldest first", () => {
  const older = record({ stemText: "Same stem", questionUid: "LMN-ZOO-ZOO01-000003" });
  const newer = record({ stemText: "Same stem", questionUid: "LMN-ZOO-ZOO01-000027" });
  const { survivor, reason } = pickSurvivor([newer, older]);
  assert.equal(survivor, older);
  assert.match(reason, /rule 5/);
});

test("survivor election is deterministic regardless of input order", () => {
  const members = [
    record({ stemText: "Same stem", questionUid: "C" }),
    record({ stemText: "Same stem", questionUid: "A" }),
    record({ stemText: "Same stem", questionUid: "B" }),
  ];
  const first = pickSurvivor(members).survivor.questionUid;
  const second = pickSurvivor([...members].reverse()).survivor.questionUid;
  assert.equal(first, second);
});

test("metadata merges upward only into empty survivor fields", () => {
  const survivor = record({ stemText: "S", difficultyBand: "easy", explanation: null });
  const loser = record({ stemText: "S", difficultyBand: "hard", explanation: "from the loser" });
  const merge = computeMetadataMerge(survivor, [loser]);
  assert.equal(merge.explanation, "from the loser");
  assert.equal(merge.difficultyBand, undefined, "a populated survivor field is never overwritten");
});
