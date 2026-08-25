-- =====================================================================
-- JEE Advanced — full syllabus tree and concept mapping
-- Extends jee-adv.exam-template.sql (task 3 of the delivery plan)
--
-- WHAT THIS FILE DOES
-- Builds out the complete JEE Advanced syllabus tree for Physics,
-- Chemistry and Mathematics via catalog.upsert_syllabus_node, then
-- bridges every taggable topic to its canonical concept via
-- catalog.map_node_concept.
--
-- APPROACH — different from NEET/JEE Main on purpose
-- JEE Advanced has no officially numbered units (confirmed against the
-- current JEE Advanced syllabus: it's organised as named topic clusters —
-- General, Mechanics, Thermal Physics, Electricity & Magnetism, EM Waves,
-- Optics, Modern Physics for Physics; Physical/Inorganic/Organic for
-- Chemistry; Algebra, Trigonometry, Analytical Geometry, Calculus,
-- Vectors, Probability & Statistics for Mathematics). jee-adv.exam-
-- template.sql's own worked example already reflects this: its unit-level
-- path ('PHY/MECH') reuses the concept tree's own branch code, and its
-- chapter ('PHY/MECH/RIGID', "Rigid Body Dynamics") is an INDEPENDENT
-- grouping distinct from the concept tree's "Rotational Motion" chapter,
-- even though both its topics (ROLL, ANGM) map onto concept topics under
-- PHY/MECH/ROTMO. This file extends that same pattern: every syllabus
-- unit reuses the concept tree's branch code/name directly; every
-- syllabus chapter reuses the concept tree's chapter code/name directly
-- EXCEPT PHY/MECH/RIGID, which stays exactly as the exam-template file
-- defined it and is extended here with its two remaining topics (Moment
-- of Inertia, Torque and Angular Acceleration, as MOMIN/TORQUE) alongside
-- the pre-existing ROLL/ANGM.
--
-- TWO CONFIRMED EXCLUSIONS (checked against the current JEE Advanced
-- syllabus, not carried over from NEET/JEE Main):
--   - Physics: PHY/MODRN/ELDEV (Electronic Devices — semiconductors,
--     diodes, transistors, logic gates) has no JEE Advanced cluster at
--     all; it's a NEET/JEE Main-only addition. Excluded entirely.
--   - Mathematics: MAT/ALGEB/LINEQ (Linear Inequalities and Linear
--     Programming) does not appear in JEE Advanced's syllabus either.
--     Excluded entirely.
-- No other exclusions were applied — Chemistry mirrors the concept tree
-- in full, on the assumption that the concept tree (already scoped to
-- NCERT Class 11-12 core content, no Environmental Chemistry / Isolation
-- of Metals branches) doesn't contain anything else JEE Advanced omits.
-- That assumption, and the exact wording of each JEE Advanced chapter
-- cluster name, still wants a subject-expert pass against the official
-- JAB syllabus PDF before being treated as final — the same posture
-- every concept-tree and exam-template file in this kit already takes.
--
-- Every taggable concept topic in Physics (minus Electronic Devices),
-- Chemistry (in full) and Mathematics (minus Linear Programming) is now
-- reachable from JEE Advanced — see the verification queries below.
--
-- Prerequisites: 010_question_model.sql, 000_template_helpers.sql,
--                physics/chemistry/mathematics.concept-tree.sql,
--                jee-adv.exam-template.sql
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
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'JEE-ADV'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'PHY'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY', 'Physics', 'subject', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH', 'Mechanics', 'unit', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/MEAS', 'Physical World and Measurement', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/MEAS/UNITS', 'Units and Measurement', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/MEAS/DIMEN', 'Dimensional Analysis', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/MEAS/ERROR', 'Errors in Measurement', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/KINEM', 'Kinematics', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/KINEM/MOT1D', 'Motion in a Straight Line', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/KINEM/PROJ', 'Projectile Motion', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/KINEM/RELVEL', 'Relative Velocity', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/LAWMO', 'Laws of Motion', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/LAWMO/NEWTON', 'Newton''s Laws of Motion', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/LAWMO/FRIC', 'Friction', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/LAWMO/CIRCDY', 'Dynamics of Circular Motion', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/WORKEN', 'Work, Energy and Power', 'chapter', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/WORKEN/WORK', 'Work and the Work-Energy Theorem', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/WORKEN/KINEN', 'Kinetic and Potential Energy', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/WORKEN/COLLIS', 'Collisions', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID', 'Rigid Body Dynamics', 'chapter', 5, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/MOMIN', 'Moment of Inertia', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/TORQUE', 'Torque and Angular Acceleration', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/ROLL', 'Rolling on inclined surfaces', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/ANGM', 'Angular momentum and its conservation', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/GRAV', 'Gravitation', 'chapter', 6, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/GRAV/NEWGRAV', 'Newton''s Law of Gravitation', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/GRAV/ORBIT', 'Orbital Velocity and Satellites', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/GRAV/ESCVEL', 'Escape Velocity', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/PROPMA', 'Properties of Bulk Matter', 'chapter', 7, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/PROPMA/ELAST', 'Elasticity', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/PROPMA/FLUID', 'Fluid Mechanics', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MECH/PROPMA/SURFT', 'Surface Tension', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM', 'Thermodynamics and Kinetic Theory', 'unit', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO', 'Thermodynamics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO/ZEROTH', 'Zeroth Law of Thermodynamics', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO/FIRSTL', 'First Law of Thermodynamics', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO/SECONDL', 'Second Law of Thermodynamics', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO/HEATENG', 'Heat Engines and Refrigerators', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM/KINTHE', 'Kinetic Theory of Gases', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM/KINTHE/IDEALG', 'Ideal Gas Equation', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM/KINTHE/DEGFRE', 'Degrees of Freedom', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/THERM/KINTHE/MEANFP', 'Mean Free Path', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA', 'Oscillations and Waves', 'unit', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/OSCIL', 'Oscillations', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/OSCIL/SHM', 'Simple Harmonic Motion', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/OSCIL/PENDUL', 'Simple Pendulum', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/OSCIL/RESON', 'Resonance', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/WAVES', 'Waves', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/WAVES/WAVEQ', 'Wave Equation and Speed of a Wave', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/WAVES/SUPERP', 'Superposition of Waves', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/WAVES/DOPPLE', 'Doppler Effect', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC', 'Electricity and Magnetism', 'unit', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT', 'Electrostatics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT/COULOM', 'Coulomb''s Law', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT/EFIELD', 'Electric Field and Field Lines', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT/GAUSS', 'Gauss''s Law', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT/CAPAC', 'Capacitance and Capacitors', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE', 'Current Electricity', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE/OHMS', 'Ohm''s Law and Resistance', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE/KIRCH', 'Kirchhoff''s Laws', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE/WHEAT', 'Wheatstone Bridge', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE/POTMET', 'Potentiometer', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/MAGEFF', 'Magnetic Effects of Current', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/MAGEFF/BIOTSA', 'Biot-Savart Law', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/MAGEFF/AMPERE', 'Ampere''s Circuital Law', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/MAGEFF/MOVCHG', 'Force on Moving Charges and Current-Carrying Conductors', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND', 'Electromagnetic Induction and AC', 'chapter', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND/FARADA', 'Faraday''s Laws of Induction', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND/LENZ', 'Lenz''s Law', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND/LCR', 'LCR Circuits', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND/TRANSF', 'Transformers and AC Generators', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMWAVE', 'Electromagnetic Waves', 'chapter', 5, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMWAVE/EMSPEC', 'Electromagnetic Spectrum', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMWAVE/DISPLC', 'Displacement Current', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC', 'Optics', 'unit', 5, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT', 'Ray Optics', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT/REFLEC', 'Reflection of Light', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT/REFRAC', 'Refraction of Light', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT/LENSES', 'Lenses and the Lens Maker''s Equation', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT/OPTINS', 'Optical Instruments', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/WAVOPT', 'Wave Optics', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/WAVOPT/INTERF', 'Interference of Light', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/WAVOPT/DIFFRA', 'Diffraction of Light', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/WAVOPT/POLARI', 'Polarization of Light', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MODRN', 'Modern Physics', 'unit', 6, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/DUALNM', 'Dual Nature of Matter and Radiation', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/DUALNM/PHOTOE', 'Photoelectric Effect', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/DUALNM/DEBROG', 'de Broglie Wavelength', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/ATOMS', 'Atoms and Nuclei', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/ATOMS/BOHR', 'Bohr Model of the Atom', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/ATOMS/RADIOA', 'Radioactivity', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/ATOMS/NUCBIN', 'Nuclear Binding Energy and Mass Defect', 'topic', 3, null);

