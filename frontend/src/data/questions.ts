import { Question } from "../types";

// Mock question bank retired: real content is now uploaded unit-by-unit
// through the content domain (content-batches/ -> db/scripts/import/
// import-content.ts -> db/content) and validated before going live. These
// arrays are kept (empty) so every existing import site keeps compiling and
// rendering an empty state instead of breaking, until those screens are
// wired to the real content-backed API.
export const BIOLOGY_QUESTIONS: Question[] = [];

export const CHEMISTRY_QUESTIONS: Question[] = [];

export const PHYSICS_QUESTIONS: Question[] = [];

export const ALL_QUESTIONS: Question[] = [
  ...BIOLOGY_QUESTIONS,
  ...CHEMISTRY_QUESTIONS,
  ...PHYSICS_QUESTIONS
];
