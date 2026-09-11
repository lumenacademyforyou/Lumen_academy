// Single backend-side source of truth for the fixed "Quick Demo" account's
// identity, so the reset endpoint (backend/src/controllers/demoController.ts)
// and the seed/reset scripts (db/scripts/demo/, db/scripts/reset-user-data.ts)
// can't drift from each other. The frontend keeps its own copy
// (frontend/src/services/demoSession.ts) since it can't import from db/ —
// that file's own comment already documents it as the frontend's one source.
export const DEMO_EMAIL = "demo.student@lumenacademy.dev";