select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/MEAS/UNITS', 'PHY/MECH/MEAS/UNITS');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/MEAS/DIMEN', 'PHY/MECH/MEAS/DIMEN');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/MEAS/ERROR', 'PHY/MECH/MEAS/ERROR');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/KINEM/MOT1D', 'PHY/MECH/KINEM/MOT1D');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/KINEM/PROJ', 'PHY/MECH/KINEM/PROJ');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/KINEM/RELVEL', 'PHY/MECH/KINEM/RELVEL');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/LAWMO/NEWTON', 'PHY/MECH/LAWMO/NEWTON');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/LAWMO/FRIC', 'PHY/MECH/LAWMO/FRIC');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/LAWMO/CIRCDY', 'PHY/MECH/LAWMO/CIRCDY');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/WORKEN/WORK', 'PHY/MECH/WORKEN/WORK');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/WORKEN/KINEN', 'PHY/MECH/WORKEN/KINEN');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/WORKEN/COLLIS', 'PHY/MECH/WORKEN/COLLIS');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/MOMIN', 'PHY/MECH/ROTMO/MOMIN');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/TORQUE', 'PHY/MECH/ROTMO/TORQUE');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/ROLL', 'PHY/MECH/ROTMO/ROLL');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID/ANGM', 'PHY/MECH/ROTMO/ANGMOM');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/GRAV/NEWGRAV', 'PHY/MECH/GRAV/NEWGRAV');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/GRAV/ORBIT', 'PHY/MECH/GRAV/ORBIT');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/GRAV/ESCVEL', 'PHY/MECH/GRAV/ESCVEL');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/PROPMA/ELAST', 'PHY/MECH/PROPMA/ELAST');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/PROPMA/FLUID', 'PHY/MECH/PROPMA/FLUID');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/PROPMA/SURFT', 'PHY/MECH/PROPMA/SURFT');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO/ZEROTH', 'PHY/THERM/THERMO/ZEROTH');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO/FIRSTL', 'PHY/THERM/THERMO/FIRSTL');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO/SECONDL', 'PHY/THERM/THERMO/SECONDL');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO/HEATENG', 'PHY/THERM/THERMO/HEATENG');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/THERM/KINTHE/IDEALG', 'PHY/THERM/KINTHE/IDEALG');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/THERM/KINTHE/DEGFRE', 'PHY/THERM/KINTHE/DEGFRE');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/THERM/KINTHE/MEANFP', 'PHY/THERM/KINTHE/MEANFP');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/OSCIL/SHM', 'PHY/OSCWA/OSCIL/SHM');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/OSCIL/PENDUL', 'PHY/OSCWA/OSCIL/PENDUL');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/OSCIL/RESON', 'PHY/OSCWA/OSCIL/RESON');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/WAVES/WAVEQ', 'PHY/OSCWA/WAVES/WAVEQ');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/WAVES/SUPERP', 'PHY/OSCWA/WAVES/SUPERP');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/WAVES/DOPPLE', 'PHY/OSCWA/WAVES/DOPPLE');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT/COULOM', 'PHY/ELEC/ELSTAT/COULOM');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT/EFIELD', 'PHY/ELEC/ELSTAT/EFIELD');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT/GAUSS', 'PHY/ELEC/ELSTAT/GAUSS');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT/CAPAC', 'PHY/ELEC/ELSTAT/CAPAC');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE/OHMS', 'PHY/ELEC/CURELE/OHMS');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE/KIRCH', 'PHY/ELEC/CURELE/KIRCH');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE/WHEAT', 'PHY/ELEC/CURELE/WHEAT');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE/POTMET', 'PHY/ELEC/CURELE/POTMET');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/MAGEFF/BIOTSA', 'PHY/ELEC/MAGEFF/BIOTSA');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/MAGEFF/AMPERE', 'PHY/ELEC/MAGEFF/AMPERE');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/MAGEFF/MOVCHG', 'PHY/ELEC/MAGEFF/MOVCHG');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND/FARADA', 'PHY/ELEC/EMIND/FARADA');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND/LENZ', 'PHY/ELEC/EMIND/LENZ');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND/LCR', 'PHY/ELEC/EMIND/LCR');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND/TRANSF', 'PHY/ELEC/EMIND/TRANSF');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMWAVE/EMSPEC', 'PHY/ELEC/EMWAVE/EMSPEC');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMWAVE/DISPLC', 'PHY/ELEC/EMWAVE/DISPLC');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT/REFLEC', 'PHY/OPTIC/RAYOPT/REFLEC');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT/REFRAC', 'PHY/OPTIC/RAYOPT/REFRAC');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT/LENSES', 'PHY/OPTIC/RAYOPT/LENSES');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT/OPTINS', 'PHY/OPTIC/RAYOPT/OPTINS');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/WAVOPT/INTERF', 'PHY/OPTIC/WAVOPT/INTERF');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/WAVOPT/DIFFRA', 'PHY/OPTIC/WAVOPT/DIFFRA');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/WAVOPT/POLARI', 'PHY/OPTIC/WAVOPT/POLARI');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/DUALNM/PHOTOE', 'PHY/MODRN/DUALNM/PHOTOE');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/DUALNM/DEBROG', 'PHY/MODRN/DUALNM/DEBROG');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/ATOMS/BOHR', 'PHY/MODRN/ATOMS/BOHR');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/ATOMS/RADIOA', 'PHY/MODRN/ATOMS/RADIOA');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/ATOMS/NUCBIN', 'PHY/MODRN/ATOMS/NUCBIN');


