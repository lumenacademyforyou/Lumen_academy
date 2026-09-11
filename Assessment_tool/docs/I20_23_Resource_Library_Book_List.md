# CL-7 inputs (I-20 to I-23) — resource library book/PDF list

**Date:** 2026-08-27
**Author:** Prince
**Scope:** Roadmap slot 20:00–21:00, `docs/LA-PLAN-002_Two_Day_Roadmap.md`. Input list for Santhosh to build CL-7 (resource library storage) against — not a live import; `content.source_document` has no rows from this list yet.

## Valid field values (checked live, 2026-08-27)

- **subject** — one of: `PHY`, `CHEM`, `BOT`, `ZOO` (`catalog.subject.subject_code`). No other subject exists live.
- **exam** — `NEET` only. No other exam exists live.
- **class** — `Class 11` or `Class 12` (`catalog.syllabus_node.class_level`). These are the only two values in use.
- **sharing setting** — `Public` (free to every student) or `Premium` (gated behind a paid `core.subscription_plan` tier). This vocabulary doesn't exist as a database column yet — CL-7 will need to add it; this list fixes what the two values mean going in.

## Book / PDF list

| # | Title | Subject | Exam | Class | Sharing setting | Notes |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

*(add rows as needed)*

## Handoff

Once filled in, this table is what gets handed to Santhosh to unblock CL-7 for the next cycle — per the roadmap's "Done when: List handed to Santhosh; unblocks CL-7 for the next cycle."
