-- =====================================================================
-- JEE Main — full syllabus tree and concept mapping
-- Extends jee-main.exam-template.sql (task 3 of the delivery plan)
--
-- WHAT THIS FILE DOES
-- Builds out the complete JEE Main syllabus tree for Physics, Chemistry
-- and Mathematics via catalog.upsert_syllabus_node, then bridges every
-- taggable topic to its canonical concept via catalog.map_node_concept.
--
-- APPROACH
-- Same unit -> single CH01 chapter -> topic pattern as neet-ug.syllabus.sql,
-- numbered independently per subject (JEE Main has its own syllabus_version
-- row per subject; NEET's unit numbers and this file's don't correspond to
-- each other — they're both just stable internal keys within their own
-- exam).
--
-- ONE STRUCTURAL EXCEPTION, and it's worth reading: jee-main.exam-template.sql
-- already inserted MAT/U09 ("Differential Calculus") / MAT/U09/CH02
-- ("Continuity and Differentiability") / MAT/U09/CH02/T01 (Rolle's Theorem
-- and Lagrange's Mean Value Theorem). That single worked example proves
-- JEE Main's own official chapter list does NOT always match how the
-- concept tree groups NCERT chapters — the concept tree keeps "Limits and
-- Continuity" and "Differentiation and its Applications" as two separate
-- chapters, but JEE Main's real syllabus evidently treats continuity and
-- differentiability as one combined official unit. Rather than silently
-- picking one or the other, this file interprets MAT/U09 as covering BOTH
-- concept chapters — MAT/U09/CH01 = Limits and Continuity (new),
-- MAT/U09/CH02 = Continuity and Differentiability (the pre-existing
-- chapter, extended with the three other Differentiation topics as
-- T02-T04 alongside the existing T01). This is an interpretive call, not
-- a confirmed fact from the official JEE Main syllabus PDF — flag it for
-- a subject-expert check, and expect other spots where JEE Main's real
-- chapter grouping likewise splits or merges differently from the
-- concept tree's NCERT-chapter grouping. Where that's true and undetected
-- here, the syllabus tree will still be complete and every topic still
-- correctly bridged to its concept — only the chapter-level grouping
-- label might not match the official bulletin's own wording.
--
-- Every taggable concept topic in Physics, Chemistry and Mathematics is
-- now reachable from JEE Main — see the verification queries below.
--
-- Prerequisites: 010_question_model.sql, 000_template_helpers.sql,
--                physics/chemistry/mathematics.concept-tree.sql,
--                jee-main.exam-template.sql
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
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'JEE-MAIN'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'PHY'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY', 'Physics', 'subject', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U01', 'Physical World and Measurement', 'unit', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U01/CH01', 'Physical World and Measurement', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U01/CH01/T01', 'Units and Measurement', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U01/CH01/T02', 'Dimensional Analysis', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U01/CH01/T03', 'Errors in Measurement', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U02', 'Kinematics', 'unit', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U02/CH01', 'Kinematics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U02/CH01/T01', 'Motion in a Straight Line', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U02/CH01/T02', 'Projectile Motion', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U02/CH01/T03', 'Relative Velocity', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U03', 'Laws of Motion', 'unit', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U03/CH01', 'Laws of Motion', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U03/CH01/T01', 'Newton''s Laws of Motion', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U03/CH01/T02', 'Friction', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U03/CH01/T03', 'Dynamics of Circular Motion', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U04', 'Work, Energy and Power', 'unit', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U04/CH01', 'Work, Energy and Power', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U04/CH01/T01', 'Work and the Work-Energy Theorem', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U04/CH01/T02', 'Kinetic and Potential Energy', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U04/CH01/T03', 'Collisions', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U05', 'Rotational Motion', 'unit', 5, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01', 'Rotational Motion', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01/T01', 'Moment of Inertia', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01/T02', 'Torque and Angular Acceleration', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01/T03', 'Rolling Motion Without Slipping', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01/T04', 'Angular Momentum and Its Conservation', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U06', 'Gravitation', 'unit', 6, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U06/CH01', 'Gravitation', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U06/CH01/T01', 'Newton''s Law of Gravitation', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U06/CH01/T02', 'Orbital Velocity and Satellites', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U06/CH01/T03', 'Escape Velocity', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U07', 'Properties of Bulk Matter', 'unit', 7, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U07/CH01', 'Properties of Bulk Matter', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U07/CH01/T01', 'Elasticity', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U07/CH01/T02', 'Fluid Mechanics', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U07/CH01/T03', 'Surface Tension', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U08', 'Thermodynamics', 'unit', 8, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01', 'Thermodynamics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01/T01', 'Zeroth Law of Thermodynamics', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01/T02', 'First Law of Thermodynamics', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01/T03', 'Second Law of Thermodynamics', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01/T04', 'Heat Engines and Refrigerators', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U09', 'Kinetic Theory of Gases', 'unit', 9, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U09/CH01', 'Kinetic Theory of Gases', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U09/CH01/T01', 'Ideal Gas Equation', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U09/CH01/T02', 'Degrees of Freedom', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U09/CH01/T03', 'Mean Free Path', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U10', 'Oscillations', 'unit', 10, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U10/CH01', 'Oscillations', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U10/CH01/T01', 'Simple Harmonic Motion', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U10/CH01/T02', 'Simple Pendulum', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U10/CH01/T03', 'Resonance', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U11', 'Waves', 'unit', 11, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U11/CH01', 'Waves', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U11/CH01/T01', 'Wave Equation and Speed of a Wave', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U11/CH01/T02', 'Superposition of Waves', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U11/CH01/T03', 'Doppler Effect', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U12', 'Electrostatics', 'unit', 12, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01', 'Electrostatics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01/T01', 'Coulomb''s Law', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01/T02', 'Electric Field and Field Lines', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01/T03', 'Gauss''s Law', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01/T04', 'Capacitance and Capacitors', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U13', 'Current Electricity', 'unit', 13, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01', 'Current Electricity', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01/T01', 'Ohm''s Law and Resistance', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01/T02', 'Kirchhoff''s Laws', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01/T03', 'Wheatstone Bridge', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01/T04', 'Potentiometer', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U14', 'Magnetic Effects of Current', 'unit', 14, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U14/CH01', 'Magnetic Effects of Current', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U14/CH01/T01', 'Biot-Savart Law', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U14/CH01/T02', 'Ampere''s Circuital Law', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U14/CH01/T03', 'Force on Moving Charges and Current-Carrying Conductors', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U15', 'Electromagnetic Induction and AC', 'unit', 15, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01', 'Electromagnetic Induction and AC', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01/T01', 'Faraday''s Laws of Induction', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01/T02', 'Lenz''s Law', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01/T03', 'LCR Circuits', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01/T04', 'Transformers and AC Generators', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U16', 'Electromagnetic Waves', 'unit', 16, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U16/CH01', 'Electromagnetic Waves', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U16/CH01/T01', 'Electromagnetic Spectrum', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U16/CH01/T02', 'Displacement Current', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U17', 'Ray Optics', 'unit', 17, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01', 'Ray Optics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01/T01', 'Reflection of Light', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01/T02', 'Refraction of Light', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01/T03', 'Lenses and the Lens Maker''s Equation', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01/T04', 'Optical Instruments', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U18', 'Wave Optics', 'unit', 18, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U18/CH01', 'Wave Optics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U18/CH01/T01', 'Interference of Light', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U18/CH01/T02', 'Diffraction of Light', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U18/CH01/T03', 'Polarization of Light', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U19', 'Dual Nature of Matter and Radiation', 'unit', 19, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U19/CH01', 'Dual Nature of Matter and Radiation', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U19/CH01/T01', 'Photoelectric Effect', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U19/CH01/T02', 'de Broglie Wavelength', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U20', 'Atoms and Nuclei', 'unit', 20, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U20/CH01', 'Atoms and Nuclei', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U20/CH01/T01', 'Bohr Model of the Atom', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U20/CH01/T02', 'Radioactivity', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U20/CH01/T03', 'Nuclear Binding Energy and Mass Defect', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U21', 'Electronic Devices', 'unit', 21, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01', 'Electronic Devices', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01/T01', 'Semiconductors', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01/T02', 'Diodes and Rectifiers', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01/T03', 'Transistors', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01/T04', 'Logic Gates', 'topic', 4, null);

