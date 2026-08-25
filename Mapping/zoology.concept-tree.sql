-- =====================================================================
-- Zoology — canonical concept tree
-- Template LA-TPL-SUBJ-ZOO
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
values ('ZOO', 'Zoology', 'BIOLOGY')
on conflict (subject_code) do nothing;

select catalog.upsert_concept('ZOO', 'ZOO', 'Zoology', false, 1);

-- Animal Diversity and Organisation
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV', 'Animal Diversity and Organisation', false, 1);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/ANIKIN', 'Animal Kingdom', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/ANIKIN/PORIFE', 'Phylum Porifera', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/ANIKIN/CNIDAR', 'Phylum Cnidaria', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/ANIKIN/PLATYH', 'Phylum Platyhelminthes', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/ANIKIN/ARTHRO', 'Phylum Arthropoda', true, 4);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/ANIKIN/CHORDA', 'Phylum Chordata', true, 5);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/STRORG', 'Structural Organisation in Animals', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/STRORG/EPITHE', 'Epithelial Tissue', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/STRORG/CONNEC', 'Connective Tissue', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/STRORG/MUSCLE', 'Muscular Tissue', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/ANDIV/STRORG/NERVET', 'Neural Tissue', true, 4);

-- Human Physiology
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY', 'Human Physiology', false, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/DIGEST', 'Digestion and Absorption', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/DIGEST/ALIMEN', 'Alimentary Canal and Digestive Glands', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/DIGEST/ENZDIG', 'Digestive Enzymes and Digestion of Food', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/DIGEST/ABSORP', 'Absorption of Digested Products', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/BREATH', 'Breathing and Exchange of Gases', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/BREATH/RESPMEC', 'Mechanism of Breathing', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/BREATH/O2TRAN', 'Transport of Oxygen', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/BREATH/CO2TRA', 'Transport of Carbon Dioxide', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/BODFLU', 'Body Fluids and Circulation', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/BODFLU/BLOOD', 'Blood and Lymph', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/BODFLU/CARDCY', 'Cardiac Cycle', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/BODFLU/ECGRAM', 'Electrocardiograph (ECG)', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/EXCRET', 'Excretory Products and their Elimination', true, 4);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/EXCRET/NEPHRO', 'Structure of Nephron', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/EXCRET/URINEF', 'Urine Formation', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/EXCRET/OSMREG', 'Osmoregulation', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/LOCOMO', 'Locomotion and Movement', true, 5);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/LOCOMO/MUSCON', 'Mechanism of Muscle Contraction', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/LOCOMO/SKELET', 'Skeletal System', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/LOCOMO/JOINTS', 'Joints', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/NEURAL', 'Neural Control and Coordination', true, 6);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/NEURAL/NEURON', 'Neuron Structure and Types', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/NEURAL/IMPULS', 'Generation and Conduction of Nerve Impulse', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/NEURAL/BRAIN', 'Human Brain', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/NEURAL/REFLEX', 'Reflex Action', true, 4);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/CHEMCO', 'Chemical Coordination and Integration', true, 7);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/CHEMCO/PITUIT', 'Pituitary Gland', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/CHEMCO/THYROI', 'Thyroid and Parathyroid Glands', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/CHEMCO/PANCRE', 'Pancreas as an Endocrine Gland', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUPHY/CHEMCO/ADRENA', 'Adrenal Gland', true, 4);

-- Reproduction and Health
select catalog.upsert_concept('ZOO', 'ZOO/HUREP', 'Reproduction and Health', false, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/HUMREP', 'Human Reproduction', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/HUMREP/GAMETO', 'Gametogenesis', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/HUMREP/MENSTR', 'Menstrual Cycle', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/HUMREP/FERTIL', 'Fertilisation', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/HUMREP/PLACEN', 'Pregnancy and Placenta', true, 4);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/REPHEA', 'Reproductive Health', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/REPHEA/CONTRA', 'Contraceptive Methods', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/REPHEA/ARTREP', 'Assisted Reproductive Technologies', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/REPHEA/STDISE', 'Sexually Transmitted Infections', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/HUMHEA', 'Human Health and Disease', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/HUMHEA/IMMUNI', 'Immunity', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/HUMHEA/PATHOG', 'Common Diseases in Humans', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/HUREP/HUMHEA/CANCER', 'Cancer and AIDS', true, 3);

-- Evolution and Applied Biology
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP', 'Evolution and Applied Biology', false, 4);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/EVOLUT', 'Evolution', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/EVOLUT/ORIGIN', 'Origin of Life', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/EVOLUT/NATSEL', 'Natural Selection and Darwinism', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/EVOLUT/HARDYW', 'Hardy-Weinberg Principle', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/EVOLUT/HUMEVO', 'Human Evolution', true, 4);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/BIOHUM', 'Biology in Human Welfare', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/BIOHUM/MICROB', 'Microbes in Human Welfare', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/BIOHUM/ANIHUS', 'Animal Husbandry', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/BIOPRI', 'Biotechnology: Principles and Processes', true, 3);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/BIOPRI/ENZYME', 'Restriction Enzymes and Recombinant DNA', true, 1);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/BIOPRI/VECTOR', 'Cloning Vectors', true, 2);
select catalog.upsert_concept('ZOO', 'ZOO/EVOAP/BIOPRI/BIOREA', 'Bioreactors and Downstream Processing', true, 3);

-- Check your work:
--   select tree, concept_path from catalog.v_concept_tree where subject_code='ZOO';
