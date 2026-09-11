-- 046 — add the Physics syllabus node "Units & Measurements" (phy_11).
--
-- Why: the 2026-09-02 question-bank replacement ships 38 authored chapters,
-- one of which ("Units & Measurements") has no node in the live taxonomy,
-- while the live node phy_09 ("Work, Energy and Power") has no authored
-- chapter. The taxonomy is referenced by frontend/src/data/syllabusData.ts,
-- assess.test_blueprint and learn.unit_material, so the chosen resolution is
-- to ADD the missing node rather than renumber or repurpose an existing one:
-- phy_09 keeps its identity (and, for now, zero published questions — the
-- assembler's existing "not enough questions" path covers that), and the 30
-- Units & Measurements questions get a home of their own.
--
-- Idempotent: safe to re-run.

begin;

insert into catalog.syllabus_node (
  syllabus_version_id, subject_id, parent_node_id, tag_code, node_type,
  title, class_level, depth, display_order, sort_order, is_active
)
select
  n.syllabus_version_id,
  n.subject_id,
  null,
  'phy_11',
  'unit',
  'Units & Measurements',
  'Class 11',
  0,
  11,
  0,
  true
from catalog.syllabus_node n
where n.tag_code = 'phy_10'
  and not exists (select 1 from catalog.syllabus_node x where x.tag_code = 'phy_11');

commit;