select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U01/CH01/T01', 'PHY/MECH/MEAS/UNITS');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U01/CH01/T02', 'PHY/MECH/MEAS/DIMEN');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U01/CH01/T03', 'PHY/MECH/MEAS/ERROR');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U02/CH01/T01', 'PHY/MECH/KINEM/MOT1D');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U02/CH01/T02', 'PHY/MECH/KINEM/PROJ');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U02/CH01/T03', 'PHY/MECH/KINEM/RELVEL');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U03/CH01/T01', 'PHY/MECH/LAWMO/NEWTON');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U03/CH01/T02', 'PHY/MECH/LAWMO/FRIC');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U03/CH01/T03', 'PHY/MECH/LAWMO/CIRCDY');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U04/CH01/T01', 'PHY/MECH/WORKEN/WORK');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U04/CH01/T02', 'PHY/MECH/WORKEN/KINEN');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U04/CH01/T03', 'PHY/MECH/WORKEN/COLLIS');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01/T01', 'PHY/MECH/ROTMO/MOMIN');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01/T02', 'PHY/MECH/ROTMO/TORQUE');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01/T03', 'PHY/MECH/ROTMO/ROLL');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01/T04', 'PHY/MECH/ROTMO/ANGMOM');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U06/CH01/T01', 'PHY/MECH/GRAV/NEWGRAV');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U06/CH01/T02', 'PHY/MECH/GRAV/ORBIT');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U06/CH01/T03', 'PHY/MECH/GRAV/ESCVEL');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U07/CH01/T01', 'PHY/MECH/PROPMA/ELAST');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U07/CH01/T02', 'PHY/MECH/PROPMA/FLUID');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U07/CH01/T03', 'PHY/MECH/PROPMA/SURFT');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01/T01', 'PHY/THERM/THERMO/ZEROTH');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01/T02', 'PHY/THERM/THERMO/FIRSTL');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01/T03', 'PHY/THERM/THERMO/SECONDL');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01/T04', 'PHY/THERM/THERMO/HEATENG');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U09/CH01/T01', 'PHY/THERM/KINTHE/IDEALG');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U09/CH01/T02', 'PHY/THERM/KINTHE/DEGFRE');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U09/CH01/T03', 'PHY/THERM/KINTHE/MEANFP');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U10/CH01/T01', 'PHY/OSCWA/OSCIL/SHM');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U10/CH01/T02', 'PHY/OSCWA/OSCIL/PENDUL');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U10/CH01/T03', 'PHY/OSCWA/OSCIL/RESON');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U11/CH01/T01', 'PHY/OSCWA/WAVES/WAVEQ');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U11/CH01/T02', 'PHY/OSCWA/WAVES/SUPERP');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U11/CH01/T03', 'PHY/OSCWA/WAVES/DOPPLE');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01/T01', 'PHY/ELEC/ELSTAT/COULOM');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01/T02', 'PHY/ELEC/ELSTAT/EFIELD');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01/T03', 'PHY/ELEC/ELSTAT/GAUSS');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01/T04', 'PHY/ELEC/ELSTAT/CAPAC');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01/T01', 'PHY/ELEC/CURELE/OHMS');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01/T02', 'PHY/ELEC/CURELE/KIRCH');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01/T03', 'PHY/ELEC/CURELE/WHEAT');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01/T04', 'PHY/ELEC/CURELE/POTMET');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U14/CH01/T01', 'PHY/ELEC/MAGEFF/BIOTSA');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U14/CH01/T02', 'PHY/ELEC/MAGEFF/AMPERE');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U14/CH01/T03', 'PHY/ELEC/MAGEFF/MOVCHG');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01/T01', 'PHY/ELEC/EMIND/FARADA');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01/T02', 'PHY/ELEC/EMIND/LENZ');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01/T03', 'PHY/ELEC/EMIND/LCR');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01/T04', 'PHY/ELEC/EMIND/TRANSF');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U16/CH01/T01', 'PHY/ELEC/EMWAVE/EMSPEC');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U16/CH01/T02', 'PHY/ELEC/EMWAVE/DISPLC');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01/T01', 'PHY/OPTIC/RAYOPT/REFLEC');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01/T02', 'PHY/OPTIC/RAYOPT/REFRAC');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01/T03', 'PHY/OPTIC/RAYOPT/LENSES');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01/T04', 'PHY/OPTIC/RAYOPT/OPTINS');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U18/CH01/T01', 'PHY/OPTIC/WAVOPT/INTERF');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U18/CH01/T02', 'PHY/OPTIC/WAVOPT/DIFFRA');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U18/CH01/T03', 'PHY/OPTIC/WAVOPT/POLARI');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U19/CH01/T01', 'PHY/MODRN/DUALNM/PHOTOE');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U19/CH01/T02', 'PHY/MODRN/DUALNM/DEBROG');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U20/CH01/T01', 'PHY/MODRN/ATOMS/BOHR');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U20/CH01/T02', 'PHY/MODRN/ATOMS/RADIOA');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U20/CH01/T03', 'PHY/MODRN/ATOMS/NUCBIN');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01/T01', 'PHY/MODRN/ELDEV/SEMICO');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01/T02', 'PHY/MODRN/ELDEV/DIODE');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01/T03', 'PHY/MODRN/ELDEV/TRANSI');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01/T04', 'PHY/MODRN/ELDEV/LOGIC');