-- Chapter-level tags for PHY -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/MEAS', 'PHY/MECH/MEAS');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/KINEM', 'PHY/MECH/KINEM');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/LAWMO', 'PHY/MECH/LAWMO');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/WORKEN', 'PHY/MECH/WORKEN');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/RIGID', 'PHY/MECH/ROTMO');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/GRAV', 'PHY/MECH/GRAV');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MECH/PROPMA', 'PHY/MECH/PROPMA');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/THERM/THERMO', 'PHY/THERM/THERMO');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/THERM/KINTHE', 'PHY/THERM/KINTHE');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/OSCIL', 'PHY/OSCWA/OSCIL');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OSCWA/WAVES', 'PHY/OSCWA/WAVES');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/ELSTAT', 'PHY/ELEC/ELSTAT');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/CURELE', 'PHY/ELEC/CURELE');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/MAGEFF', 'PHY/ELEC/MAGEFF');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMIND', 'PHY/ELEC/EMIND');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/ELEC/EMWAVE', 'PHY/ELEC/EMWAVE');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/RAYOPT', 'PHY/OPTIC/RAYOPT');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/OPTIC/WAVOPT', 'PHY/OPTIC/WAVOPT');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/DUALNM', 'PHY/MODRN/DUALNM');
select catalog.map_node_concept('JEE-ADV', 'PHY', '2026', 'PHY/MODRN/ATOMS', 'PHY/MODRN/ATOMS');
-- ===== CHE =====
insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'JEE-ADV'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'CHE'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE', 'Chemistry', 'subject', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE', 'Physical Chemistry', 'unit', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS', 'Some Basic Concepts of Chemistry', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS/MOLE', 'Mole Concept', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS/STOICH', 'Stoichiometry', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS/SIGFIG', 'Significant Figures', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS/EMPFOR', 'Empirical and Molecular Formula', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STRATO', 'Structure of Atom', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STRATO/QUANTM', 'Quantum Mechanical Model of the Atom', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STRATO/ORBITL', 'Atomic Orbitals and Quantum Numbers', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STRATO/AUFBAU', 'Aufbau Principle and Electronic Configuration', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STATES', 'States of Matter', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STATES/GASLAW', 'Gas Laws', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STATES/REALGA', 'Real Gases and van der Waals Equation', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STATES/LIQUID', 'Liquid State', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO', 'Thermodynamics', 'chapter', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO/ENTHAL', 'Enthalpy', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO/ENTROP', 'Entropy', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO/GIBBS', 'Gibbs Free Energy', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO/HESS', 'Hess''s Law', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL', 'Equilibrium', 'chapter', 5, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL/CHEMEQ', 'Chemical Equilibrium', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL/IONEQ', 'Ionic Equilibrium', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL/PHBUFF', 'pH and Buffer Solutions', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL/SOLPRO', 'Solubility Product', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/REDOX', 'Redox Reactions', 'chapter', 6, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/REDOX/OXNUM', 'Oxidation Number', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/REDOX/BALRED', 'Balancing Redox Reactions', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/ELCHEM', 'Electrochemistry', 'chapter', 7, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/ELCHEM/CONDUC', 'Conductance of Electrolytic Solutions', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/ELCHEM/NERNST', 'Nernst Equation', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/ELCHEM/ELECTL', 'Electrolysis and Faraday''s Laws', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/KINET', 'Chemical Kinetics', 'chapter', 8, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/KINET/RATELW', 'Rate Law and Rate Constant', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/KINET/ORDER', 'Order and Molecularity of Reactions', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/KINET/ARRHEN', 'Arrhenius Equation', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOLUT', 'Solutions', 'chapter', 9, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOLUT/CONCUN', 'Concentration Units', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOLUT/RAOULT', 'Raoult''s Law', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOLUT/COLLIG', 'Colligative Properties', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG', 'Inorganic Chemistry', 'unit', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/CLASPE', 'Classification of Elements and Periodicity', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/CLASPE/PERTRE', 'Periodic Trends', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/CLASPE/IONENE', 'Ionization Enthalpy', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/CLASPE/ELECAF', 'Electron Gain Enthalpy and Electronegativity', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST', 'Chemical Bonding and Molecular Structure', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST/LEWIS', 'Lewis Structures and Ionic/Covalent Bonding', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST/VSEPR', 'VSEPR Theory', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST/HYBRID', 'Hybridization', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST/MOTHEO', 'Molecular Orbital Theory', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/HYDROG', 'Hydrogen', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/HYDROG/ISOTOP', 'Isotopes of Hydrogen', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/HYDROG/WATER', 'Properties of Water', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/HYDROG/HYDRID', 'Hydrides', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/SBLOCK', 's-Block Elements', 'chapter', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/SBLOCK/ALKALI', 'Alkali Metals', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/SBLOCK/ALKEAR', 'Alkaline Earth Metals', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK', 'p-Block Elements', 'chapter', 5, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP13', 'Group 13 Elements', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP14', 'Group 14 Elements', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP15', 'Group 15 Elements', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP16', 'Group 16 Elements', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP17', 'Group 17 Elements', 'topic', 5, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP18', 'Group 18 Elements', 'topic', 6, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/DFBLOC', 'd- and f-Block Elements', 'chapter', 6, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/DFBLOC/TRANSI', 'Transition Elements', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/DFBLOC/LANTHA', 'Lanthanoids', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/DFBLOC/ACTINI', 'Actinoids', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/COORD', 'Coordination Compounds', 'chapter', 7, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/COORD/NOMENC', 'Nomenclature of Coordination Compounds', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/COORD/ISOMER', 'Isomerism in Coordination Compounds', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/INORG/COORD/CFTHEO', 'Crystal Field Theory', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN', 'Organic Chemistry', 'unit', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR', 'General Organic Chemistry and Purification', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR/IUPAC', 'IUPAC Nomenclature', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR/INDUCT', 'Inductive Effect', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR/RESONA', 'Resonance and Hyperconjugation', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR/MECHAN', 'Reaction Mechanisms and Purification Techniques', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC', 'Hydrocarbons', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC/ALKANE', 'Alkanes', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC/ALKENE', 'Alkenes', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC/ALKYNE', 'Alkynes', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC/AROMAT', 'Aromatic Hydrocarbons', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HALOAL', 'Haloalkanes and Haloarenes', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HALOAL/SN1SN2', 'SN1 and SN2 Reactions', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HALOAL/ELIMIN', 'Elimination Reactions', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALCPHE', 'Alcohols, Phenols and Ethers', 'chapter', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALCPHE/ALCOHO', 'Alcohols', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALCPHE/PHENOL', 'Phenols', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALCPHE/ETHERS', 'Ethers', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALDKET', 'Aldehydes, Ketones and Carboxylic Acids', 'chapter', 5, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALDKET/NUCADD', 'Nucleophilic Addition Reactions', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALDKET/ALDOL', 'Aldol Condensation', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALDKET/ACIDIT', 'Acidity of Carboxylic Acids', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/AMINES', 'Amines', 'chapter', 6, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/AMINES/BASICI', 'Basicity of Amines', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/AMINES/DIAZON', 'Diazonium Salts', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL', 'Biomolecules', 'chapter', 7, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL/CARBOH', 'Carbohydrates', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL/PROTEI', 'Proteins', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL/NUCACI', 'Nucleic Acids', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL/VITAMI', 'Vitamins', 'topic', 4, null);

