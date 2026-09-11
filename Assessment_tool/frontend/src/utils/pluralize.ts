// P2-14 (docs/assessment-tool-fix-prompt.md): a single shared rule for
// "N noun" text across the app (units, questions, tests, attempts, days,
// ...) instead of every screen re-deciding its own singular/plural logic —
// swept the dashboard for these ("1 units", missing space before the label)
// and used this everywhere a count precedes a countable noun.
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

// "{count} {noun}" with the right form and a guaranteed space between them.
export function countLabel(count: number, singular: string, plural?: string): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}
