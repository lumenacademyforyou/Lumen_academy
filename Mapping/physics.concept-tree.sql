-- =====================================================================
-- Physics — canonical concept tree
-- Template LA-TPL-SUBJ-PHY
--
-- The shared, exam-agnostic knowledge tree for this subject. Every exam's
-- syllabus maps onto these nodes, so a question tagged here is reachable
-- from NEET, JEE Main and JEE Advanced without being stored more than once.
--
-- Depth 1 subject, 2 branch, 3 chapter, 4 topic. Only depth 3 and 4 are
-- taggable: a question attaches to a chapter or a topic, never to a branch.
--
-- Reviewed pass: placeholder topic names replaced with real NCERT
-- Class 11-12 topic names and placement re-checked against the syllabus.
-- Codes are now frozen — do not change a code once questions reference it;
-- display names can still be changed later via upsert_concept (it upserts
-- on (subject_id, concept_path)).
--
-- Prerequisites: 010_question_model.sql, 000_template_helpers.sql
-- Re-running this file is safe: every line upserts.
-- =====================================================================

insert into catalog.subject (subject_code, subject_name, discipline)
values ('PHY', 'Physics', 'PHYSICS')
on conflict (subject_code) do nothing;

select catalog.upsert_concept('PHY', 'PHY', 'Physics', false, 1);

