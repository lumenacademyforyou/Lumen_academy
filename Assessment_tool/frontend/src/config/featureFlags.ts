// P1-9 (docs/assessment-tool-fix-prompt.md): the Full Mock Test used to be
// gated behind "complete every unit in your Syllabus Tracker first" — real
// gating logic (TestListView.tsx's isSyllabusCompleted, computed from
// App.tsx's chapterGoals checklist), not a stub. The item asks to unlock it
// for everyone while keeping that logic re-enableable without a rewrite —
// flip this back to true to restore the gate; no other code changes needed.
export const FULL_MOCK_REQUIRES_SYLLABUS_COMPLETION = false;