-- Chapter-level tags for PHY -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U01/CH01', 'PHY/MECH/MEAS');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U02/CH01', 'PHY/MECH/KINEM');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U03/CH01', 'PHY/MECH/LAWMO');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U04/CH01', 'PHY/MECH/WORKEN');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U05/CH01', 'PHY/MECH/ROTMO');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U06/CH01', 'PHY/MECH/GRAV');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U07/CH01', 'PHY/MECH/PROPMA');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U08/CH01', 'PHY/THERM/THERMO');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U09/CH01', 'PHY/THERM/KINTHE');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U10/CH01', 'PHY/OSCWA/OSCIL');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U11/CH01', 'PHY/OSCWA/WAVES');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U12/CH01', 'PHY/ELEC/ELSTAT');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U13/CH01', 'PHY/ELEC/CURELE');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U14/CH01', 'PHY/ELEC/MAGEFF');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U15/CH01', 'PHY/ELEC/EMIND');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U16/CH01', 'PHY/ELEC/EMWAVE');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U17/CH01', 'PHY/OPTIC/RAYOPT');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U18/CH01', 'PHY/OPTIC/WAVOPT');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U19/CH01', 'PHY/MODRN/DUALNM');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U20/CH01', 'PHY/MODRN/ATOMS');
select catalog.map_node_concept('JEE-MAIN', 'PHY', '2026', 'PHY/U21/CH01', 'PHY/MODRN/ELDEV');
-- ===== CHE =====
insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'JEE-MAIN'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'CHE'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE', 'Chemistry', 'subject', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U01', 'Some Basic Concepts of Chemistry', 'unit', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01', 'Some Basic Concepts of Chemistry', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01/T01', 'Mole Concept', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01/T02', 'Stoichiometry', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01/T03', 'Significant Figures', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01/T04', 'Empirical and Molecular Formula', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U02', 'Structure of Atom', 'unit', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U02/CH01', 'Structure of Atom', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U02/CH01/T01', 'Quantum Mechanical Model of the Atom', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U02/CH01/T02', 'Atomic Orbitals and Quantum Numbers', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U02/CH01/T03', 'Aufbau Principle and Electronic Configuration', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U03', 'States of Matter', 'unit', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U03/CH01', 'States of Matter', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U03/CH01/T01', 'Gas Laws', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U03/CH01/T02', 'Real Gases and van der Waals Equation', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U03/CH01/T03', 'Liquid State', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U04', 'Thermodynamics', 'unit', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01', 'Thermodynamics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01/T01', 'Enthalpy', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01/T02', 'Entropy', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01/T03', 'Gibbs Free Energy', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01/T04', 'Hess''s Law', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U05', 'Equilibrium', 'unit', 5, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01', 'Equilibrium', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01/T01', 'Chemical Equilibrium', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01/T02', 'Ionic Equilibrium', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01/T03', 'pH and Buffer Solutions', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01/T04', 'Solubility Product', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U06', 'Redox Reactions', 'unit', 6, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U06/CH01', 'Redox Reactions', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U06/CH01/T01', 'Oxidation Number', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U06/CH01/T02', 'Balancing Redox Reactions', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U07', 'Electrochemistry', 'unit', 7, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U07/CH01', 'Electrochemistry', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U07/CH01/T01', 'Conductance of Electrolytic Solutions', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U07/CH01/T02', 'Nernst Equation', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U07/CH01/T03', 'Electrolysis and Faraday''s Laws', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U08', 'Chemical Kinetics', 'unit', 8, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U08/CH01', 'Chemical Kinetics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U08/CH01/T01', 'Rate Law and Rate Constant', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U08/CH01/T02', 'Order and Molecularity of Reactions', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U08/CH01/T03', 'Arrhenius Equation', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U09', 'Solutions', 'unit', 9, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U09/CH01', 'Solutions', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U09/CH01/T01', 'Concentration Units', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U09/CH01/T02', 'Raoult''s Law', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U09/CH01/T03', 'Colligative Properties', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U10', 'Classification of Elements and Periodicity', 'unit', 10, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U10/CH01', 'Classification of Elements and Periodicity', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U10/CH01/T01', 'Periodic Trends', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U10/CH01/T02', 'Ionization Enthalpy', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U10/CH01/T03', 'Electron Gain Enthalpy and Electronegativity', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U11', 'Chemical Bonding and Molecular Structure', 'unit', 11, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01', 'Chemical Bonding and Molecular Structure', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01/T01', 'Lewis Structures and Ionic/Covalent Bonding', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01/T02', 'VSEPR Theory', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01/T03', 'Hybridization', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01/T04', 'Molecular Orbital Theory', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U12', 'Hydrogen', 'unit', 12, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U12/CH01', 'Hydrogen', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U12/CH01/T01', 'Isotopes of Hydrogen', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U12/CH01/T02', 'Properties of Water', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U12/CH01/T03', 'Hydrides', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U13', 's-Block Elements', 'unit', 13, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U13/CH01', 's-Block Elements', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U13/CH01/T01', 'Alkali Metals', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U13/CH01/T02', 'Alkaline Earth Metals', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U14', 'p-Block Elements', 'unit', 14, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01', 'p-Block Elements', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T01', 'Group 13 Elements', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T02', 'Group 14 Elements', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T03', 'Group 15 Elements', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T04', 'Group 16 Elements', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T05', 'Group 17 Elements', 'topic', 5, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T06', 'Group 18 Elements', 'topic', 6, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U15', 'd- and f-Block Elements', 'unit', 15, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U15/CH01', 'd- and f-Block Elements', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U15/CH01/T01', 'Transition Elements', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U15/CH01/T02', 'Lanthanoids', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U15/CH01/T03', 'Actinoids', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U16', 'Coordination Compounds', 'unit', 16, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U16/CH01', 'Coordination Compounds', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U16/CH01/T01', 'Nomenclature of Coordination Compounds', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U16/CH01/T02', 'Isomerism in Coordination Compounds', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U16/CH01/T03', 'Crystal Field Theory', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U17', 'General Organic Chemistry and Purification', 'unit', 17, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01', 'General Organic Chemistry and Purification', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01/T01', 'IUPAC Nomenclature', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01/T02', 'Inductive Effect', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01/T03', 'Resonance and Hyperconjugation', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01/T04', 'Reaction Mechanisms and Purification Techniques', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U18', 'Hydrocarbons', 'unit', 18, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01', 'Hydrocarbons', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01/T01', 'Alkanes', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01/T02', 'Alkenes', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01/T03', 'Alkynes', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01/T04', 'Aromatic Hydrocarbons', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U19', 'Haloalkanes and Haloarenes', 'unit', 19, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U19/CH01', 'Haloalkanes and Haloarenes', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U19/CH01/T01', 'SN1 and SN2 Reactions', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U19/CH01/T02', 'Elimination Reactions', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U20', 'Alcohols, Phenols and Ethers', 'unit', 20, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U20/CH01', 'Alcohols, Phenols and Ethers', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U20/CH01/T01', 'Alcohols', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U20/CH01/T02', 'Phenols', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U20/CH01/T03', 'Ethers', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U21', 'Aldehydes, Ketones and Carboxylic Acids', 'unit', 21, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U21/CH01', 'Aldehydes, Ketones and Carboxylic Acids', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U21/CH01/T01', 'Nucleophilic Addition Reactions', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U21/CH01/T02', 'Aldol Condensation', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U21/CH01/T03', 'Acidity of Carboxylic Acids', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U22', 'Amines', 'unit', 22, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U22/CH01', 'Amines', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U22/CH01/T01', 'Basicity of Amines', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U22/CH01/T02', 'Diazonium Salts', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U23', 'Biomolecules', 'unit', 23, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01', 'Biomolecules', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01/T01', 'Carbohydrates', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01/T02', 'Proteins', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01/T03', 'Nucleic Acids', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01/T04', 'Vitamins', 'topic', 4, null);