select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS/MOLE', 'CHE/PHYCHE/SOMBAS/MOLE');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS/STOICH', 'CHE/PHYCHE/SOMBAS/STOICH');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS/SIGFIG', 'CHE/PHYCHE/SOMBAS/SIGFIG');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS/EMPFOR', 'CHE/PHYCHE/SOMBAS/EMPFOR');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STRATO/QUANTM', 'CHE/PHYCHE/STRATO/QUANTM');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STRATO/ORBITL', 'CHE/PHYCHE/STRATO/ORBITL');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STRATO/AUFBAU', 'CHE/PHYCHE/STRATO/AUFBAU');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STATES/GASLAW', 'CHE/PHYCHE/STATES/GASLAW');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STATES/REALGA', 'CHE/PHYCHE/STATES/REALGA');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STATES/LIQUID', 'CHE/PHYCHE/STATES/LIQUID');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO/ENTHAL', 'CHE/PHYCHE/THERMO/ENTHAL');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO/ENTROP', 'CHE/PHYCHE/THERMO/ENTROP');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO/GIBBS', 'CHE/PHYCHE/THERMO/GIBBS');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO/HESS', 'CHE/PHYCHE/THERMO/HESS');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL/CHEMEQ', 'CHE/PHYCHE/EQUIL/CHEMEQ');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL/IONEQ', 'CHE/PHYCHE/EQUIL/IONEQ');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL/PHBUFF', 'CHE/PHYCHE/EQUIL/PHBUFF');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL/SOLPRO', 'CHE/PHYCHE/EQUIL/SOLPRO');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/REDOX/OXNUM', 'CHE/PHYCHE/REDOX/OXNUM');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/REDOX/BALRED', 'CHE/PHYCHE/REDOX/BALRED');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/ELCHEM/CONDUC', 'CHE/PHYCHE/ELCHEM/CONDUC');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/ELCHEM/NERNST', 'CHE/PHYCHE/ELCHEM/NERNST');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/ELCHEM/ELECTL', 'CHE/PHYCHE/ELCHEM/ELECTL');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/KINET/RATELW', 'CHE/PHYCHE/KINET/RATELW');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/KINET/ORDER', 'CHE/PHYCHE/KINET/ORDER');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/KINET/ARRHEN', 'CHE/PHYCHE/KINET/ARRHEN');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOLUT/CONCUN', 'CHE/PHYCHE/SOLUT/CONCUN');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOLUT/RAOULT', 'CHE/PHYCHE/SOLUT/RAOULT');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOLUT/COLLIG', 'CHE/PHYCHE/SOLUT/COLLIG');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/CLASPE/PERTRE', 'CHE/INORG/CLASPE/PERTRE');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/CLASPE/IONENE', 'CHE/INORG/CLASPE/IONENE');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/CLASPE/ELECAF', 'CHE/INORG/CLASPE/ELECAF');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST/LEWIS', 'CHE/INORG/BONDST/LEWIS');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST/VSEPR', 'CHE/INORG/BONDST/VSEPR');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST/HYBRID', 'CHE/INORG/BONDST/HYBRID');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST/MOTHEO', 'CHE/INORG/BONDST/MOTHEO');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/HYDROG/ISOTOP', 'CHE/INORG/HYDROG/ISOTOP');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/HYDROG/WATER', 'CHE/INORG/HYDROG/WATER');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/HYDROG/HYDRID', 'CHE/INORG/HYDROG/HYDRID');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/SBLOCK/ALKALI', 'CHE/INORG/SBLOCK/ALKALI');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/SBLOCK/ALKEAR', 'CHE/INORG/SBLOCK/ALKEAR');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP13', 'CHE/INORG/PBLOCK/GRP13');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP14', 'CHE/INORG/PBLOCK/GRP14');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP15', 'CHE/INORG/PBLOCK/GRP15');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP16', 'CHE/INORG/PBLOCK/GRP16');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP17', 'CHE/INORG/PBLOCK/GRP17');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK/GRP18', 'CHE/INORG/PBLOCK/GRP18');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/DFBLOC/TRANSI', 'CHE/INORG/DFBLOC/TRANSI');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/DFBLOC/LANTHA', 'CHE/INORG/DFBLOC/LANTHA');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/DFBLOC/ACTINI', 'CHE/INORG/DFBLOC/ACTINI');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/COORD/NOMENC', 'CHE/INORG/COORD/NOMENC');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/COORD/ISOMER', 'CHE/INORG/COORD/ISOMER');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/COORD/CFTHEO', 'CHE/INORG/COORD/CFTHEO');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR/IUPAC', 'CHE/ORGAN/GOCPUR/IUPAC');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR/INDUCT', 'CHE/ORGAN/GOCPUR/INDUCT');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR/RESONA', 'CHE/ORGAN/GOCPUR/RESONA');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR/MECHAN', 'CHE/ORGAN/GOCPUR/MECHAN');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC/ALKANE', 'CHE/ORGAN/HYDROC/ALKANE');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC/ALKENE', 'CHE/ORGAN/HYDROC/ALKENE');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC/ALKYNE', 'CHE/ORGAN/HYDROC/ALKYNE');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC/AROMAT', 'CHE/ORGAN/HYDROC/AROMAT');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HALOAL/SN1SN2', 'CHE/ORGAN/HALOAL/SN1SN2');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HALOAL/ELIMIN', 'CHE/ORGAN/HALOAL/ELIMIN');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALCPHE/ALCOHO', 'CHE/ORGAN/ALCPHE/ALCOHO');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALCPHE/PHENOL', 'CHE/ORGAN/ALCPHE/PHENOL');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALCPHE/ETHERS', 'CHE/ORGAN/ALCPHE/ETHERS');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALDKET/NUCADD', 'CHE/ORGAN/ALDKET/NUCADD');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALDKET/ALDOL', 'CHE/ORGAN/ALDKET/ALDOL');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALDKET/ACIDIT', 'CHE/ORGAN/ALDKET/ACIDIT');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/AMINES/BASICI', 'CHE/ORGAN/AMINES/BASICI');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/AMINES/DIAZON', 'CHE/ORGAN/AMINES/DIAZON');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL/CARBOH', 'CHE/ORGAN/BIOMOL/CARBOH');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL/PROTEI', 'CHE/ORGAN/BIOMOL/PROTEI');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL/NUCACI', 'CHE/ORGAN/BIOMOL/NUCACI');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL/VITAMI', 'CHE/ORGAN/BIOMOL/VITAMI');


