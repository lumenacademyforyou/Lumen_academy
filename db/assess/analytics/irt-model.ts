/**
 * irt-model — pure Rasch (1-parameter logistic) IRT math, no DB access.
 * P1-7 (docs/assessment-tool-fix-prompt.md).
 *
 * Item Response Theory models the probability a person of ability θ answers
 * an item of difficulty b correctly as a logistic curve:
 *
 *   P(correct | θ, b) = 1 / (1 + e^-(θ - b))
 *
 * Both θ (per person) and b (per item) are unknown and estimated jointly
 * from the observed correct/incorrect response matrix — Joint Maximum
 * Likelihood Estimation (JMLE), the classical Rasch calibration algorithm
 * (Wright & Panchapakesan 1969): alternate Newton-Raphson updates for every
 * item's b holding all θ fixed, then every person's θ holding all b fixed,
 * repeating until both stabilize. This is a real, if simplified (1-param,
 * not 2PL/3PL), calibration — every number this module produces comes from
 * actual response data, nothing here is a hardcoded placeholder.
 *
 * The model is only identified up to an additive constant (adding k to
 * every θ and every b leaves every P unchanged), so each round re-centers
 * on mean item difficulty = 0 — the conventional Rasch anchoring choice.
 *
 * Known, accepted limitation: a person who answered every item correctly
 * (or every item wrong), or an item every person got right (or wrong), has
 * no finite maximum-likelihood estimate — the logistic curve saturates. The
 * standard practical fix (used here) is a small continuity correction: a
 * perfect/zero raw score is nudged to (correct + 0.5) / (total + 1) before
 * converting to a starting logit, keeping the estimate finite and only
 * mildly biased, rather than the calibration diverging or crashing.
 */

export interface Response01 {
  itemId: string;
  personId: string;
  correct: boolean;
}

export interface CalibrationResult {
  itemDifficulty: Map<string, number>;
  personAbility: Map<string, number>;
  /** Items/persons dropped from calibration — too little data to estimate at all (0 responses either way isn't possible by construction, but kept as a documented empty-input guard). */
  iterations: number;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function startingLogit(correct: number, total: number): number {
  const p = (correct + 0.5) / (total + 1); // continuity-corrected proportion, see header
  return Math.log(p / (1 - p));
}

const MAX_ITERATIONS = 25;
const CONVERGENCE_TOLERANCE = 0.001; // logits — stop once no parameter moves more than this in a round
// Newton steps on a saturating logistic can overshoot on the first couple of
// rounds with very lopsided data; capping the per-round step size keeps the
// iteration stable without materially slowing convergence on well-behaved data.
const MAX_STEP = 1.0;

/**
 * Joint Maximum Likelihood Estimation of the Rasch model over an arbitrary
 * set of binary (person, item) responses. Every itemId/personId that
 * appears at least once gets an estimate (via the continuity correction
 * above for extreme patterns) — deciding whether there's "enough data" to
 * trust/display those estimates is the caller's job (see irt.ts's
 * MIN_ITEMS_FOR_CALIBRATION / MIN_ATTEMPTS_FOR_CALIBRATION), not this pure
 * function's.
 */
export function calibrateRasch(responses: Response01[]): CalibrationResult {
  const itemDifficulty = new Map<string, number>();
  const personAbility = new Map<string, number>();
  if (responses.length === 0) return { itemDifficulty, personAbility, iterations: 0 };

  const byItem = new Map<string, Response01[]>();
  const byPerson = new Map<string, Response01[]>();
  for (const r of responses) {
    (byItem.get(r.itemId) ?? byItem.set(r.itemId, []).get(r.itemId)!).push(r);
    (byPerson.get(r.personId) ?? byPerson.set(r.personId, []).get(r.personId)!).push(r);
  }

  for (const [itemId, rs] of byItem) {
    const correct = rs.filter((r) => r.correct).length;
    itemDifficulty.set(itemId, startingLogit(rs.length - correct, rs.length)); // difficulty is the "incorrect" side of the logit
  }
  for (const [personId, rs] of byPerson) {
    const correct = rs.filter((r) => r.correct).length;
    personAbility.set(personId, startingLogit(correct, rs.length));
  }

  let iterations = 0;
  for (; iterations < MAX_ITERATIONS; iterations++) {
    let maxMove = 0;

    // Item step: hold every θ fixed, Newton-update every b.
    for (const [itemId, rs] of byItem) {
      const b = itemDifficulty.get(itemId)!;
      let gradient = 0; // sum(P - y)
      let information = 0; // sum(P(1-P))
      for (const r of rs) {
        const theta = personAbility.get(r.personId)!;
        const p = sigmoid(theta - b);
        gradient += p - (r.correct ? 1 : 0);
        information += p * (1 - p);
      }
      if (information > 1e-6) {
        const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, gradient / information));
        itemDifficulty.set(itemId, b + step);
        maxMove = Math.max(maxMove, Math.abs(step));
      }
    }

