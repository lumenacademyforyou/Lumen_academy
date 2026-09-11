**Blocker on batch-2 (Chemistry) — need your call before Day 1 close**

1. **No syllabus node for "Some Basic Concepts of Chemistry."** I checked all 6 seeded Chemistry nodes (`chem_01`–`chem_06` in `database_sample/syllabusData.ts`) — Organic Reactions, Inorganic/p-Block, Equilibrium & Thermodynamics, Atomic Structure & Bonding, Hydrocarbons, Electrochemistry/Solutions. None of them is the mole-concept/stoichiometry/molarity chapter (NCERT Class 11 Ch. 1) I authored 30 questions against.
   - Is there a real `catalog.syllabus_node` row for this that isn't in the mock data I checked, or does one need to be added?
   - I've left `nodeTagCode` as an obvious placeholder (`"UNMAPPED_some_basic_concepts_of_chemistry"`) in the batch file rather than guessing a real-looking code, so your importer's node resolution correctly flags it as unmapped instead of silently wrong.

2. **5 diagram images aren't real files yet.** The batch-2 questions with `targetRole: "stem"` images (`CHE_SOMBAS_DIAG_0001.png`–`0005.png`) have correct filename references in the JSON, but the actual PNG files still need to be produced and dropped in the shared upload folder — I'll get these done before the upload run.

Also flagging two judgment calls from the batch-1 review that need your sign-off, not just my guess (see `docs/CL1_Contract_Review_Prince.md` for full detail):
- I mapped batch-1's `nodeTagCode` to `phy_02` (Current Electricity → "Electrostatics & Current Electricity") — please confirm that's the live tag_code.
- I collapsed the source's 4-level difficulty (L1–L4) into the schema's 3-band `easy/medium/hard` (L4→hard). Confirm that's fine, or amend `difficultyBand`'s vocabulary in CL-1 v1.1.

Files ready for your review: `content-batches/batch-1-physics-current-electricity.json` (clean, validates), `content-batches/batch-2-chemistry-pending-node.json` (validates on shape, blocked on node).

— Prince