-- Chapter-level tags for CHE -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOMBAS', 'CHE/PHYCHE/SOMBAS');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STRATO', 'CHE/PHYCHE/STRATO');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/STATES', 'CHE/PHYCHE/STATES');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/THERMO', 'CHE/PHYCHE/THERMO');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/EQUIL', 'CHE/PHYCHE/EQUIL');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/REDOX', 'CHE/PHYCHE/REDOX');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/ELCHEM', 'CHE/PHYCHE/ELCHEM');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/KINET', 'CHE/PHYCHE/KINET');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/PHYCHE/SOLUT', 'CHE/PHYCHE/SOLUT');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/CLASPE', 'CHE/INORG/CLASPE');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/BONDST', 'CHE/INORG/BONDST');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/HYDROG', 'CHE/INORG/HYDROG');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/SBLOCK', 'CHE/INORG/SBLOCK');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/PBLOCK', 'CHE/INORG/PBLOCK');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/DFBLOC', 'CHE/INORG/DFBLOC');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/INORG/COORD', 'CHE/INORG/COORD');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/GOCPUR', 'CHE/ORGAN/GOCPUR');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HYDROC', 'CHE/ORGAN/HYDROC');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/HALOAL', 'CHE/ORGAN/HALOAL');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALCPHE', 'CHE/ORGAN/ALCPHE');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/ALDKET', 'CHE/ORGAN/ALDKET');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/AMINES', 'CHE/ORGAN/AMINES');
select catalog.map_node_concept('JEE-ADV', 'CHE', '2026', 'CHE/ORGAN/BIOMOL', 'CHE/ORGAN/BIOMOL');
-- ===== MAT =====
insert into catalog.syllabus_version (exam_subject_id, version_code, effective_from, version_status)
select es.exam_subject_id, '2026', date '2025-06-01', 'active'
  from catalog.exam_subject es
  join catalog.exam e on e.exam_id = es.exam_id and e.exam_code = 'JEE-ADV'
  join catalog.subject s on s.subject_id = es.subject_id and s.subject_code = 'MAT'
