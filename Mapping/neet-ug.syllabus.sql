-- =====================================================================
-- NEET (UG) — full syllabus tree and concept mapping
-- Extends neet-ug.exam-template.sql (task 3 of the delivery plan)
--
-- WHAT THIS FILE DOES
-- Builds out the complete NEET-UG syllabus tree for all four subjects
-- (Physics, Chemistry, Botany, Zoology) via catalog.upsert_syllabus_node,
-- then bridges every taggable topic to its canonical concept via
-- catalog.map_node_concept. This is the "repeated for every unit/chapter/
-- topic" extension the exam-template file's own comment calls for.
--
-- APPROACH — read before treating unit numbers as official
-- NEET's syllabus is close to 1:1 with the NCERT-derived concept tree, so
-- each concept-tree CHAPTER (depth 3, taggable) became one syllabus UNIT,
-- wrapped in a single synthetic CH01 "chapter" layer (since the 4-level
-- schema always has unit -> chapter -> topic, even when a real NEET unit
-- corresponds to exactly one NCERT chapter with no further sub-chapters),
-- and each concept TOPIC became one syllabus TOPIC underneath, mapped
-- 1:1 via map_node_concept. Unit numbers were assigned sequentially in
-- concept-tree file order, EXCEPT PHY/U08 ("Motion of System of Particles
-- and Rigid Body" / Rotational Motion), which reuses the exact unit,
-- chapter and topic numbers neet-ug.exam-template.sql already established
-- (T01=Rolling Motion Without Slipping, T02=Moment of Inertia — its two
-- remaining topics, Torque and Angular Momentum, were added as T03/T04).
--
-- These unit numbers are stable internal keys, not asserted to be the
-- exact current NTA-published unit numbering — the exam-template file's
-- own OPEN ITEM already flags 2026 paper format details as unconfirmed;
-- the same caveat applies here. Weightage is left null throughout (no
-- percentage figures are asserted); fill in from the official bulletin's
-- weightage table before relying on it for blueprint generation.
--
-- Every taggable concept topic in all four subjects is now reachable from
-- NEET-UG — see the verification queries below.
--
-- Prerequisites: 010_question_model.sql, 000_template_helpers.sql,
--                all five subjects/*.concept-tree.sql, neet-ug.exam-template.sql
-- Re-running this file is safe: every line upserts.
-- Fix pass: added the missing depth-1 subject-level root syllabus node
-- ('unit'-less catalog.upsert_syllabus_node(..., '<SUBJ>', '<Name>', 'subject', 1, null))
-- for every subject in this file, since upsert_syllabus_node requires a
-- node's parent path to already exist and only the exam-template file's
-- own demo subject had one. Caught by actually running this chain against
-- a live database rather than static review. Safe to leave in even for the
-- one subject the exam-template file already created it for (upsert).
-- =====================================================================

-- ===== PHY =====
insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'NEET-UG'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'PHY'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY', 'Physics', 'subject', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U01', 'Physical World and Measurement', 'unit', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U01/CH01', 'Physical World and Measurement', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U01/CH01/T01', 'Units and Measurement', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U01/CH01/T02', 'Dimensional Analysis', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U01/CH01/T03', 'Errors in Measurement', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U02', 'Kinematics', 'unit', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U02/CH01', 'Kinematics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U02/CH01/T01', 'Motion in a Straight Line', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U02/CH01/T02', 'Projectile Motion', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U02/CH01/T03', 'Relative Velocity', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U03', 'Laws of Motion', 'unit', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U03/CH01', 'Laws of Motion', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U03/CH01/T01', 'Newton''s Laws of Motion', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U03/CH01/T02', 'Friction', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U03/CH01/T03', 'Dynamics of Circular Motion', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U04', 'Work, Energy and Power', 'unit', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U04/CH01', 'Work, Energy and Power', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U04/CH01/T01', 'Work and the Work-Energy Theorem', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U04/CH01/T02', 'Kinetic and Potential Energy', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U04/CH01/T03', 'Collisions', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08', 'Motion of System of Particles and Rigid Body', 'unit', 8, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01', 'Rotational Motion', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T02', 'Moment of Inertia', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T03', 'Torque and Angular Acceleration', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T01', 'Rolling Motion Without Slipping', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T04', 'Angular Momentum and Its Conservation', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U05', 'Gravitation', 'unit', 5, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U05/CH01', 'Gravitation', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U05/CH01/T01', 'Newton''s Law of Gravitation', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U05/CH01/T02', 'Orbital Velocity and Satellites', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U05/CH01/T03', 'Escape Velocity', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U06', 'Properties of Bulk Matter', 'unit', 6, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U06/CH01', 'Properties of Bulk Matter', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U06/CH01/T01', 'Elasticity', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U06/CH01/T02', 'Fluid Mechanics', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U06/CH01/T03', 'Surface Tension', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U07', 'Thermodynamics', 'unit', 7, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01', 'Thermodynamics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01/T01', 'Zeroth Law of Thermodynamics', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01/T02', 'First Law of Thermodynamics', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01/T03', 'Second Law of Thermodynamics', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01/T04', 'Heat Engines and Refrigerators', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U09', 'Kinetic Theory of Gases', 'unit', 9, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U09/CH01', 'Kinetic Theory of Gases', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U09/CH01/T01', 'Ideal Gas Equation', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U09/CH01/T02', 'Degrees of Freedom', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U09/CH01/T03', 'Mean Free Path', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U10', 'Oscillations', 'unit', 10, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U10/CH01', 'Oscillations', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U10/CH01/T01', 'Simple Harmonic Motion', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U10/CH01/T02', 'Simple Pendulum', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U10/CH01/T03', 'Resonance', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U11', 'Waves', 'unit', 11, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U11/CH01', 'Waves', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U11/CH01/T01', 'Wave Equation and Speed of a Wave', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U11/CH01/T02', 'Superposition of Waves', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U11/CH01/T03', 'Doppler Effect', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U12', 'Electrostatics', 'unit', 12, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01', 'Electrostatics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01/T01', 'Coulomb''s Law', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01/T02', 'Electric Field and Field Lines', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01/T03', 'Gauss''s Law', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01/T04', 'Capacitance and Capacitors', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U13', 'Current Electricity', 'unit', 13, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01', 'Current Electricity', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01/T01', 'Ohm''s Law and Resistance', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01/T02', 'Kirchhoff''s Laws', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01/T03', 'Wheatstone Bridge', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01/T04', 'Potentiometer', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U14', 'Magnetic Effects of Current', 'unit', 14, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U14/CH01', 'Magnetic Effects of Current', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U14/CH01/T01', 'Biot-Savart Law', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U14/CH01/T02', 'Ampere''s Circuital Law', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U14/CH01/T03', 'Force on Moving Charges and Current-Carrying Conductors', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U15', 'Electromagnetic Induction and AC', 'unit', 15, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01', 'Electromagnetic Induction and AC', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01/T01', 'Faraday''s Laws of Induction', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01/T02', 'Lenz''s Law', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01/T03', 'LCR Circuits', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01/T04', 'Transformers and AC Generators', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U16', 'Electromagnetic Waves', 'unit', 16, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U16/CH01', 'Electromagnetic Waves', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U16/CH01/T01', 'Electromagnetic Spectrum', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U16/CH01/T02', 'Displacement Current', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U17', 'Ray Optics', 'unit', 17, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01', 'Ray Optics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01/T01', 'Reflection of Light', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01/T02', 'Refraction of Light', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01/T03', 'Lenses and the Lens Maker''s Equation', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01/T04', 'Optical Instruments', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U18', 'Wave Optics', 'unit', 18, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U18/CH01', 'Wave Optics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U18/CH01/T01', 'Interference of Light', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U18/CH01/T02', 'Diffraction of Light', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U18/CH01/T03', 'Polarization of Light', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U19', 'Dual Nature of Matter and Radiation', 'unit', 19, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U19/CH01', 'Dual Nature of Matter and Radiation', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U19/CH01/T01', 'Photoelectric Effect', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U19/CH01/T02', 'de Broglie Wavelength', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U20', 'Atoms and Nuclei', 'unit', 20, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U20/CH01', 'Atoms and Nuclei', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U20/CH01/T01', 'Bohr Model of the Atom', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U20/CH01/T02', 'Radioactivity', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U20/CH01/T03', 'Nuclear Binding Energy and Mass Defect', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U21', 'Electronic Devices', 'unit', 21, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01', 'Electronic Devices', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01/T01', 'Semiconductors', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01/T02', 'Diodes and Rectifiers', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01/T03', 'Transistors', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01/T04', 'Logic Gates', 'topic', 4, null);

select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U01/CH01/T01', 'PHY/MECH/MEAS/UNITS');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U01/CH01/T02', 'PHY/MECH/MEAS/DIMEN');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U01/CH01/T03', 'PHY/MECH/MEAS/ERROR');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U02/CH01/T01', 'PHY/MECH/KINEM/MOT1D');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U02/CH01/T02', 'PHY/MECH/KINEM/PROJ');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U02/CH01/T03', 'PHY/MECH/KINEM/RELVEL');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U03/CH01/T01', 'PHY/MECH/LAWMO/NEWTON');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U03/CH01/T02', 'PHY/MECH/LAWMO/FRIC');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U03/CH01/T03', 'PHY/MECH/LAWMO/CIRCDY');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U04/CH01/T01', 'PHY/MECH/WORKEN/WORK');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U04/CH01/T02', 'PHY/MECH/WORKEN/KINEN');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U04/CH01/T03', 'PHY/MECH/WORKEN/COLLIS');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T02', 'PHY/MECH/ROTMO/MOMIN');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T03', 'PHY/MECH/ROTMO/TORQUE');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T01', 'PHY/MECH/ROTMO/ROLL');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01/T04', 'PHY/MECH/ROTMO/ANGMOM');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U05/CH01/T01', 'PHY/MECH/GRAV/NEWGRAV');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U05/CH01/T02', 'PHY/MECH/GRAV/ORBIT');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U05/CH01/T03', 'PHY/MECH/GRAV/ESCVEL');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U06/CH01/T01', 'PHY/MECH/PROPMA/ELAST');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U06/CH01/T02', 'PHY/MECH/PROPMA/FLUID');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U06/CH01/T03', 'PHY/MECH/PROPMA/SURFT');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01/T01', 'PHY/THERM/THERMO/ZEROTH');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01/T02', 'PHY/THERM/THERMO/FIRSTL');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01/T03', 'PHY/THERM/THERMO/SECONDL');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01/T04', 'PHY/THERM/THERMO/HEATENG');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U09/CH01/T01', 'PHY/THERM/KINTHE/IDEALG');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U09/CH01/T02', 'PHY/THERM/KINTHE/DEGFRE');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U09/CH01/T03', 'PHY/THERM/KINTHE/MEANFP');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U10/CH01/T01', 'PHY/OSCWA/OSCIL/SHM');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U10/CH01/T02', 'PHY/OSCWA/OSCIL/PENDUL');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U10/CH01/T03', 'PHY/OSCWA/OSCIL/RESON');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U11/CH01/T01', 'PHY/OSCWA/WAVES/WAVEQ');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U11/CH01/T02', 'PHY/OSCWA/WAVES/SUPERP');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U11/CH01/T03', 'PHY/OSCWA/WAVES/DOPPLE');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01/T01', 'PHY/ELEC/ELSTAT/COULOM');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01/T02', 'PHY/ELEC/ELSTAT/EFIELD');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01/T03', 'PHY/ELEC/ELSTAT/GAUSS');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01/T04', 'PHY/ELEC/ELSTAT/CAPAC');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01/T01', 'PHY/ELEC/CURELE/OHMS');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01/T02', 'PHY/ELEC/CURELE/KIRCH');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01/T03', 'PHY/ELEC/CURELE/WHEAT');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01/T04', 'PHY/ELEC/CURELE/POTMET');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U14/CH01/T01', 'PHY/ELEC/MAGEFF/BIOTSA');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U14/CH01/T02', 'PHY/ELEC/MAGEFF/AMPERE');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U14/CH01/T03', 'PHY/ELEC/MAGEFF/MOVCHG');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01/T01', 'PHY/ELEC/EMIND/FARADA');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01/T02', 'PHY/ELEC/EMIND/LENZ');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01/T03', 'PHY/ELEC/EMIND/LCR');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01/T04', 'PHY/ELEC/EMIND/TRANSF');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U16/CH01/T01', 'PHY/ELEC/EMWAVE/EMSPEC');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U16/CH01/T02', 'PHY/ELEC/EMWAVE/DISPLC');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01/T01', 'PHY/OPTIC/RAYOPT/REFLEC');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01/T02', 'PHY/OPTIC/RAYOPT/REFRAC');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01/T03', 'PHY/OPTIC/RAYOPT/LENSES');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01/T04', 'PHY/OPTIC/RAYOPT/OPTINS');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U18/CH01/T01', 'PHY/OPTIC/WAVOPT/INTERF');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U18/CH01/T02', 'PHY/OPTIC/WAVOPT/DIFFRA');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U18/CH01/T03', 'PHY/OPTIC/WAVOPT/POLARI');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U19/CH01/T01', 'PHY/MODRN/DUALNM/PHOTOE');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U19/CH01/T02', 'PHY/MODRN/DUALNM/DEBROG');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U20/CH01/T01', 'PHY/MODRN/ATOMS/BOHR');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U20/CH01/T02', 'PHY/MODRN/ATOMS/RADIOA');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U20/CH01/T03', 'PHY/MODRN/ATOMS/NUCBIN');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01/T01', 'PHY/MODRN/ELDEV/SEMICO');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01/T02', 'PHY/MODRN/ELDEV/DIODE');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01/T03', 'PHY/MODRN/ELDEV/TRANSI');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01/T04', 'PHY/MODRN/ELDEV/LOGIC');


-- Chapter-level tags for PHY -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U01/CH01', 'PHY/MECH/MEAS');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U02/CH01', 'PHY/MECH/KINEM');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U03/CH01', 'PHY/MECH/LAWMO');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U04/CH01', 'PHY/MECH/WORKEN');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U08/CH01', 'PHY/MECH/ROTMO');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U05/CH01', 'PHY/MECH/GRAV');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U06/CH01', 'PHY/MECH/PROPMA');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U07/CH01', 'PHY/THERM/THERMO');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U09/CH01', 'PHY/THERM/KINTHE');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U10/CH01', 'PHY/OSCWA/OSCIL');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U11/CH01', 'PHY/OSCWA/WAVES');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U12/CH01', 'PHY/ELEC/ELSTAT');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U13/CH01', 'PHY/ELEC/CURELE');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U14/CH01', 'PHY/ELEC/MAGEFF');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U15/CH01', 'PHY/ELEC/EMIND');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U16/CH01', 'PHY/ELEC/EMWAVE');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U17/CH01', 'PHY/OPTIC/RAYOPT');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U18/CH01', 'PHY/OPTIC/WAVOPT');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U19/CH01', 'PHY/MODRN/DUALNM');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U20/CH01', 'PHY/MODRN/ATOMS');
select catalog.map_node_concept('NEET-UG', 'PHY', '2026', 'PHY/U21/CH01', 'PHY/MODRN/ELDEV');
-- ===== CHE =====
insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'NEET-UG'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'CHE'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE', 'Chemistry', 'subject', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U01', 'Some Basic Concepts of Chemistry', 'unit', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01', 'Some Basic Concepts of Chemistry', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01/T01', 'Mole Concept', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01/T02', 'Stoichiometry', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01/T03', 'Significant Figures', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01/T04', 'Empirical and Molecular Formula', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U02', 'Structure of Atom', 'unit', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U02/CH01', 'Structure of Atom', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U02/CH01/T01', 'Quantum Mechanical Model of the Atom', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U02/CH01/T02', 'Atomic Orbitals and Quantum Numbers', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U02/CH01/T03', 'Aufbau Principle and Electronic Configuration', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U03', 'States of Matter', 'unit', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U03/CH01', 'States of Matter', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U03/CH01/T01', 'Gas Laws', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U03/CH01/T02', 'Real Gases and van der Waals Equation', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U03/CH01/T03', 'Liquid State', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U04', 'Thermodynamics', 'unit', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01', 'Thermodynamics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01/T01', 'Enthalpy', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01/T02', 'Entropy', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01/T03', 'Gibbs Free Energy', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01/T04', 'Hess''s Law', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U05', 'Equilibrium', 'unit', 5, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01', 'Equilibrium', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01/T01', 'Chemical Equilibrium', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01/T02', 'Ionic Equilibrium', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01/T03', 'pH and Buffer Solutions', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01/T04', 'Solubility Product', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U06', 'Redox Reactions', 'unit', 6, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U06/CH01', 'Redox Reactions', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U06/CH01/T01', 'Oxidation Number', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U06/CH01/T02', 'Balancing Redox Reactions', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U07', 'Electrochemistry', 'unit', 7, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U07/CH01', 'Electrochemistry', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U07/CH01/T01', 'Conductance of Electrolytic Solutions', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U07/CH01/T02', 'Nernst Equation', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U07/CH01/T03', 'Electrolysis and Faraday''s Laws', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U08', 'Chemical Kinetics', 'unit', 8, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U08/CH01', 'Chemical Kinetics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U08/CH01/T01', 'Rate Law and Rate Constant', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U08/CH01/T02', 'Order and Molecularity of Reactions', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U08/CH01/T03', 'Arrhenius Equation', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U09', 'Solutions', 'unit', 9, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U09/CH01', 'Solutions', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U09/CH01/T01', 'Concentration Units', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U09/CH01/T02', 'Raoult''s Law', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U09/CH01/T03', 'Colligative Properties', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U10', 'Classification of Elements and Periodicity', 'unit', 10, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U10/CH01', 'Classification of Elements and Periodicity', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U10/CH01/T01', 'Periodic Trends', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U10/CH01/T02', 'Ionization Enthalpy', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U10/CH01/T03', 'Electron Gain Enthalpy and Electronegativity', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U11', 'Chemical Bonding and Molecular Structure', 'unit', 11, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01', 'Chemical Bonding and Molecular Structure', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01/T01', 'Lewis Structures and Ionic/Covalent Bonding', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01/T02', 'VSEPR Theory', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01/T03', 'Hybridization', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01/T04', 'Molecular Orbital Theory', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U12', 'Hydrogen', 'unit', 12, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U12/CH01', 'Hydrogen', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U12/CH01/T01', 'Isotopes of Hydrogen', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U12/CH01/T02', 'Properties of Water', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U12/CH01/T03', 'Hydrides', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U13', 's-Block Elements', 'unit', 13, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U13/CH01', 's-Block Elements', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U13/CH01/T01', 'Alkali Metals', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U13/CH01/T02', 'Alkaline Earth Metals', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U14', 'p-Block Elements', 'unit', 14, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01', 'p-Block Elements', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T01', 'Group 13 Elements', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T02', 'Group 14 Elements', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T03', 'Group 15 Elements', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T04', 'Group 16 Elements', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T05', 'Group 17 Elements', 'topic', 5, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T06', 'Group 18 Elements', 'topic', 6, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U15', 'd- and f-Block Elements', 'unit', 15, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U15/CH01', 'd- and f-Block Elements', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U15/CH01/T01', 'Transition Elements', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U15/CH01/T02', 'Lanthanoids', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U15/CH01/T03', 'Actinoids', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U16', 'Coordination Compounds', 'unit', 16, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U16/CH01', 'Coordination Compounds', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U16/CH01/T01', 'Nomenclature of Coordination Compounds', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U16/CH01/T02', 'Isomerism in Coordination Compounds', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U16/CH01/T03', 'Crystal Field Theory', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U17', 'General Organic Chemistry and Purification', 'unit', 17, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01', 'General Organic Chemistry and Purification', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01/T01', 'IUPAC Nomenclature', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01/T02', 'Inductive Effect', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01/T03', 'Resonance and Hyperconjugation', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01/T04', 'Reaction Mechanisms and Purification Techniques', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U18', 'Hydrocarbons', 'unit', 18, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01', 'Hydrocarbons', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01/T01', 'Alkanes', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01/T02', 'Alkenes', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01/T03', 'Alkynes', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01/T04', 'Aromatic Hydrocarbons', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U19', 'Haloalkanes and Haloarenes', 'unit', 19, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U19/CH01', 'Haloalkanes and Haloarenes', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U19/CH01/T01', 'SN1 and SN2 Reactions', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U19/CH01/T02', 'Elimination Reactions', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U20', 'Alcohols, Phenols and Ethers', 'unit', 20, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U20/CH01', 'Alcohols, Phenols and Ethers', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U20/CH01/T01', 'Alcohols', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U20/CH01/T02', 'Phenols', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U20/CH01/T03', 'Ethers', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U21', 'Aldehydes, Ketones and Carboxylic Acids', 'unit', 21, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U21/CH01', 'Aldehydes, Ketones and Carboxylic Acids', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U21/CH01/T01', 'Nucleophilic Addition Reactions', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U21/CH01/T02', 'Aldol Condensation', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U21/CH01/T03', 'Acidity of Carboxylic Acids', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U22', 'Amines', 'unit', 22, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U22/CH01', 'Amines', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U22/CH01/T01', 'Basicity of Amines', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U22/CH01/T02', 'Diazonium Salts', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U23', 'Biomolecules', 'unit', 23, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01', 'Biomolecules', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01/T01', 'Carbohydrates', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01/T02', 'Proteins', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01/T03', 'Nucleic Acids', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01/T04', 'Vitamins', 'topic', 4, null);

select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01/T01', 'CHE/PHYCHE/SOMBAS/MOLE');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01/T02', 'CHE/PHYCHE/SOMBAS/STOICH');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01/T03', 'CHE/PHYCHE/SOMBAS/SIGFIG');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01/T04', 'CHE/PHYCHE/SOMBAS/EMPFOR');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U02/CH01/T01', 'CHE/PHYCHE/STRATO/QUANTM');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U02/CH01/T02', 'CHE/PHYCHE/STRATO/ORBITL');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U02/CH01/T03', 'CHE/PHYCHE/STRATO/AUFBAU');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U03/CH01/T01', 'CHE/PHYCHE/STATES/GASLAW');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U03/CH01/T02', 'CHE/PHYCHE/STATES/REALGA');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U03/CH01/T03', 'CHE/PHYCHE/STATES/LIQUID');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01/T01', 'CHE/PHYCHE/THERMO/ENTHAL');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01/T02', 'CHE/PHYCHE/THERMO/ENTROP');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01/T03', 'CHE/PHYCHE/THERMO/GIBBS');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01/T04', 'CHE/PHYCHE/THERMO/HESS');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01/T01', 'CHE/PHYCHE/EQUIL/CHEMEQ');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01/T02', 'CHE/PHYCHE/EQUIL/IONEQ');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01/T03', 'CHE/PHYCHE/EQUIL/PHBUFF');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01/T04', 'CHE/PHYCHE/EQUIL/SOLPRO');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U06/CH01/T01', 'CHE/PHYCHE/REDOX/OXNUM');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U06/CH01/T02', 'CHE/PHYCHE/REDOX/BALRED');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U07/CH01/T01', 'CHE/PHYCHE/ELCHEM/CONDUC');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U07/CH01/T02', 'CHE/PHYCHE/ELCHEM/NERNST');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U07/CH01/T03', 'CHE/PHYCHE/ELCHEM/ELECTL');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U08/CH01/T01', 'CHE/PHYCHE/KINET/RATELW');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U08/CH01/T02', 'CHE/PHYCHE/KINET/ORDER');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U08/CH01/T03', 'CHE/PHYCHE/KINET/ARRHEN');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U09/CH01/T01', 'CHE/PHYCHE/SOLUT/CONCUN');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U09/CH01/T02', 'CHE/PHYCHE/SOLUT/RAOULT');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U09/CH01/T03', 'CHE/PHYCHE/SOLUT/COLLIG');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U10/CH01/T01', 'CHE/INORG/CLASPE/PERTRE');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U10/CH01/T02', 'CHE/INORG/CLASPE/IONENE');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U10/CH01/T03', 'CHE/INORG/CLASPE/ELECAF');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01/T01', 'CHE/INORG/BONDST/LEWIS');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01/T02', 'CHE/INORG/BONDST/VSEPR');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01/T03', 'CHE/INORG/BONDST/HYBRID');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01/T04', 'CHE/INORG/BONDST/MOTHEO');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U12/CH01/T01', 'CHE/INORG/HYDROG/ISOTOP');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U12/CH01/T02', 'CHE/INORG/HYDROG/WATER');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U12/CH01/T03', 'CHE/INORG/HYDROG/HYDRID');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U13/CH01/T01', 'CHE/INORG/SBLOCK/ALKALI');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U13/CH01/T02', 'CHE/INORG/SBLOCK/ALKEAR');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T01', 'CHE/INORG/PBLOCK/GRP13');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T02', 'CHE/INORG/PBLOCK/GRP14');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T03', 'CHE/INORG/PBLOCK/GRP15');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T04', 'CHE/INORG/PBLOCK/GRP16');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T05', 'CHE/INORG/PBLOCK/GRP17');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01/T06', 'CHE/INORG/PBLOCK/GRP18');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U15/CH01/T01', 'CHE/INORG/DFBLOC/TRANSI');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U15/CH01/T02', 'CHE/INORG/DFBLOC/LANTHA');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U15/CH01/T03', 'CHE/INORG/DFBLOC/ACTINI');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U16/CH01/T01', 'CHE/INORG/COORD/NOMENC');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U16/CH01/T02', 'CHE/INORG/COORD/ISOMER');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U16/CH01/T03', 'CHE/INORG/COORD/CFTHEO');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01/T01', 'CHE/ORGAN/GOCPUR/IUPAC');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01/T02', 'CHE/ORGAN/GOCPUR/INDUCT');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01/T03', 'CHE/ORGAN/GOCPUR/RESONA');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01/T04', 'CHE/ORGAN/GOCPUR/MECHAN');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01/T01', 'CHE/ORGAN/HYDROC/ALKANE');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01/T02', 'CHE/ORGAN/HYDROC/ALKENE');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01/T03', 'CHE/ORGAN/HYDROC/ALKYNE');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01/T04', 'CHE/ORGAN/HYDROC/AROMAT');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U19/CH01/T01', 'CHE/ORGAN/HALOAL/SN1SN2');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U19/CH01/T02', 'CHE/ORGAN/HALOAL/ELIMIN');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U20/CH01/T01', 'CHE/ORGAN/ALCPHE/ALCOHO');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U20/CH01/T02', 'CHE/ORGAN/ALCPHE/PHENOL');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U20/CH01/T03', 'CHE/ORGAN/ALCPHE/ETHERS');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U21/CH01/T01', 'CHE/ORGAN/ALDKET/NUCADD');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U21/CH01/T02', 'CHE/ORGAN/ALDKET/ALDOL');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U21/CH01/T03', 'CHE/ORGAN/ALDKET/ACIDIT');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U22/CH01/T01', 'CHE/ORGAN/AMINES/BASICI');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U22/CH01/T02', 'CHE/ORGAN/AMINES/DIAZON');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01/T01', 'CHE/ORGAN/BIOMOL/CARBOH');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01/T02', 'CHE/ORGAN/BIOMOL/PROTEI');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01/T03', 'CHE/ORGAN/BIOMOL/NUCACI');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01/T04', 'CHE/ORGAN/BIOMOL/VITAMI');


-- Chapter-level tags for CHE -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U01/CH01', 'CHE/PHYCHE/SOMBAS');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U02/CH01', 'CHE/PHYCHE/STRATO');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U03/CH01', 'CHE/PHYCHE/STATES');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U04/CH01', 'CHE/PHYCHE/THERMO');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U05/CH01', 'CHE/PHYCHE/EQUIL');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U06/CH01', 'CHE/PHYCHE/REDOX');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U07/CH01', 'CHE/PHYCHE/ELCHEM');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U08/CH01', 'CHE/PHYCHE/KINET');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U09/CH01', 'CHE/PHYCHE/SOLUT');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U10/CH01', 'CHE/INORG/CLASPE');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U11/CH01', 'CHE/INORG/BONDST');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U12/CH01', 'CHE/INORG/HYDROG');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U13/CH01', 'CHE/INORG/SBLOCK');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U14/CH01', 'CHE/INORG/PBLOCK');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U15/CH01', 'CHE/INORG/DFBLOC');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U16/CH01', 'CHE/INORG/COORD');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U17/CH01', 'CHE/ORGAN/GOCPUR');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U18/CH01', 'CHE/ORGAN/HYDROC');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U19/CH01', 'CHE/ORGAN/HALOAL');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U20/CH01', 'CHE/ORGAN/ALCPHE');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U21/CH01', 'CHE/ORGAN/ALDKET');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U22/CH01', 'CHE/ORGAN/AMINES');
select catalog.map_node_concept('NEET-UG', 'CHE', '2026', 'CHE/U23/CH01', 'CHE/ORGAN/BIOMOL');
-- ===== BOT =====
insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'NEET-UG'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'BOT'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT', 'Botany', 'subject', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U01', 'The Living World', 'unit', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U01/CH01', 'The Living World', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U01/CH01/T01', 'Taxonomic Categories and Hierarchy', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U01/CH01/T02', 'Taxonomical Aids', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02', 'Biological Classification and Plant Kingdom', 'unit', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01', 'Biological Classification and Plant Kingdom', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T01', 'Kingdom Monera', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T02', 'Kingdom Protista', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T03', 'Kingdom Fungi', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T04', 'Algae', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T05', 'Bryophytes', 'topic', 5, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T06', 'Pteridophytes', 'topic', 6, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T07', 'Gymnosperms', 'topic', 7, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T08', 'Angiosperms', 'topic', 8, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U03', 'Morphology of Flowering Plants', 'unit', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01', 'Morphology of Flowering Plants', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T01', 'The Root System', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T02', 'The Stem', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T03', 'The Leaf', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T04', 'The Flower', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T05', 'The Fruit and Seed', 'topic', 5, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U04', 'Anatomy of Flowering Plants', 'unit', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U04/CH01', 'Anatomy of Flowering Plants', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U04/CH01/T01', 'Plant Tissues and Tissue Systems', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U04/CH01/T02', 'Vascular Bundles in Root, Stem and Leaf', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U04/CH01/T03', 'Secondary Growth', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U05', 'Cell: The Unit of Life', 'unit', 5, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U05/CH01', 'Cell: The Unit of Life', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U05/CH01/T01', 'Cell Organelles', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U05/CH01/T02', 'Cell Wall and Cell Membrane', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U05/CH01/T03', 'Plastids', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U06', 'Biomolecules and Enzymes', 'unit', 6, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U06/CH01', 'Biomolecules and Enzymes', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U06/CH01/T01', 'Enzymes and Enzyme Kinetics', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U06/CH01/T02', 'Structure and Classification of Biomolecules', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U07', 'Cell Cycle and Cell Division', 'unit', 7, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U07/CH01', 'Cell Cycle and Cell Division', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U07/CH01/T01', 'Mitosis', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U07/CH01/T02', 'Meiosis', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U08', 'Transport in Plants', 'unit', 8, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U08/CH01', 'Transport in Plants', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U08/CH01/T01', 'Diffusion, Osmosis and Plasmolysis', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U08/CH01/T02', 'Transpiration', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U08/CH01/T03', 'Ascent of Sap', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U09', 'Mineral Nutrition', 'unit', 9, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U09/CH01', 'Mineral Nutrition', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U09/CH01/T01', 'Essential Macro- and Micronutrients', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U09/CH01/T02', 'Biological Nitrogen Fixation', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U10', 'Photosynthesis in Higher Plants', 'unit', 10, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01', 'Photosynthesis in Higher Plants', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01/T01', 'Light Reaction (Photochemical Phase)', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01/T02', 'Calvin Cycle (C3 Pathway)', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01/T03', 'C4 Pathway (Hatch-Slack Pathway)', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01/T04', 'Photorespiration', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U11', 'Respiration in Plants', 'unit', 11, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U11/CH01', 'Respiration in Plants', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U11/CH01/T01', 'Glycolysis', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U11/CH01/T02', 'Krebs Cycle (Citric Acid Cycle)', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U11/CH01/T03', 'Electron Transport Chain and Oxidative Phosphorylation', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U12', 'Plant Growth and Development', 'unit', 12, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U12/CH01', 'Plant Growth and Development', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U12/CH01/T01', 'Plant Growth Regulators', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U12/CH01/T02', 'Photoperiodism', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U12/CH01/T03', 'Vernalization', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U13', 'Sexual Reproduction in Flowering Plants', 'unit', 13, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01', 'Sexual Reproduction in Flowering Plants', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01/T01', 'Microsporogenesis and Male Gametophyte', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01/T02', 'Megasporogenesis and Female Gametophyte', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01/T03', 'Pollination', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01/T04', 'Double Fertilization', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U14', 'Principles of Inheritance and Variation', 'unit', 14, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01', 'Principles of Inheritance and Variation', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01/T01', 'Mendelian Inheritance', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01/T02', 'Linkage and Recombination', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01/T03', 'Pedigree Analysis', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01/T04', 'Chromosomal Disorders and Mutation', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U15', 'Molecular Basis of Inheritance', 'unit', 15, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01', 'Molecular Basis of Inheritance', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01/T01', 'DNA Replication', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01/T02', 'Transcription', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01/T03', 'Translation', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01/T04', 'Lac Operon and Gene Regulation', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U16', 'Ecology and Environment', 'unit', 16, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01', 'Ecology and Environment', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01/T01', 'Population Ecology', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01/T02', 'Ecosystem Structure and Function', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01/T03', 'Biodiversity and Conservation', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01/T04', 'Environmental Pollution', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U17', 'Biotechnology and its Applications', 'unit', 17, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U17/CH01', 'Biotechnology and its Applications', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U17/CH01/T01', 'Recombinant DNA Technology', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U17/CH01/T02', 'PCR and Molecular Diagnostics', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'BOT', '2026', 'BOT/U17/CH01/T03', 'Genetically Modified Crops', 'topic', 3, null);

select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U01/CH01/T01', 'BOT/DIVER/LIVWOR/TAXCAT');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U01/CH01/T02', 'BOT/DIVER/LIVWOR/TAXAID');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T01', 'BOT/DIVER/PLNKIN/MONERA');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T02', 'BOT/DIVER/PLNKIN/PROTIS');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T03', 'BOT/DIVER/PLNKIN/FUNGI');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T04', 'BOT/DIVER/PLNKIN/ALGAE');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T05', 'BOT/DIVER/PLNKIN/BRYOPH');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T06', 'BOT/DIVER/PLNKIN/PTERID');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T07', 'BOT/DIVER/PLNKIN/GYMNOS');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01/T08', 'BOT/DIVER/PLNKIN/ANGIOS');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T01', 'BOT/DIVER/MORPHO/ROOT');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T02', 'BOT/DIVER/MORPHO/STEM');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T03', 'BOT/DIVER/MORPHO/LEAF');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T04', 'BOT/DIVER/MORPHO/FLOWER');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01/T05', 'BOT/DIVER/MORPHO/FRUIT');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U04/CH01/T01', 'BOT/STRUC/ANATOM/TISSUE');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U04/CH01/T02', 'BOT/STRUC/ANATOM/VASCUL');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U04/CH01/T03', 'BOT/STRUC/ANATOM/SECGRO');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U05/CH01/T01', 'BOT/STRUC/CELUNI/ORGANE');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U05/CH01/T02', 'BOT/STRUC/CELUNI/CELWAL');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U05/CH01/T03', 'BOT/STRUC/CELUNI/PLASTI');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U06/CH01/T01', 'BOT/STRUC/BIOMOL/ENZKIN');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U06/CH01/T02', 'BOT/STRUC/BIOMOL/METABO');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U07/CH01/T01', 'BOT/STRUC/CELDIV/MITOSI');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U07/CH01/T02', 'BOT/STRUC/CELDIV/MEIOSI');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U08/CH01/T01', 'BOT/PLPHY/TRANSP/OSMOSI');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U08/CH01/T02', 'BOT/PLPHY/TRANSP/TRANSPI');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U08/CH01/T03', 'BOT/PLPHY/TRANSP/ASCENT');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U09/CH01/T01', 'BOT/PLPHY/MINNUT/MACROE');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U09/CH01/T02', 'BOT/PLPHY/MINNUT/NITFIX');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01/T01', 'BOT/PLPHY/PHOTOS/LIGHTR');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01/T02', 'BOT/PLPHY/PHOTOS/CALVIN');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01/T03', 'BOT/PLPHY/PHOTOS/C4PATH');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01/T04', 'BOT/PLPHY/PHOTOS/PHOTOR');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U11/CH01/T01', 'BOT/PLPHY/RESPIR/GLYCOL');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U11/CH01/T02', 'BOT/PLPHY/RESPIR/KREBS');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U11/CH01/T03', 'BOT/PLPHY/RESPIR/ETSCHN');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U12/CH01/T01', 'BOT/PLPHY/PLGROW/HORMON');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U12/CH01/T02', 'BOT/PLPHY/PLGROW/PHOTOP');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U12/CH01/T03', 'BOT/PLPHY/PLGROW/VERNAL');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01/T01', 'BOT/REPGE/PLREPR/MICROS');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01/T02', 'BOT/REPGE/PLREPR/MEGASP');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01/T03', 'BOT/REPGE/PLREPR/POLLIN');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01/T04', 'BOT/REPGE/PLREPR/DOUFER');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01/T01', 'BOT/REPGE/INHERI/MENDEL');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01/T02', 'BOT/REPGE/INHERI/LINKAG');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01/T03', 'BOT/REPGE/INHERI/PEDIGR');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01/T04', 'BOT/REPGE/INHERI/MUTATI');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01/T01', 'BOT/REPGE/MOLBAS/DNAREP');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01/T02', 'BOT/REPGE/MOLBAS/TRANSC');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01/T03', 'BOT/REPGE/MOLBAS/TRANSL');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01/T04', 'BOT/REPGE/MOLBAS/LACOPE');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01/T01', 'BOT/REPGE/ECOLOG/POPULA');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01/T02', 'BOT/REPGE/ECOLOG/ECOSYS');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01/T03', 'BOT/REPGE/ECOLOG/BIODIV');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01/T04', 'BOT/REPGE/ECOLOG/POLLUT');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U17/CH01/T01', 'BOT/REPGE/BIOTEC/RDNA');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U17/CH01/T02', 'BOT/REPGE/BIOTEC/PCRTEC');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U17/CH01/T03', 'BOT/REPGE/BIOTEC/GMCROP');


-- Chapter-level tags for BOT -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U01/CH01', 'BOT/DIVER/LIVWOR');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U02/CH01', 'BOT/DIVER/PLNKIN');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U03/CH01', 'BOT/DIVER/MORPHO');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U04/CH01', 'BOT/STRUC/ANATOM');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U05/CH01', 'BOT/STRUC/CELUNI');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U06/CH01', 'BOT/STRUC/BIOMOL');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U07/CH01', 'BOT/STRUC/CELDIV');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U08/CH01', 'BOT/PLPHY/TRANSP');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U09/CH01', 'BOT/PLPHY/MINNUT');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U10/CH01', 'BOT/PLPHY/PHOTOS');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U11/CH01', 'BOT/PLPHY/RESPIR');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U12/CH01', 'BOT/PLPHY/PLGROW');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U13/CH01', 'BOT/REPGE/PLREPR');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U14/CH01', 'BOT/REPGE/INHERI');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U15/CH01', 'BOT/REPGE/MOLBAS');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U16/CH01', 'BOT/REPGE/ECOLOG');
select catalog.map_node_concept('NEET-UG', 'BOT', '2026', 'BOT/U17/CH01', 'BOT/REPGE/BIOTEC');
-- ===== ZOO =====
insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'NEET-UG'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'ZOO'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO', 'Zoology', 'subject', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U01', 'Animal Kingdom', 'unit', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01', 'Animal Kingdom', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T01', 'Phylum Porifera', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T02', 'Phylum Cnidaria', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T03', 'Phylum Platyhelminthes', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T04', 'Phylum Arthropoda', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T05', 'Phylum Chordata', 'topic', 5, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U02', 'Structural Organisation in Animals', 'unit', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01', 'Structural Organisation in Animals', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01/T01', 'Epithelial Tissue', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01/T02', 'Connective Tissue', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01/T03', 'Muscular Tissue', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01/T04', 'Neural Tissue', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U03', 'Digestion and Absorption', 'unit', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U03/CH01', 'Digestion and Absorption', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U03/CH01/T01', 'Alimentary Canal and Digestive Glands', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U03/CH01/T02', 'Digestive Enzymes and Digestion of Food', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U03/CH01/T03', 'Absorption of Digested Products', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U04', 'Breathing and Exchange of Gases', 'unit', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U04/CH01', 'Breathing and Exchange of Gases', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U04/CH01/T01', 'Mechanism of Breathing', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U04/CH01/T02', 'Transport of Oxygen', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U04/CH01/T03', 'Transport of Carbon Dioxide', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U05', 'Body Fluids and Circulation', 'unit', 5, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U05/CH01', 'Body Fluids and Circulation', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U05/CH01/T01', 'Blood and Lymph', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U05/CH01/T02', 'Cardiac Cycle', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U05/CH01/T03', 'Electrocardiograph (ECG)', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U06', 'Excretory Products and their Elimination', 'unit', 6, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U06/CH01', 'Excretory Products and their Elimination', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U06/CH01/T01', 'Structure of Nephron', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U06/CH01/T02', 'Urine Formation', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U06/CH01/T03', 'Osmoregulation', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U07', 'Locomotion and Movement', 'unit', 7, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U07/CH01', 'Locomotion and Movement', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U07/CH01/T01', 'Mechanism of Muscle Contraction', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U07/CH01/T02', 'Skeletal System', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U07/CH01/T03', 'Joints', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U08', 'Neural Control and Coordination', 'unit', 8, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01', 'Neural Control and Coordination', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01/T01', 'Neuron Structure and Types', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01/T02', 'Generation and Conduction of Nerve Impulse', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01/T03', 'Human Brain', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01/T04', 'Reflex Action', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U09', 'Chemical Coordination and Integration', 'unit', 9, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01', 'Chemical Coordination and Integration', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01/T01', 'Pituitary Gland', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01/T02', 'Thyroid and Parathyroid Glands', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01/T03', 'Pancreas as an Endocrine Gland', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01/T04', 'Adrenal Gland', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U10', 'Human Reproduction', 'unit', 10, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01', 'Human Reproduction', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01/T01', 'Gametogenesis', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01/T02', 'Menstrual Cycle', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01/T03', 'Fertilisation', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01/T04', 'Pregnancy and Placenta', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U11', 'Reproductive Health', 'unit', 11, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U11/CH01', 'Reproductive Health', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U11/CH01/T01', 'Contraceptive Methods', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U11/CH01/T02', 'Assisted Reproductive Technologies', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U11/CH01/T03', 'Sexually Transmitted Infections', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U12', 'Human Health and Disease', 'unit', 12, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U12/CH01', 'Human Health and Disease', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U12/CH01/T01', 'Immunity', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U12/CH01/T02', 'Common Diseases in Humans', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U12/CH01/T03', 'Cancer and AIDS', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U13', 'Evolution', 'unit', 13, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01', 'Evolution', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01/T01', 'Origin of Life', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01/T02', 'Natural Selection and Darwinism', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01/T03', 'Hardy-Weinberg Principle', 'topic', 3, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01/T04', 'Human Evolution', 'topic', 4, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U14', 'Biology in Human Welfare', 'unit', 14, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U14/CH01', 'Biology in Human Welfare', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U14/CH01/T01', 'Microbes in Human Welfare', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U14/CH01/T02', 'Animal Husbandry', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U15', 'Biotechnology: Principles and Processes', 'unit', 15, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U15/CH01', 'Biotechnology: Principles and Processes', 'chapter', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U15/CH01/T01', 'Restriction Enzymes and Recombinant DNA', 'topic', 1, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U15/CH01/T02', 'Cloning Vectors', 'topic', 2, null);
select catalog.upsert_syllabus_node('NEET-UG', 'ZOO', '2026', 'ZOO/U15/CH01/T03', 'Bioreactors and Downstream Processing', 'topic', 3, null);

select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T01', 'ZOO/ANDIV/ANIKIN/PORIFE');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T02', 'ZOO/ANDIV/ANIKIN/CNIDAR');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T03', 'ZOO/ANDIV/ANIKIN/PLATYH');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T04', 'ZOO/ANDIV/ANIKIN/ARTHRO');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01/T05', 'ZOO/ANDIV/ANIKIN/CHORDA');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01/T01', 'ZOO/ANDIV/STRORG/EPITHE');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01/T02', 'ZOO/ANDIV/STRORG/CONNEC');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01/T03', 'ZOO/ANDIV/STRORG/MUSCLE');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01/T04', 'ZOO/ANDIV/STRORG/NERVET');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U03/CH01/T01', 'ZOO/HUPHY/DIGEST/ALIMEN');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U03/CH01/T02', 'ZOO/HUPHY/DIGEST/ENZDIG');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U03/CH01/T03', 'ZOO/HUPHY/DIGEST/ABSORP');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U04/CH01/T01', 'ZOO/HUPHY/BREATH/RESPMEC');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U04/CH01/T02', 'ZOO/HUPHY/BREATH/O2TRAN');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U04/CH01/T03', 'ZOO/HUPHY/BREATH/CO2TRA');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U05/CH01/T01', 'ZOO/HUPHY/BODFLU/BLOOD');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U05/CH01/T02', 'ZOO/HUPHY/BODFLU/CARDCY');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U05/CH01/T03', 'ZOO/HUPHY/BODFLU/ECGRAM');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U06/CH01/T01', 'ZOO/HUPHY/EXCRET/NEPHRO');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U06/CH01/T02', 'ZOO/HUPHY/EXCRET/URINEF');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U06/CH01/T03', 'ZOO/HUPHY/EXCRET/OSMREG');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U07/CH01/T01', 'ZOO/HUPHY/LOCOMO/MUSCON');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U07/CH01/T02', 'ZOO/HUPHY/LOCOMO/SKELET');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U07/CH01/T03', 'ZOO/HUPHY/LOCOMO/JOINTS');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01/T01', 'ZOO/HUPHY/NEURAL/NEURON');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01/T02', 'ZOO/HUPHY/NEURAL/IMPULS');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01/T03', 'ZOO/HUPHY/NEURAL/BRAIN');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01/T04', 'ZOO/HUPHY/NEURAL/REFLEX');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01/T01', 'ZOO/HUPHY/CHEMCO/PITUIT');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01/T02', 'ZOO/HUPHY/CHEMCO/THYROI');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01/T03', 'ZOO/HUPHY/CHEMCO/PANCRE');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01/T04', 'ZOO/HUPHY/CHEMCO/ADRENA');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01/T01', 'ZOO/HUREP/HUMREP/GAMETO');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01/T02', 'ZOO/HUREP/HUMREP/MENSTR');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01/T03', 'ZOO/HUREP/HUMREP/FERTIL');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01/T04', 'ZOO/HUREP/HUMREP/PLACEN');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U11/CH01/T01', 'ZOO/HUREP/REPHEA/CONTRA');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U11/CH01/T02', 'ZOO/HUREP/REPHEA/ARTREP');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U11/CH01/T03', 'ZOO/HUREP/REPHEA/STDISE');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U12/CH01/T01', 'ZOO/HUREP/HUMHEA/IMMUNI');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U12/CH01/T02', 'ZOO/HUREP/HUMHEA/PATHOG');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U12/CH01/T03', 'ZOO/HUREP/HUMHEA/CANCER');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01/T01', 'ZOO/EVOAP/EVOLUT/ORIGIN');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01/T02', 'ZOO/EVOAP/EVOLUT/NATSEL');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01/T03', 'ZOO/EVOAP/EVOLUT/HARDYW');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01/T04', 'ZOO/EVOAP/EVOLUT/HUMEVO');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U14/CH01/T01', 'ZOO/EVOAP/BIOHUM/MICROB');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U14/CH01/T02', 'ZOO/EVOAP/BIOHUM/ANIHUS');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U15/CH01/T01', 'ZOO/EVOAP/BIOPRI/ENZYME');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U15/CH01/T02', 'ZOO/EVOAP/BIOPRI/VECTOR');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U15/CH01/T03', 'ZOO/EVOAP/BIOPRI/BIOREA');


-- Chapter-level tags for ZOO -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U01/CH01', 'ZOO/ANDIV/ANIKIN');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U02/CH01', 'ZOO/ANDIV/STRORG');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U03/CH01', 'ZOO/HUPHY/DIGEST');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U04/CH01', 'ZOO/HUPHY/BREATH');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U05/CH01', 'ZOO/HUPHY/BODFLU');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U06/CH01', 'ZOO/HUPHY/EXCRET');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U07/CH01', 'ZOO/HUPHY/LOCOMO');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U08/CH01', 'ZOO/HUPHY/NEURAL');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U09/CH01', 'ZOO/HUPHY/CHEMCO');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U10/CH01', 'ZOO/HUREP/HUMREP');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U11/CH01', 'ZOO/HUREP/REPHEA');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U12/CH01', 'ZOO/HUREP/HUMHEA');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U13/CH01', 'ZOO/EVOAP/EVOLUT');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U14/CH01', 'ZOO/EVOAP/BIOHUM');
select catalog.map_node_concept('NEET-UG', 'ZOO', '2026', 'ZOO/U15/CH01', 'ZOO/EVOAP/BIOPRI');
-- Check your work:
--   select tree, node_path from catalog.v_syllabus_tree where exam_code = 'NEET-UG';
--   select * from catalog.v_concept_coverage where exam_code is null and is_taggable;  -- expect 0 rows for PHY/CHE/BOT/ZOO
--   select count(*) from content.v_question_eligibility where exam_code = 'NEET-UG';   -- still 0 until questions are tagged and approved