select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01/T01', 'CHE/PHYCHE/SOMBAS/MOLE');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01/T02', 'CHE/PHYCHE/SOMBAS/STOICH');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01/T03', 'CHE/PHYCHE/SOMBAS/SIGFIG');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01/T04', 'CHE/PHYCHE/SOMBAS/EMPFOR');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U02/CH01/T01', 'CHE/PHYCHE/STRATO/QUANTM');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U02/CH01/T02', 'CHE/PHYCHE/STRATO/ORBITL');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U02/CH01/T03', 'CHE/PHYCHE/STRATO/AUFBAU');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U03/CH01/T01', 'CHE/PHYCHE/STATES/GASLAW');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U03/CH01/T02', 'CHE/PHYCHE/STATES/REALGA');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U03/CH01/T03', 'CHE/PHYCHE/STATES/LIQUID');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01/T01', 'CHE/PHYCHE/THERMO/ENTHAL');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01/T02', 'CHE/PHYCHE/THERMO/ENTROP');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01/T03', 'CHE/PHYCHE/THERMO/GIBBS');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01/T04', 'CHE/PHYCHE/THERMO/HESS');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01/T01', 'CHE/PHYCHE/EQUIL/CHEMEQ');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01/T02', 'CHE/PHYCHE/EQUIL/IONEQ');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01/T03', 'CHE/PHYCHE/EQUIL/PHBUFF');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01/T04', 'CHE/PHYCHE/EQUIL/SOLPRO');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U06/CH01/T01', 'CHE/PHYCHE/REDOX/OXNUM');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U06/CH01/T02', 'CHE/PHYCHE/REDOX/BALRED');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U07/CH01/T01', 'CHE/PHYCHE/ELCHEM/CONDUC');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U07/CH01/T02', 'CHE/PHYCHE/ELCHEM/NERNST');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U07/CH01/T03', 'CHE/PHYCHE/ELCHEM/ELECTL');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U08/CH01/T01', 'CHE/PHYCHE/KINET/RATELW');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U08/CH01/T02', 'CHE/PHYCHE/KINET/ORDER');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U08/CH01/T03', 'CHE/PHYCHE/KINET/ARRHEN');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U09/CH01/T01', 'CHE/PHYCHE/SOLUT/CONCUN');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U09/CH01/T02', 'CHE/PHYCHE/SOLUT/RAOULT');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U09/CH01/T03', 'CHE/PHYCHE/SOLUT/COLLIG');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U10/CH01/T01', 'CHE/INORG/CLASPE/PERTRE');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U10/CH01/T02', 'CHE/INORG/CLASPE/IONENE');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U10/CH01/T03', 'CHE/INORG/CLASPE/ELECAF');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01/T01', 'CHE/INORG/BONDST/LEWIS');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01/T02', 'CHE/INORG/BONDST/VSEPR');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01/T03', 'CHE/INORG/BONDST/HYBRID');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01/T04', 'CHE/INORG/BONDST/MOTHEO');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U12/CH01/T01', 'CHE/INORG/HYDROG/ISOTOP');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U12/CH01/T02', 'CHE/INORG/HYDROG/WATER');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U12/CH01/T03', 'CHE/INORG/HYDROG/HYDRID');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U13/CH01/T01', 'CHE/INORG/SBLOCK/ALKALI');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U13/CH01/T02', 'CHE/INORG/SBLOCK/ALKEAR');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T01', 'CHE/INORG/PBLOCK/GRP13');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T02', 'CHE/INORG/PBLOCK/GRP14');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T03', 'CHE/INORG/PBLOCK/GRP15');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T04', 'CHE/INORG/PBLOCK/GRP16');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T05', 'CHE/INORG/PBLOCK/GRP17');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01/T06', 'CHE/INORG/PBLOCK/GRP18');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U15/CH01/T01', 'CHE/INORG/DFBLOC/TRANSI');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U15/CH01/T02', 'CHE/INORG/DFBLOC/LANTHA');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U15/CH01/T03', 'CHE/INORG/DFBLOC/ACTINI');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U16/CH01/T01', 'CHE/INORG/COORD/NOMENC');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U16/CH01/T02', 'CHE/INORG/COORD/ISOMER');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U16/CH01/T03', 'CHE/INORG/COORD/CFTHEO');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01/T01', 'CHE/ORGAN/GOCPUR/IUPAC');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01/T02', 'CHE/ORGAN/GOCPUR/INDUCT');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01/T03', 'CHE/ORGAN/GOCPUR/RESONA');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01/T04', 'CHE/ORGAN/GOCPUR/MECHAN');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01/T01', 'CHE/ORGAN/HYDROC/ALKANE');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01/T02', 'CHE/ORGAN/HYDROC/ALKENE');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01/T03', 'CHE/ORGAN/HYDROC/ALKYNE');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01/T04', 'CHE/ORGAN/HYDROC/AROMAT');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U19/CH01/T01', 'CHE/ORGAN/HALOAL/SN1SN2');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U19/CH01/T02', 'CHE/ORGAN/HALOAL/ELIMIN');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U20/CH01/T01', 'CHE/ORGAN/ALCPHE/ALCOHO');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U20/CH01/T02', 'CHE/ORGAN/ALCPHE/PHENOL');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U20/CH01/T03', 'CHE/ORGAN/ALCPHE/ETHERS');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U21/CH01/T01', 'CHE/ORGAN/ALDKET/NUCADD');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U21/CH01/T02', 'CHE/ORGAN/ALDKET/ALDOL');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U21/CH01/T03', 'CHE/ORGAN/ALDKET/ACIDIT');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U22/CH01/T01', 'CHE/ORGAN/AMINES/BASICI');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U22/CH01/T02', 'CHE/ORGAN/AMINES/DIAZON');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01/T01', 'CHE/ORGAN/BIOMOL/CARBOH');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01/T02', 'CHE/ORGAN/BIOMOL/PROTEI');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01/T03', 'CHE/ORGAN/BIOMOL/NUCACI');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01/T04', 'CHE/ORGAN/BIOMOL/VITAMI');