on conflict (exam_subject_id, version_code) do nothing;

select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT', 'Mathematics', 'subject', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE', 'Sets, Relations and Functions', 'unit', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/SETS', 'Sets', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/SETS/SETOPS', 'Set Operations', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/SETS/VENND', 'Venn Diagrams', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/RELFUN', 'Relations and Functions', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/RELFUN/DOMRAN', 'Domain and Range of a Relation', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/RELFUN/COMPOS', 'Composition of Functions', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/RELFUN/INVERS', 'Inverse of a Function', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/TRIGON', 'Trigonometric Functions', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/TRIGON/IDENTI', 'Trigonometric Identities', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/TRIGON/EQUATN', 'Trigonometric Equations', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/TRIGON/INVTRI', 'Inverse Trigonometric Functions', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB', 'Algebra', 'unit', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/COMPLX', 'Complex Numbers and Quadratic Equations', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/COMPLX/ARGAND', 'Argand Plane and Polar Representation', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/COMPLX/ROOTSQ', 'Quadratic Equations and Nature of Roots', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/PERCOM', 'Permutations and Combinations', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/PERCOM/ARRANG', 'Permutations', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/PERCOM/SELECT', 'Combinations', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/BINOM', 'Binomial Theorem', 'chapter', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/BINOM/GENTER', 'General Term of Binomial Expansion', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/BINOM/MIDTER', 'Middle Term of Binomial Expansion', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/SEQSER', 'Sequences and Series', 'chapter', 5, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/SEQSER/APROG', 'Arithmetic Progression', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/SEQSER/GPROG', 'Geometric Progression', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/SEQSER/SPECSE', 'Special Series (Sum of Squares and Cubes)', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/MATDET', 'Matrices and Determinants', 'chapter', 6, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/MATDET/MATOPS', 'Matrix Operations', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/MATDET/INVMAT', 'Inverse of a Matrix', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/MATDET/CRAMER', 'Cramer''s Rule and Systems of Linear Equations', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD', 'Coordinate Geometry', 'unit', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/STLINE', 'Straight Lines', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/STLINE/SLOPE', 'Slope of a Line', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/STLINE/DISTAN', 'Distance and Section Formulas', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/STLINE/ANGLES', 'Angle Between Two Lines', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS', 'Conic Sections', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS/CIRCLE', 'Circle', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS/PARABO', 'Parabola', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS/ELLIPS', 'Ellipse', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS/HYPERB', 'Hyperbola', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/THREED', 'Three Dimensional Geometry', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/THREED/DIRCOS', 'Direction Cosines and Direction Ratios', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/THREED/LINE3D', 'Equation of a Line in Space', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/COORD/THREED/PLANE3D', 'Equation of a Plane', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC', 'Calculus', 'unit', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/LIMCON', 'Limits and Continuity', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/LIMCON/LIMEVA', 'Evaluation of Limits', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/LIMCON/CONTIN', 'Continuity of a Function', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER', 'Differentiation and its Applications', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER/CHAINR', 'Chain Rule and Differentiation of Composite Functions', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER/TANNOR', 'Tangents and Normals', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER/MAXMIN', 'Maxima and Minima', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER/ROLLLA', 'Rolle''s Theorem and Lagrange''s Mean Value Theorem', 'topic', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/INTEGR', 'Integration and its Applications', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/INTEGR/INDEFI', 'Indefinite Integration', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/INTEGR/DEFINI', 'Definite Integration', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/INTEGR/AREAUC', 'Area Under Curves', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFEQ', 'Differential Equations', 'chapter', 4, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFEQ/VARSEP', 'Variable Separable Method', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFEQ/LINEAR1', 'First Order Linear Differential Equations', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST', 'Vectors, Statistics and Probability', 'unit', 5, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/VECTOR', 'Vector Algebra', 'chapter', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/VECTOR/DOTPRO', 'Dot Product (Scalar Product)', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/VECTOR/CROSSP', 'Cross Product (Vector Product)', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/VECTOR/SCATRI', 'Scalar Triple Product', 'topic', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/STATIS', 'Statistics', 'chapter', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/STATIS/MEANMD', 'Mean and Median', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/STATIS/VARSD', 'Variance and Standard Deviation', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/PROBAB', 'Probability', 'chapter', 3, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/PROBAB/CONDPR', 'Conditional Probability', 'topic', 1, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/PROBAB/BAYES', 'Bayes'' Theorem', 'topic', 2, null);
select catalog.upsert_syllabus_node('JEE-ADV', 'MAT', '2026', 'MAT/VECST/PROBAB/BINDIS', 'Binomial Distribution', 'topic', 3, null);

