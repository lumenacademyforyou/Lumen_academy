# Lumen Academy — template pack

Run in this order. Every file is idempotent; re-running is safe.

| Order | File | What it does |
|---|---|---|
| 1 | `../010_question_model.sql` | the schema |
| 2 | `../012_question_variant.sql` | variant questions (same stem, different answer set) |
| 3 | `../000_template_helpers.sql` | `upsert_concept`, `upsert_syllabus_node`, `map_node_concept`, readability views |
| 4 | `subjects/*.concept-tree.sql` | the shared, exam-agnostic knowledge tree, one file per subject |
| 5 | `exams/*.exam-template.sql` | exam, its scoped subjects, the paper template, and a worked syllabus branch |
| 6 | `content/*.block-template.sql` | how to store and retrieve each content type; each runs as a demo and rolls back |

Subjects must load before exams: an exam template maps its syllabus nodes onto
concepts that have to exist first.

## Checking your work

```sql
select tree, concept_path from catalog.v_concept_tree  where subject_code = 'PHY';
select tree, node_path    from catalog.v_syllabus_tree where exam_code    = 'NEET-UG';
select * from catalog.v_concept_coverage where concept_path like 'PHY/MECH%';
select * from content.v_question_eligibility;
```

## What still needs a person

The concept trees are working skeletons derived from the NCERT Class 11-12
structure that both exam syllabi are built on. Before content loads at volume,
a subject expert should pass through each one to add missing topics, correct
any placement, and replace the auto-generated topic names — the topic *codes*
are what questions reference, so a code must never change once it is in use.
