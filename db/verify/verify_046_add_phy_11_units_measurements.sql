-- verify 046 — phy_11 "Units & Measurements" exists, is active, and is a
-- Physics unit sitting in the same syllabus version as the other Physics nodes.

select
  n.tag_code,
  n.title,
  s.subject_code,
  n.node_type,
  n.depth,
  n.display_order,
  n.is_active,
  (n.syllabus_version_id = (select syllabus_version_id from catalog.syllabus_node where tag_code = 'phy_10'))
    as same_syllabus_version_as_phy_10
from catalog.syllabus_node n
join catalog.subject s on s.subject_id = n.subject_id
where n.tag_code = 'phy_11';

-- Physics node count should now be 11, and every tag_code unique.
select count(*) as physics_nodes,
       count(distinct n.tag_code) as distinct_tag_codes
from catalog.syllabus_node n
join catalog.subject s on s.subject_id = n.subject_id
where s.subject_code = 'PHY';