-- Chapter-level tags for CHE -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U01/CH01', 'CHE/PHYCHE/SOMBAS');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U02/CH01', 'CHE/PHYCHE/STRATO');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U03/CH01', 'CHE/PHYCHE/STATES');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U04/CH01', 'CHE/PHYCHE/THERMO');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U05/CH01', 'CHE/PHYCHE/EQUIL');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U06/CH01', 'CHE/PHYCHE/REDOX');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U07/CH01', 'CHE/PHYCHE/ELCHEM');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U08/CH01', 'CHE/PHYCHE/KINET');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U09/CH01', 'CHE/PHYCHE/SOLUT');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U10/CH01', 'CHE/INORG/CLASPE');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U11/CH01', 'CHE/INORG/BONDST');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U12/CH01', 'CHE/INORG/HYDROG');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U13/CH01', 'CHE/INORG/SBLOCK');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U14/CH01', 'CHE/INORG/PBLOCK');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U15/CH01', 'CHE/INORG/DFBLOC');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U16/CH01', 'CHE/INORG/COORD');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U17/CH01', 'CHE/ORGAN/GOCPUR');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U18/CH01', 'CHE/ORGAN/HYDROC');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U19/CH01', 'CHE/ORGAN/HALOAL');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U20/CH01', 'CHE/ORGAN/ALCPHE');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U21/CH01', 'CHE/ORGAN/ALDKET');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U22/CH01', 'CHE/ORGAN/AMINES');
select catalog.map_node_concept('JEE-MAIN', 'CHE', '2026', 'CHE/U23/CH01', 'CHE/ORGAN/BIOMOL');
-- ===== MAT =====
insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'JEE-MAIN'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'MAT'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT', 'Mathematics', 'subject', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U01', 'Sets', 'unit', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U01/CH01', 'Sets', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U01/CH01/T01', 'Set Operations', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U01/CH01/T02', 'Venn Diagrams', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U02', 'Relations and Functions', 'unit', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U02/CH01', 'Relations and Functions', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U02/CH01/T01', 'Domain and Range of a Relation', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U02/CH01/T02', 'Composition of Functions', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U02/CH01/T03', 'Inverse of a Function', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U03', 'Trigonometric Functions', 'unit', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U03/CH01', 'Trigonometric Functions', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U03/CH01/T01', 'Trigonometric Identities', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U03/CH01/T02', 'Trigonometric Equations', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U03/CH01/T03', 'Inverse Trigonometric Functions', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U04', 'Complex Numbers and Quadratic Equations', 'unit', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U04/CH01', 'Complex Numbers and Quadratic Equations', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U04/CH01/T01', 'Argand Plane and Polar Representation', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U04/CH01/T02', 'Quadratic Equations and Nature of Roots', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U05', 'Linear Inequalities and Linear Programming', 'unit', 5, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U05/CH01', 'Linear Inequalities and Linear Programming', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U05/CH01/T01', 'Graphical Solution of Linear Inequalities', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U05/CH01/T02', 'Feasible Region and Optimal Solution', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U06', 'Permutations and Combinations', 'unit', 6, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U06/CH01', 'Permutations and Combinations', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U06/CH01/T01', 'Permutations', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U06/CH01/T02', 'Combinations', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U07', 'Binomial Theorem', 'unit', 7, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U07/CH01', 'Binomial Theorem', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U07/CH01/T01', 'General Term of Binomial Expansion', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U07/CH01/T02', 'Middle Term of Binomial Expansion', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U08', 'Sequences and Series', 'unit', 8, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U08/CH01', 'Sequences and Series', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U08/CH01/T01', 'Arithmetic Progression', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U08/CH01/T02', 'Geometric Progression', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U08/CH01/T03', 'Special Series (Sum of Squares and Cubes)', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U10', 'Matrices and Determinants', 'unit', 10, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U10/CH01', 'Matrices and Determinants', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U10/CH01/T01', 'Matrix Operations', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U10/CH01/T02', 'Inverse of a Matrix', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U10/CH01/T03', 'Cramer''s Rule and Systems of Linear Equations', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U11', 'Straight Lines', 'unit', 11, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U11/CH01', 'Straight Lines', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U11/CH01/T01', 'Slope of a Line', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U11/CH01/T02', 'Distance and Section Formulas', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U11/CH01/T03', 'Angle Between Two Lines', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U12', 'Conic Sections', 'unit', 12, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01', 'Conic Sections', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01/T01', 'Circle', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01/T02', 'Parabola', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01/T03', 'Ellipse', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01/T04', 'Hyperbola', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U13', 'Three Dimensional Geometry', 'unit', 13, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U13/CH01', 'Three Dimensional Geometry', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U13/CH01/T01', 'Direction Cosines and Direction Ratios', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U13/CH01/T02', 'Equation of a Line in Space', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U13/CH01/T03', 'Equation of a Plane', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U09', 'Differential Calculus', 'unit', 9, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH01', 'Limits and Continuity', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH01/T01', 'Evaluation of Limits', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH01/T02', 'Continuity of a Function', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02', 'Continuity and Differentiability', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02/T02', 'Chain Rule and Differentiation of Composite Functions', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02/T03', 'Tangents and Normals', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02/T04', 'Maxima and Minima', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02/T01', 'Rolle''s Theorem and Lagrange''s Mean Value Theorem', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U14', 'Integration and its Applications', 'unit', 14, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U14/CH01', 'Integration and its Applications', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U14/CH01/T01', 'Indefinite Integration', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U14/CH01/T02', 'Definite Integration', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U14/CH01/T03', 'Area Under Curves', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U15', 'Differential Equations', 'unit', 15, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U15/CH01', 'Differential Equations', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U15/CH01/T01', 'Variable Separable Method', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U15/CH01/T02', 'First Order Linear Differential Equations', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U16', 'Vector Algebra', 'unit', 16, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U16/CH01', 'Vector Algebra', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U16/CH01/T01', 'Dot Product (Scalar Product)', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U16/CH01/T02', 'Cross Product (Vector Product)', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U16/CH01/T03', 'Scalar Triple Product', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U17', 'Statistics', 'unit', 17, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U17/CH01', 'Statistics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U17/CH01/T01', 'Mean and Median', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U17/CH01/T02', 'Variance and Standard Deviation', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U18', 'Probability', 'unit', 18, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U18/CH01', 'Probability', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U18/CH01/T01', 'Conditional Probability', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U18/CH01/T02', 'Bayes'' Theorem', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-MAIN', 'MAT', '2026', 'MAT/U18/CH01/T03', 'Binomial Distribution', 'topic', 3, null);

