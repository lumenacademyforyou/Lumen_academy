/**
 * Section and attempt aggregation (LA-BE-ENGINE-001 TE-P2). Pure function,
 * operates only on already-evaluated responses — no database, no HTTP.
 */
import * as decimal from "./decimal.js";
import type { AttemptAggregate, EvaluatedResponse, SectionAggregate } from "./types.js";

export interface SectionInput {
  sectionId: string;
  responses: EvaluatedResponse[];
  /**
   * Marks available if every question in the section were answered
   * correctly. Supplied by the caller (sum of each served question's
   * correctMarks) — this module has no access to question/rule data, only
   * already-evaluated results.
   */
  totalAvailableMarks: string;
}

function countByOutcome(responses: EvaluatedResponse[], outcome: EvaluatedResponse["outcome"]): number {
  return responses.filter((r) => r.outcome === outcome).length;
}

export function aggregateSection(section: SectionInput): SectionAggregate {
  return {
    sectionId: section.sectionId,
    subtotalMarks: decimal.sum(section.responses.map((r) => r.marksAwarded)),
    totalAvailableMarks: section.totalAvailableMarks,
    correctCount: countByOutcome(section.responses, "CORRECT"),
    incorrectCount: countByOutcome(section.responses, "INCORRECT"),
    partialCount: countByOutcome(section.responses, "PARTIAL"),
    unattemptedCount: countByOutcome(section.responses, "UNATTEMPTED"),
    voidCount: countByOutcome(section.responses, "VOID"),
  };
}

/**
 * The attempt total is the sum of the section subtotals, computed here from
 * the same section aggregates this function returns — never recomputed
 * independently from the raw responses — so a total that drifted from its
 * sections' sum is structurally impossible, not just tested for.
 */
export function aggregateAttempt(sections: SectionInput[]): AttemptAggregate {
  const sectionAggregates = sections.map(aggregateSection);
  return {
    totalMarks: decimal.sum(sectionAggregates.map((s) => s.subtotalMarks)),
    totalAvailableMarks: decimal.sum(sectionAggregates.map((s) => s.totalAvailableMarks)),
    sections: sectionAggregates,
  };
}