select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/SETS/SETOPS', 'MAT/SETRE/SETS/SETOPS');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/SETS/VENND', 'MAT/SETRE/SETS/VENND');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/RELFUN/DOMRAN', 'MAT/SETRE/RELFUN/DOMRAN');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/RELFUN/COMPOS', 'MAT/SETRE/RELFUN/COMPOS');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/RELFUN/INVERS', 'MAT/SETRE/RELFUN/INVERS');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/TRIGON/IDENTI', 'MAT/SETRE/TRIGON/IDENTI');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/TRIGON/EQUATN', 'MAT/SETRE/TRIGON/EQUATN');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/TRIGON/INVTRI', 'MAT/SETRE/TRIGON/INVTRI');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/COMPLX/ARGAND', 'MAT/ALGEB/COMPLX/ARGAND');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/COMPLX/ROOTSQ', 'MAT/ALGEB/COMPLX/ROOTSQ');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/PERCOM/ARRANG', 'MAT/ALGEB/PERCOM/ARRANG');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/PERCOM/SELECT', 'MAT/ALGEB/PERCOM/SELECT');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/BINOM/GENTER', 'MAT/ALGEB/BINOM/GENTER');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/BINOM/MIDTER', 'MAT/ALGEB/BINOM/MIDTER');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/SEQSER/APROG', 'MAT/ALGEB/SEQSER/APROG');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/SEQSER/GPROG', 'MAT/ALGEB/SEQSER/GPROG');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/SEQSER/SPECSE', 'MAT/ALGEB/SEQSER/SPECSE');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/MATDET/MATOPS', 'MAT/ALGEB/MATDET/MATOPS');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/MATDET/INVMAT', 'MAT/ALGEB/MATDET/INVMAT');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/MATDET/CRAMER', 'MAT/ALGEB/MATDET/CRAMER');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/STLINE/SLOPE', 'MAT/COORD/STLINE/SLOPE');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/STLINE/DISTAN', 'MAT/COORD/STLINE/DISTAN');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/STLINE/ANGLES', 'MAT/COORD/STLINE/ANGLES');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS/CIRCLE', 'MAT/COORD/CONICS/CIRCLE');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS/PARABO', 'MAT/COORD/CONICS/PARABO');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS/ELLIPS', 'MAT/COORD/CONICS/ELLIPS');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS/HYPERB', 'MAT/COORD/CONICS/HYPERB');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/THREED/DIRCOS', 'MAT/COORD/THREED/DIRCOS');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/THREED/LINE3D', 'MAT/COORD/THREED/LINE3D');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/THREED/PLANE3D', 'MAT/COORD/THREED/PLANE3D');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/LIMCON/LIMEVA', 'MAT/CALC/LIMCON/LIMEVA');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/LIMCON/CONTIN', 'MAT/CALC/LIMCON/CONTIN');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER/CHAINR', 'MAT/CALC/DIFFER/CHAINR');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER/TANNOR', 'MAT/CALC/DIFFER/TANNOR');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER/MAXMIN', 'MAT/CALC/DIFFER/MAXMIN');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER/ROLLLA', 'MAT/CALC/DIFFER/ROLLLA');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/INTEGR/INDEFI', 'MAT/CALC/INTEGR/INDEFI');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/INTEGR/DEFINI', 'MAT/CALC/INTEGR/DEFINI');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/INTEGR/AREAUC', 'MAT/CALC/INTEGR/AREAUC');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFEQ/VARSEP', 'MAT/CALC/DIFFEQ/VARSEP');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFEQ/LINEAR1', 'MAT/CALC/DIFFEQ/LINEAR1');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/VECTOR/DOTPRO', 'MAT/VECST/VECTOR/DOTPRO');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/VECTOR/CROSSP', 'MAT/VECST/VECTOR/CROSSP');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/VECTOR/SCATRI', 'MAT/VECST/VECTOR/SCATRI');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/STATIS/MEANMD', 'MAT/VECST/STATIS/MEANMD');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/STATIS/VARSD', 'MAT/VECST/STATIS/VARSD');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/PROBAB/CONDPR', 'MAT/VECST/PROBAB/CONDPR');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/PROBAB/BAYES', 'MAT/VECST/PROBAB/BAYES');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/PROBAB/BINDIS', 'MAT/VECST/PROBAB/BINDIS');