select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U01/CH01/T01', 'MAT/SETRE/SETS/SETOPS');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U01/CH01/T02', 'MAT/SETRE/SETS/VENND');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U02/CH01/T01', 'MAT/SETRE/RELFUN/DOMRAN');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U02/CH01/T02', 'MAT/SETRE/RELFUN/COMPOS');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U02/CH01/T03', 'MAT/SETRE/RELFUN/INVERS');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U03/CH01/T01', 'MAT/SETRE/TRIGON/IDENTI');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U03/CH01/T02', 'MAT/SETRE/TRIGON/EQUATN');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U03/CH01/T03', 'MAT/SETRE/TRIGON/INVTRI');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U04/CH01/T01', 'MAT/ALGEB/COMPLX/ARGAND');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U04/CH01/T02', 'MAT/ALGEB/COMPLX/ROOTSQ');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U05/CH01/T01', 'MAT/ALGEB/LINEQ/GRAPHIN');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U05/CH01/T02', 'MAT/ALGEB/LINEQ/FEASIB');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U06/CH01/T01', 'MAT/ALGEB/PERCOM/ARRANG');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U06/CH01/T02', 'MAT/ALGEB/PERCOM/SELECT');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U07/CH01/T01', 'MAT/ALGEB/BINOM/GENTER');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U07/CH01/T02', 'MAT/ALGEB/BINOM/MIDTER');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U08/CH01/T01', 'MAT/ALGEB/SEQSER/APROG');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U08/CH01/T02', 'MAT/ALGEB/SEQSER/GPROG');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U08/CH01/T03', 'MAT/ALGEB/SEQSER/SPECSE');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U10/CH01/T01', 'MAT/ALGEB/MATDET/MATOPS');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U10/CH01/T02', 'MAT/ALGEB/MATDET/INVMAT');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U10/CH01/T03', 'MAT/ALGEB/MATDET/CRAMER');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U11/CH01/T01', 'MAT/COORD/STLINE/SLOPE');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U11/CH01/T02', 'MAT/COORD/STLINE/DISTAN');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U11/CH01/T03', 'MAT/COORD/STLINE/ANGLES');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01/T01', 'MAT/COORD/CONICS/CIRCLE');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01/T02', 'MAT/COORD/CONICS/PARABO');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01/T03', 'MAT/COORD/CONICS/ELLIPS');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01/T04', 'MAT/COORD/CONICS/HYPERB');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U13/CH01/T01', 'MAT/COORD/THREED/DIRCOS');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U13/CH01/T02', 'MAT/COORD/THREED/LINE3D');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U13/CH01/T03', 'MAT/COORD/THREED/PLANE3D');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH01/T01', 'MAT/CALC/LIMCON/LIMEVA');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH01/T02', 'MAT/CALC/LIMCON/CONTIN');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02/T02', 'MAT/CALC/DIFFER/CHAINR');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02/T03', 'MAT/CALC/DIFFER/TANNOR');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02/T04', 'MAT/CALC/DIFFER/MAXMIN');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02/T01', 'MAT/CALC/DIFFER/ROLLLA');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U14/CH01/T01', 'MAT/CALC/INTEGR/INDEFI');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U14/CH01/T02', 'MAT/CALC/INTEGR/DEFINI');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U14/CH01/T03', 'MAT/CALC/INTEGR/AREAUC');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U15/CH01/T01', 'MAT/CALC/DIFFEQ/VARSEP');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U15/CH01/T02', 'MAT/CALC/DIFFEQ/LINEAR1');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U16/CH01/T01', 'MAT/VECST/VECTOR/DOTPRO');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U16/CH01/T02', 'MAT/VECST/VECTOR/CROSSP');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U16/CH01/T03', 'MAT/VECST/VECTOR/SCATRI');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U17/CH01/T01', 'MAT/VECST/STATIS/MEANMD');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U17/CH01/T02', 'MAT/VECST/STATIS/VARSD');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U18/CH01/T01', 'MAT/VECST/PROBAB/CONDPR');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U18/CH01/T02', 'MAT/VECST/PROBAB/BAYES');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U18/CH01/T03', 'MAT/VECST/PROBAB/BINDIS');


