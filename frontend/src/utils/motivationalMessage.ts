// P1-15 (docs/assessment-tool-fix-prompt.md): the dashboard hero used to
// read a hardcoded "Great work, {name}!" for every real attempt, regardless
// of score — a 30% accuracy and a 95% accuracy got the identical headline.
// This replaces that with a varied set of encouraging descriptors mapped to
// performance bands and scenarios. Hard rule throughout: no band or
// scenario here is ever allowed to produce discouraging wording — a low
// score gets encouragement plus a concrete next step, never "Poor"/"Weak"/
// "Bad"/"Failed".

export interface MotivationalContext {
  studentName: string;
  accuracyPercent: number;
  attemptsCount: number;
  /** Accuracy of the immediately preceding scored attempt, or null if this is the only one. */
  previousAccuracyPercent: number | null;
  studyStreakDays: number;
  weakestUnitTitle: string | null;
  /** Changes per attempt so the rotation varies without flickering mid-render. */
  variationSeed: number;
}

export interface MotivationalMessage {
  headline: string;
  nextStep: string;
}

type Phrase = (name: string) => string;

const HIGH_BAND: Phrase[] = [
  (name) => `Outstanding work, ${name}!`,
  () => "You're mastering this.",
  () => "Excellent command of the material.",
];

const MID_BAND: Phrase[] = [
  (name) => `Solid progress, ${name}!`,
  () => "You're getting there.",
  () => "Good foundation — keep building.",
];

const LOW_BAND: Phrase[] = [
  () => "Great start — every attempt counts.",
  () => "You're building momentum.",
  () => "Good effort — here's where to focus next.",
];

const CONSISTENCY_BAND: Phrase[] = [
  (name) => `${name}, your consistency is paying off!`,
  () => "Steady practice, steady growth.",
  () => "You're showing up every day — that's what builds rank.",
];

function pick<T>(pool: T[], seed: number): T {
  return pool[((seed % pool.length) + pool.length) % pool.length];
}

function nextStepFor(weakestUnitTitle: string | null): string {
  return weakestUnitTitle ? `Next up: practise ${weakestUnitTitle} to build on this.` : "Take another test to keep your progress trend going.";
}

/**
 * Priority order (checked top to bottom, first match wins) — scenario-based
 * messages take priority over a flat score band, since "you improved" or
 * "this is your first attempt" is more relevant to the student in the
 * moment than a generic band label.
 */
export function getMotivationalMessage(ctx: MotivationalContext): MotivationalMessage {
  const nextStep = nextStepFor(ctx.weakestUnitTitle);

  if (ctx.attemptsCount <= 1) {
    return { headline: "Nice work getting started!", nextStep };
  }

  if (ctx.previousAccuracyPercent !== null && ctx.accuracyPercent > ctx.previousAccuracyPercent) {
    const gain = Math.round(ctx.accuracyPercent - ctx.previousAccuracyPercent);
    return { headline: `You're improving — up ${gain}% from last time!`, nextStep };
  }

  if (ctx.studyStreakDays >= 3) {
    return { headline: pick(CONSISTENCY_BAND, ctx.variationSeed)(ctx.studentName), nextStep };
  }

  if (ctx.accuracyPercent >= 85) {
    return { headline: pick(HIGH_BAND, ctx.variationSeed)(ctx.studentName), nextStep };
  }
  if (ctx.accuracyPercent >= 60) {
    return { headline: pick(MID_BAND, ctx.variationSeed)(ctx.studentName), nextStep };
  }
  return { headline: pick(LOW_BAND, ctx.variationSeed)(ctx.studentName), nextStep };
}
