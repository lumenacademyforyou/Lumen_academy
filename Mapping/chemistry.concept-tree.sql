-- =====================================================================
-- Chemistry — canonical concept tree
-- Template LA-TPL-SUBJ-CHE
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
values ('CHE', 'Chemistry', 'CHEMISTRY')
on conflict (subject_code) do nothing;

select catalog.upsert_concept('CHE', 'CHE', 'Chemistry', false, 1);

-- Physical Chemistry
select catalog.upsert_concept('CHE', 'CHE/PHYCHE', 'Physical Chemistry', false, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/SOMBAS', 'Some Basic Concepts of Chemistry', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/SOMBAS/MOLE', 'Mole Concept', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/SOMBAS/STOICH', 'Stoichiometry', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/SOMBAS/SIGFIG', 'Significant Figures', true, 3);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/SOMBAS/EMPFOR', 'Empirical and Molecular Formula', true, 4);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/STRATO', 'Structure of Atom', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/STRATO/QUANTM', 'Quantum Mechanical Model of the Atom', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/STRATO/ORBITL', 'Atomic Orbitals and Quantum Numbers', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/STRATO/AUFBAU', 'Aufbau Principle and Electronic Configuration', true, 3);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/STATES', 'States of Matter', true, 3);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/STATES/GASLAW', 'Gas Laws', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/STATES/REALGA', 'Real Gases and van der Waals Equation', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/STATES/LIQUID', 'Liquid State', true, 3);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/THERMO', 'Thermodynamics', true, 4);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/THERMO/ENTHAL', 'Enthalpy', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/THERMO/ENTROP', 'Entropy', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/THERMO/GIBBS', 'Gibbs Free Energy', true, 3);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/THERMO/HESS', 'Hess''s Law', true, 4);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/EQUIL', 'Equilibrium', true, 5);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/EQUIL/CHEMEQ', 'Chemical Equilibrium', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/EQUIL/IONEQ', 'Ionic Equilibrium', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/EQUIL/PHBUFF', 'pH and Buffer Solutions', true, 3);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/EQUIL/SOLPRO', 'Solubility Product', true, 4);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/REDOX', 'Redox Reactions', true, 6);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/REDOX/OXNUM', 'Oxidation Number', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/REDOX/BALRED', 'Balancing Redox Reactions', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/ELCHEM', 'Electrochemistry', true, 7);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/ELCHEM/CONDUC', 'Conductance of Electrolytic Solutions', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/ELCHEM/NERNST', 'Nernst Equation', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/ELCHEM/ELECTL', 'Electrolysis and Faraday''s Laws', true, 3);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/KINET', 'Chemical Kinetics', true, 8);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/KINET/RATELW', 'Rate Law and Rate Constant', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/KINET/ORDER', 'Order and Molecularity of Reactions', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/KINET/ARRHEN', 'Arrhenius Equation', true, 3);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/SOLUT', 'Solutions', true, 9);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/SOLUT/CONCUN', 'Concentration Units', true, 1);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/SOLUT/RAOULT', 'Raoult''s Law', true, 2);
select catalog.upsert_concept('CHE', 'CHE/PHYCHE/SOLUT/COLLIG', 'Colligative Properties', true, 3);