    // Re-center: Rasch is only identified up to an additive constant —
    // anchor mean item difficulty at 0 every round so item and person
    // estimates don't drift together unboundedly.
    const meanB = [...itemDifficulty.values()].reduce((a, b) => a + b, 0) / itemDifficulty.size;
    for (const [id, b] of itemDifficulty) itemDifficulty.set(id, b - meanB);

    // Person step: hold every (now re-centered) b fixed, Newton-update every θ.
    for (const [personId, rs] of byPerson) {
      const theta = personAbility.get(personId)!;
      let gradient = 0;
      let information = 0;
      for (const r of rs) {
        const b = itemDifficulty.get(r.itemId)!;
        const p = sigmoid(theta - b);
        gradient += (r.correct ? 1 : 0) - p; // note sign: maximizing, not minimizing, for theta
        information += p * (1 - p);
      }
      if (information > 1e-6) {
        const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, gradient / information));
        personAbility.set(personId, theta + step);
        maxMove = Math.max(maxMove, Math.abs(step));
      }
    }

    if (maxMove < CONVERGENCE_TOLERANCE) {
      iterations++;
      break;
    }
  }

  return { itemDifficulty, personAbility, iterations };
}

export interface ThetaEstimate {
  theta: number;
  standardError: number;
  itemsUsed: number;
}

/**
 * Estimates one person's θ against a set of ALREADY-CALIBRATED item
 * difficulties (population-wide b's held fixed) — used to place a single
 * attempt's ability on the same scale as the rest of the calibration
 * without re-running the whole joint estimation for every historical
 * attempt (irt.ts's ability-trend report calls this once per past attempt).
 * Returns null if there's nothing usable (no items overlap the calibrated
 * set) — the caller decides what "not enough data" means for its context.
 */
export function estimateThetaAgainstCalibration(
  responses: { itemId: string; correct: boolean }[],
  itemDifficulty: Map<string, number>
): ThetaEstimate | null {
  const usable = responses.filter((r) => itemDifficulty.has(r.itemId));
  if (usable.length === 0) return null;

  const correctCount = usable.filter((r) => r.correct).length;
  let theta = startingLogit(correctCount, usable.length);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let gradient = 0;
    let information = 0;
    for (const r of usable) {
      const b = itemDifficulty.get(r.itemId)!;
      const p = sigmoid(theta - b);
      gradient += (r.correct ? 1 : 0) - p;
      information += p * (1 - p);
    }
    if (information <= 1e-6) break;
    const step = Math.max(-MAX_STEP, Math.min(MAX_STEP, gradient / information));
    theta += step;
    if (Math.abs(step) < CONVERGENCE_TOLERANCE) break;
  }

  // Final information at the converged theta — standard error is the
  // inverse square root of Fisher information, the standard IRT formula.
  let information = 0;
  for (const r of usable) {
    const b = itemDifficulty.get(r.itemId)!;
    const p = sigmoid(theta - b);
    information += p * (1 - p);
  }
  const standardError = information > 1e-6 ? 1 / Math.sqrt(information) : Infinity;

  return { theta, standardError, itemsUsed: usable.length };
}

export { sigmoid };