-- Mechanics
select catalog.upsert_concept('PHY', 'PHY/MECH', 'Mechanics', false, 1);
select catalog.upsert_concept('PHY', 'PHY/MECH/MEAS', 'Physical World and Measurement', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MECH/MEAS/UNITS', 'Units and Measurement', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MECH/MEAS/DIMEN', 'Dimensional Analysis', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MECH/MEAS/ERROR', 'Errors in Measurement', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MECH/KINEM', 'Kinematics', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MECH/KINEM/MOT1D', 'Motion in a Straight Line', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MECH/KINEM/PROJ', 'Projectile Motion', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MECH/KINEM/RELVEL', 'Relative Velocity', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MECH/LAWMO', 'Laws of Motion', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MECH/LAWMO/NEWTON', 'Newton''s Laws of Motion', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MECH/LAWMO/FRIC', 'Friction', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MECH/LAWMO/CIRCDY', 'Dynamics of Circular Motion', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MECH/WORKEN', 'Work, Energy and Power', true, 4);
select catalog.upsert_concept('PHY', 'PHY/MECH/WORKEN/WORK', 'Work and the Work-Energy Theorem', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MECH/WORKEN/KINEN', 'Kinetic and Potential Energy', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MECH/WORKEN/COLLIS', 'Collisions', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MECH/ROTMO', 'Rotational Motion', true, 5);
select catalog.upsert_concept('PHY', 'PHY/MECH/ROTMO/MOMIN', 'Moment of Inertia', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MECH/ROTMO/TORQUE', 'Torque and Angular Acceleration', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MECH/ROTMO/ROLL', 'Rolling Motion Without Slipping', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MECH/ROTMO/ANGMOM', 'Angular Momentum and Its Conservation', true, 4);
select catalog.upsert_concept('PHY', 'PHY/MECH/GRAV', 'Gravitation', true, 6);
select catalog.upsert_concept('PHY', 'PHY/MECH/GRAV/NEWGRAV', 'Newton''s Law of Gravitation', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MECH/GRAV/ORBIT', 'Orbital Velocity and Satellites', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MECH/GRAV/ESCVEL', 'Escape Velocity', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MECH/PROPMA', 'Properties of Bulk Matter', true, 7);
select catalog.upsert_concept('PHY', 'PHY/MECH/PROPMA/ELAST', 'Elasticity', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MECH/PROPMA/FLUID', 'Fluid Mechanics', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MECH/PROPMA/SURFT', 'Surface Tension', true, 3);

-- Thermodynamics and Kinetic Theory
select catalog.upsert_concept('PHY', 'PHY/THERM', 'Thermodynamics and Kinetic Theory', false, 2);
select catalog.upsert_concept('PHY', 'PHY/THERM/THERMO', 'Thermodynamics', true, 1);
select catalog.upsert_concept('PHY', 'PHY/THERM/THERMO/ZEROTH', 'Zeroth Law of Thermodynamics', true, 1);
select catalog.upsert_concept('PHY', 'PHY/THERM/THERMO/FIRSTL', 'First Law of Thermodynamics', true, 2);
select catalog.upsert_concept('PHY', 'PHY/THERM/THERMO/SECONDL', 'Second Law of Thermodynamics', true, 3);
select catalog.upsert_concept('PHY', 'PHY/THERM/THERMO/HEATENG', 'Heat Engines and Refrigerators', true, 4);
select catalog.upsert_concept('PHY', 'PHY/THERM/KINTHE', 'Kinetic Theory of Gases', true, 2);
select catalog.upsert_concept('PHY', 'PHY/THERM/KINTHE/IDEALG', 'Ideal Gas Equation', true, 1);
select catalog.upsert_concept('PHY', 'PHY/THERM/KINTHE/DEGFRE', 'Degrees of Freedom', true, 2);
select catalog.upsert_concept('PHY', 'PHY/THERM/KINTHE/MEANFP', 'Mean Free Path', true, 3);

-- Oscillations and Waves
select catalog.upsert_concept('PHY', 'PHY/OSCWA', 'Oscillations and Waves', false, 3);
select catalog.upsert_concept('PHY', 'PHY/OSCWA/OSCIL', 'Oscillations', true, 1);
select catalog.upsert_concept('PHY', 'PHY/OSCWA/OSCIL/SHM', 'Simple Harmonic Motion', true, 1);
select catalog.upsert_concept('PHY', 'PHY/OSCWA/OSCIL/PENDUL', 'Simple Pendulum', true, 2);
select catalog.upsert_concept('PHY', 'PHY/OSCWA/OSCIL/RESON', 'Resonance', true, 3);
select catalog.upsert_concept('PHY', 'PHY/OSCWA/WAVES', 'Waves', true, 2);
select catalog.upsert_concept('PHY', 'PHY/OSCWA/WAVES/WAVEQ', 'Wave Equation and Speed of a Wave', true, 1);
select catalog.upsert_concept('PHY', 'PHY/OSCWA/WAVES/SUPERP', 'Superposition of Waves', true, 2);
select catalog.upsert_concept('PHY', 'PHY/OSCWA/WAVES/DOPPLE', 'Doppler Effect', true, 3);

-- Electricity and Magnetism
select catalog.upsert_concept('PHY', 'PHY/ELEC', 'Electricity and Magnetism', false, 4);
select catalog.upsert_concept('PHY', 'PHY/ELEC/ELSTAT', 'Electrostatics', true, 1);
select catalog.upsert_concept('PHY', 'PHY/ELEC/ELSTAT/COULOM', 'Coulomb''s Law', true, 1);
select catalog.upsert_concept('PHY', 'PHY/ELEC/ELSTAT/EFIELD', 'Electric Field and Field Lines', true, 2);
select catalog.upsert_concept('PHY', 'PHY/ELEC/ELSTAT/GAUSS', 'Gauss''s Law', true, 3);
select catalog.upsert_concept('PHY', 'PHY/ELEC/ELSTAT/CAPAC', 'Capacitance and Capacitors', true, 4);
select catalog.upsert_concept('PHY', 'PHY/ELEC/CURELE', 'Current Electricity', true, 2);
select catalog.upsert_concept('PHY', 'PHY/ELEC/CURELE/OHMS', 'Ohm''s Law and Resistance', true, 1);
select catalog.upsert_concept('PHY', 'PHY/ELEC/CURELE/KIRCH', 'Kirchhoff''s Laws', true, 2);
select catalog.upsert_concept('PHY', 'PHY/ELEC/CURELE/WHEAT', 'Wheatstone Bridge', true, 3);
select catalog.upsert_concept('PHY', 'PHY/ELEC/CURELE/POTMET', 'Potentiometer', true, 4);
select catalog.upsert_concept('PHY', 'PHY/ELEC/MAGEFF', 'Magnetic Effects of Current', true, 3);
select catalog.upsert_concept('PHY', 'PHY/ELEC/MAGEFF/BIOTSA', 'Biot-Savart Law', true, 1);
select catalog.upsert_concept('PHY', 'PHY/ELEC/MAGEFF/AMPERE', 'Ampere''s Circuital Law', true, 2);
select catalog.upsert_concept('PHY', 'PHY/ELEC/MAGEFF/MOVCHG', 'Force on Moving Charges and Current-Carrying Conductors', true, 3);
select catalog.upsert_concept('PHY', 'PHY/ELEC/EMIND', 'Electromagnetic Induction and AC', true, 4);
select catalog.upsert_concept('PHY', 'PHY/ELEC/EMIND/FARADA', 'Faraday''s Laws of Induction', true, 1);
select catalog.upsert_concept('PHY', 'PHY/ELEC/EMIND/LENZ', 'Lenz''s Law', true, 2);
select catalog.upsert_concept('PHY', 'PHY/ELEC/EMIND/LCR', 'LCR Circuits', true, 3);
select catalog.upsert_concept('PHY', 'PHY/ELEC/EMIND/TRANSF', 'Transformers and AC Generators', true, 4);
select catalog.upsert_concept('PHY', 'PHY/ELEC/EMWAVE', 'Electromagnetic Waves', true, 5);
select catalog.upsert_concept('PHY', 'PHY/ELEC/EMWAVE/EMSPEC', 'Electromagnetic Spectrum', true, 1);
select catalog.upsert_concept('PHY', 'PHY/ELEC/EMWAVE/DISPLC', 'Displacement Current', true, 2);

-- Optics
select catalog.upsert_concept('PHY', 'PHY/OPTIC', 'Optics', false, 5);
select catalog.upsert_concept('PHY', 'PHY/OPTIC/RAYOPT', 'Ray Optics', true, 1);
select catalog.upsert_concept('PHY', 'PHY/OPTIC/RAYOPT/REFLEC', 'Reflection of Light', true, 1);
select catalog.upsert_concept('PHY', 'PHY/OPTIC/RAYOPT/REFRAC', 'Refraction of Light', true, 2);
select catalog.upsert_concept('PHY', 'PHY/OPTIC/RAYOPT/LENSES', 'Lenses and the Lens Maker''s Equation', true, 3);
select catalog.upsert_concept('PHY', 'PHY/OPTIC/RAYOPT/OPTINS', 'Optical Instruments', true, 4);
select catalog.upsert_concept('PHY', 'PHY/OPTIC/WAVOPT', 'Wave Optics', true, 2);
select catalog.upsert_concept('PHY', 'PHY/OPTIC/WAVOPT/INTERF', 'Interference of Light', true, 1);
select catalog.upsert_concept('PHY', 'PHY/OPTIC/WAVOPT/DIFFRA', 'Diffraction of Light', true, 2);
select catalog.upsert_concept('PHY', 'PHY/OPTIC/WAVOPT/POLARI', 'Polarization of Light', true, 3);

-- Modern Physics
select catalog.upsert_concept('PHY', 'PHY/MODRN', 'Modern Physics', false, 6);
select catalog.upsert_concept('PHY', 'PHY/MODRN/DUALNM', 'Dual Nature of Matter and Radiation', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MODRN/DUALNM/PHOTOE', 'Photoelectric Effect', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MODRN/DUALNM/DEBROG', 'de Broglie Wavelength', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MODRN/ATOMS', 'Atoms and Nuclei', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MODRN/ATOMS/BOHR', 'Bohr Model of the Atom', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MODRN/ATOMS/RADIOA', 'Radioactivity', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MODRN/ATOMS/NUCBIN', 'Nuclear Binding Energy and Mass Defect', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MODRN/ELDEV', 'Electronic Devices', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MODRN/ELDEV/SEMICO', 'Semiconductors', true, 1);
select catalog.upsert_concept('PHY', 'PHY/MODRN/ELDEV/DIODE', 'Diodes and Rectifiers', true, 2);
select catalog.upsert_concept('PHY', 'PHY/MODRN/ELDEV/TRANSI', 'Transistors', true, 3);
select catalog.upsert_concept('PHY', 'PHY/MODRN/ELDEV/LOGIC', 'Logic Gates', true, 4);

-- Check your work:
--   select tree, concept_path from catalog.v_concept_tree where subject_code='PHY';