-- Inorganic Chemistry
select catalog.upsert_concept('CHE', 'CHE/INORG', 'Inorganic Chemistry', false, 2);
select catalog.upsert_concept('CHE', 'CHE/INORG/CLASPE', 'Classification of Elements and Periodicity', true, 1);
select catalog.upsert_concept('CHE', 'CHE/INORG/CLASPE/PERTRE', 'Periodic Trends', true, 1);
select catalog.upsert_concept('CHE', 'CHE/INORG/CLASPE/IONENE', 'Ionization Enthalpy', true, 2);
select catalog.upsert_concept('CHE', 'CHE/INORG/CLASPE/ELECAF', 'Electron Gain Enthalpy and Electronegativity', true, 3);
select catalog.upsert_concept('CHE', 'CHE/INORG/BONDST', 'Chemical Bonding and Molecular Structure', true, 2);
select catalog.upsert_concept('CHE', 'CHE/INORG/BONDST/LEWIS', 'Lewis Structures and Ionic/Covalent Bonding', true, 1);
select catalog.upsert_concept('CHE', 'CHE/INORG/BONDST/VSEPR', 'VSEPR Theory', true, 2);
select catalog.upsert_concept('CHE', 'CHE/INORG/BONDST/HYBRID', 'Hybridization', true, 3);
select catalog.upsert_concept('CHE', 'CHE/INORG/BONDST/MOTHEO', 'Molecular Orbital Theory', true, 4);
select catalog.upsert_concept('CHE', 'CHE/INORG/HYDROG', 'Hydrogen', true, 3);
select catalog.upsert_concept('CHE', 'CHE/INORG/HYDROG/ISOTOP', 'Isotopes of Hydrogen', true, 1);
select catalog.upsert_concept('CHE', 'CHE/INORG/HYDROG/WATER', 'Properties of Water', true, 2);
select catalog.upsert_concept('CHE', 'CHE/INORG/HYDROG/HYDRID', 'Hydrides', true, 3);
select catalog.upsert_concept('CHE', 'CHE/INORG/SBLOCK', 's-Block Elements', true, 4);
select catalog.upsert_concept('CHE', 'CHE/INORG/SBLOCK/ALKALI', 'Alkali Metals', true, 1);
select catalog.upsert_concept('CHE', 'CHE/INORG/SBLOCK/ALKEAR', 'Alkaline Earth Metals', true, 2);
select catalog.upsert_concept('CHE', 'CHE/INORG/PBLOCK', 'p-Block Elements', true, 5);
select catalog.upsert_concept('CHE', 'CHE/INORG/PBLOCK/GRP13', 'Group 13 Elements', true, 1);
select catalog.upsert_concept('CHE', 'CHE/INORG/PBLOCK/GRP14', 'Group 14 Elements', true, 2);
select catalog.upsert_concept('CHE', 'CHE/INORG/PBLOCK/GRP15', 'Group 15 Elements', true, 3);
select catalog.upsert_concept('CHE', 'CHE/INORG/PBLOCK/GRP16', 'Group 16 Elements', true, 4);
select catalog.upsert_concept('CHE', 'CHE/INORG/PBLOCK/GRP17', 'Group 17 Elements', true, 5);
select catalog.upsert_concept('CHE', 'CHE/INORG/PBLOCK/GRP18', 'Group 18 Elements', true, 6);
select catalog.upsert_concept('CHE', 'CHE/INORG/DFBLOC', 'd- and f-Block Elements', true, 6);
select catalog.upsert_concept('CHE', 'CHE/INORG/DFBLOC/TRANSI', 'Transition Elements', true, 1);
select catalog.upsert_concept('CHE', 'CHE/INORG/DFBLOC/LANTHA', 'Lanthanoids', true, 2);
select catalog.upsert_concept('CHE', 'CHE/INORG/DFBLOC/ACTINI', 'Actinoids', true, 3);
select catalog.upsert_concept('CHE', 'CHE/INORG/COORD', 'Coordination Compounds', true, 7);
select catalog.upsert_concept('CHE', 'CHE/INORG/COORD/NOMENC', 'Nomenclature of Coordination Compounds', true, 1);
select catalog.upsert_concept('CHE', 'CHE/INORG/COORD/ISOMER', 'Isomerism in Coordination Compounds', true, 2);
select catalog.upsert_concept('CHE', 'CHE/INORG/COORD/CFTHEO', 'Crystal Field Theory', true, 3);

-- Organic Chemistry
select catalog.upsert_concept('CHE', 'CHE/ORGAN', 'Organic Chemistry', false, 3);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/GOCPUR', 'General Organic Chemistry and Purification', true, 1);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/GOCPUR/IUPAC', 'IUPAC Nomenclature', true, 1);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/GOCPUR/INDUCT', 'Inductive Effect', true, 2);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/GOCPUR/RESONA', 'Resonance and Hyperconjugation', true, 3);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/GOCPUR/MECHAN', 'Reaction Mechanisms and Purification Techniques', true, 4);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/HYDROC', 'Hydrocarbons', true, 2);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/HYDROC/ALKANE', 'Alkanes', true, 1);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/HYDROC/ALKENE', 'Alkenes', true, 2);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/HYDROC/ALKYNE', 'Alkynes', true, 3);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/HYDROC/AROMAT', 'Aromatic Hydrocarbons', true, 4);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/HALOAL', 'Haloalkanes and Haloarenes', true, 3);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/HALOAL/SN1SN2', 'SN1 and SN2 Reactions', true, 1);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/HALOAL/ELIMIN', 'Elimination Reactions', true, 2);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/ALCPHE', 'Alcohols, Phenols and Ethers', true, 4);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/ALCPHE/ALCOHO', 'Alcohols', true, 1);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/ALCPHE/PHENOL', 'Phenols', true, 2);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/ALCPHE/ETHERS', 'Ethers', true, 3);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/ALDKET', 'Aldehydes, Ketones and Carboxylic Acids', true, 5);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/ALDKET/NUCADD', 'Nucleophilic Addition Reactions', true, 1);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/ALDKET/ALDOL', 'Aldol Condensation', true, 2);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/ALDKET/ACIDIT', 'Acidity of Carboxylic Acids', true, 3);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/AMINES', 'Amines', true, 6);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/AMINES/BASICI', 'Basicity of Amines', true, 1);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/AMINES/DIAZON', 'Diazonium Salts', true, 2);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/BIOMOL', 'Biomolecules', true, 7);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/BIOMOL/CARBOH', 'Carbohydrates', true, 1);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/BIOMOL/PROTEI', 'Proteins', true, 2);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/BIOMOL/NUCACI', 'Nucleic Acids', true, 3);
select catalog.upsert_concept('CHE', 'CHE/ORGAN/BIOMOL/VITAMI', 'Vitamins', true, 4);

-- Check your work:
--   select tree, concept_path from catalog.v_concept_tree where subject_code='CHE';