-- Chapter-level tags for MAT -- a question can also be tagged
-- directly at chapter granularity (depth 3 is taggable too, per the
-- concept tree's own header), not only at the topic leaf. Without these,
-- content.v_question_eligibility would never reach a chapter-tagged
-- question for any exam. Derived 1:1 from the topic-level mappings above.
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/SETS', 'MAT/SETRE/SETS');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/RELFUN', 'MAT/SETRE/RELFUN');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/SETRE/TRIGON', 'MAT/SETRE/TRIGON');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/COMPLX', 'MAT/ALGEB/COMPLX');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/PERCOM', 'MAT/ALGEB/PERCOM');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/BINOM', 'MAT/ALGEB/BINOM');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/SEQSER', 'MAT/ALGEB/SEQSER');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/ALGEB/MATDET', 'MAT/ALGEB/MATDET');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/STLINE', 'MAT/COORD/STLINE');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/CONICS', 'MAT/COORD/CONICS');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/COORD/THREED', 'MAT/COORD/THREED');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/LIMCON', 'MAT/CALC/LIMCON');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFER', 'MAT/CALC/DIFFER');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/INTEGR', 'MAT/CALC/INTEGR');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/CALC/DIFFEQ', 'MAT/CALC/DIFFEQ');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/VECTOR', 'MAT/VECST/VECTOR');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/STATIS', 'MAT/VECST/STATIS');
select catalog.map_node_concept('JEE-ADV', 'MAT', '2026', 'MAT/VECST/PROBAB', 'MAT/VECST/PROBAB');
-- Check your work:
--   select tree, node_path from catalog.v_syllabus_tree where exam_code = 'JEE-ADV';
--   select * from catalog.v_concept_coverage where exam_code is null and is_taggable;
--   -- PHY/MODRN/ELDEV and MAT/ALGEB/LINEQ topics will correctly show no JEE-ADV
--   -- row here (excluded on purpose) but should still show NEET-UG/JEE-MAIN rows.
