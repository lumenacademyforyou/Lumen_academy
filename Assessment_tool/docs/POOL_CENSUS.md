# Pool Census — content_fp / stem_fp / skeleton_fp

Generated per `docs/no-repeat-questions-fix.md` Phase 1.3, from live `content.question` fingerprints (migration `030_question_fingerprints.sql`), against `lifecycle_status = 'published'` only. Every count below is `count(distinct ...)` — a question can legally map to more than one `syllabus_node` (P0-3, `assemble.ts`), so a raw row count would double-count cross-tagged questions.

`distinct_content` is the enforced key going forward (Phase 3/4). `distinct_stems` is report-only (same stem, re-authored options — did not occur separately from content clones in this bank: the two numbers are identical at every level below). `distinct_skeletons` is report-only per Phase 1.4 (not enforced — would also collapse legitimate numeric-variant drills).

## Per subject

| Subject | Published rows | Distinct content | Distinct stems | Distinct skeletons |
|---|---|---|---|---|
| Physics | 365 | **337** | 337 | 178 |
| Chemistry | 364 | **136** | 136 | 93 |
| Botany | 336 | **87** | 87 | 87 |
| Zoology | 334 | **83** | 83 | 83 |
| **Total** | **1399** | **643** | 643 | 441 |

Matches the investigation's estimate (Physics ~337, Chemistry ~136, Botany ~87, Zoology ~83) — confirmed, not just re-asserted.

## Per unit (`node_type = 'unit'`)

This is the number that actually decides whether a unit-scoped mock is buildable. The picture is considerably worse per-unit than the subject totals alone suggest — several units are down to **1-2 real questions** behind 30-60 rows:

### Physics (generally healthy — smallest unit still has 25 real questions)

| Unit | Rows | Real questions |
|---|---|---|
| Kinematics & Laws of Motion | 60 | 60 |
| Magnetism, EMI & Semiconductor Devices | 30 | 30 |
| Electrostatics & Current Electricity | 61 | 58 |
| Modern Physics: Dual Nature, Atoms & Nuclei | 32 | 31 |
| Gravitation & Properties of Matter | 30 | 28 |
| Oscillations, Waves & SHM | 31 | 27 |
| Mechanics & Rotational Dynamics | 31 | 26 |
| Thermodynamics & Kinetic Theory | 30 | 26 |
| Optics & Wave Physics | 30 | 26 |
| Work, Energy and Power | 30 | 25 |

### Chemistry (severe — most units in single digits)

| Unit | Rows | Real questions |
|---|---|---|
| Atomic Structure & Chemical Bonding | 60 | 42 |
| Some Basic Concepts & States of Matter | 59 | 43 |
| Physical Chemistry: Equilibrium & Thermodynamics | 30 | 19 |
| Electrochemistry, Solutions & Surface Chem | 31 | 12 |
| Inorganic Coordination & p-Block Trends | 33 | 5 |
| Chemical Kinetics | 30 | 5 |
| Organic Reactions & Mechanisms | 31 | 4 |
| Hydrocarbons & Basic Organic Principles | 30 | 2 |
| d and f Block Elements | 30 | 2 |
| Aldehydes, Ketones & Carboxylic Acids | 30 | 2 |

### Botany (severe)

| Unit | Rows | Real questions |
|---|---|---|
| Biological Classification & Plant Kingdom | 60 | 34 |
| Plant Physiology & Photosynthesis | 60 | 32 |
| Ecology, Ecosystems & Conservation | 33 | 6 |
| Genetics & Molecular Inheritance | 33 | 5 |
| Plant Diversity, Morphology & Anatomy | 30 | 4 |
| Plant Growth & Development | 30 | 4 |
| Cell Structure, Biomolecules & Cell Cycle | 30 | 2 |
| Anatomy of Flowering Plants | 30 | **1** |
| Sexual Reproduction in Flowering Plants | 30 | **1** |

### Zoology (severe)

| Unit | Rows | Real questions |
|---|---|---|
| Breathing, Circulation & Excretion | 60 | 35 |
| Animal Diversity & Structural Organisation | 60 | 34 |
| Origin of Life & Evolutionary Biology | 33 | 5 |
| Biotechnology: Principles & Applications | 31 | 2 |
| Human Health, Immunity & Infectious Diseases | 30 | 2 |
| Human Physiology & Neuro-Endocrine Systems | 30 | 2 |
| Human Reproduction & ART Technologies | 30 | 2 |
| Locomotion and Movement | 30 | **1** |
| Neural Control & Coordination | 30 | **1** |

## What this means for Phase 7

A unit blueprint asking for, say, 15-20 questions from "Locomotion and Movement" or "Anatomy of Flowering Plants" cannot be honestly filled at all post-collapse — those units have exactly **1** real question apiece today. This is not a hypothetical edge case Phase 7 might turn up; it's already visible in this census, for roughly two-thirds of Chemistry/Botany/Zoology's units. Confirms the spec's own instruction not to pad, relax scope, or lower the bar — the correct outcome for most non-Physics units right now is `INSUFFICIENT_POOL` or a `is_partial = true` paper, and a real authoring backlog ordered by this table's deficit column.