-- Chapter-level tags for MAT -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U01/CH01', 'MAT/SETRE/SETS');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U02/CH01', 'MAT/SETRE/RELFUN');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U03/CH01', 'MAT/SETRE/TRIGON');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U04/CH01', 'MAT/ALGEB/COMPLX');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U05/CH01', 'MAT/ALGEB/LINEQ');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U06/CH01', 'MAT/ALGEB/PERCOM');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U07/CH01', 'MAT/ALGEB/BINOM');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U08/CH01', 'MAT/ALGEB/SEQSER');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U10/CH01', 'MAT/ALGEB/MATDET');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U11/CH01', 'MAT/COORD/STLINE');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U12/CH01', 'MAT/COORD/CONICS');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U13/CH01', 'MAT/COORD/THREED');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH01', 'MAT/CALC/LIMCON');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U09/CH02', 'MAT/CALC/DIFFER');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U14/CH01', 'MAT/CALC/INTEGR');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U15/CH01', 'MAT/CALC/DIFFEQ');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U16/CH01', 'MAT/VECST/VECTOR');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U17/CH01', 'MAT/VECST/STATIS');
select catalog.map_node_concept('JEE-MAIN', 'MAT', '2026', 'MAT/U18/CH01', 'MAT/VECST/PROBAB');
-- Check your work:
--   select tree, node_path from catalog.v_syllabus_tree where exam_code = 'JEE-MAIN';
--   select * from catalog.v_concept_coverage where exam_code is null and is_taggable;  -- expect 0 rows for PHY/CHE/MAT
