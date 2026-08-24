-- =====================================================================
-- Botany — canonical concept tree
-- Template LA-TPL-SUBJ-BOT
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
values ('BOT', 'Botany', 'BIOLOGY')
on conflict (subject_code) do nothing;

select catalog.upsert_concept('BOT', 'BOT', 'Botany', false, 1);

-- Diversity in the Living World
select catalog.upsert_concept('BOT', 'BOT/DIVER', 'Diversity in the Living World', false, 1);
select catalog.upsert_concept('BOT', 'BOT/DIVER/LIVWOR', 'The Living World', true, 1);
select catalog.upsert_concept('BOT', 'BOT/DIVER/LIVWOR/TAXCAT', 'Taxonomic Categories and Hierarchy', true, 1);
select catalog.upsert_concept('BOT', 'BOT/DIVER/LIVWOR/TAXAID', 'Taxonomical Aids', true, 2);
select catalog.upsert_concept('BOT', 'BOT/DIVER/PLNKIN', 'Biological Classification and Plant Kingdom', true, 2);
select catalog.upsert_concept('BOT', 'BOT/DIVER/PLNKIN/MONERA', 'Kingdom Monera', true, 1);
select catalog.upsert_concept('BOT', 'BOT/DIVER/PLNKIN/PROTIS', 'Kingdom Protista', true, 2);
select catalog.upsert_concept('BOT', 'BOT/DIVER/PLNKIN/FUNGI', 'Kingdom Fungi', true, 3);
select catalog.upsert_concept('BOT', 'BOT/DIVER/PLNKIN/ALGAE', 'Algae', true, 4);
select catalog.upsert_concept('BOT', 'BOT/DIVER/PLNKIN/BRYOPH', 'Bryophytes', true, 5);
select catalog.upsert_concept('BOT', 'BOT/DIVER/PLNKIN/PTERID', 'Pteridophytes', true, 6);
select catalog.upsert_concept('BOT', 'BOT/DIVER/PLNKIN/GYMNOS', 'Gymnosperms', true, 7);
select catalog.upsert_concept('BOT', 'BOT/DIVER/PLNKIN/ANGIOS', 'Angiosperms', true, 8);
select catalog.upsert_concept('BOT', 'BOT/DIVER/MORPHO', 'Morphology of Flowering Plants', true, 3);
select catalog.upsert_concept('BOT', 'BOT/DIVER/MORPHO/ROOT', 'The Root System', true, 1);
select catalog.upsert_concept('BOT', 'BOT/DIVER/MORPHO/STEM', 'The Stem', true, 2);
select catalog.upsert_concept('BOT', 'BOT/DIVER/MORPHO/LEAF', 'The Leaf', true, 3);
select catalog.upsert_concept('BOT', 'BOT/DIVER/MORPHO/FLOWER', 'The Flower', true, 4);
select catalog.upsert_concept('BOT', 'BOT/DIVER/MORPHO/FRUIT', 'The Fruit and Seed', true, 5);

-- Structural Organisation and Cell Biology
select catalog.upsert_concept('BOT', 'BOT/STRUC', 'Structural Organisation and Cell Biology', false, 2);
select catalog.upsert_concept('BOT', 'BOT/STRUC/ANATOM', 'Anatomy of Flowering Plants', true, 1);
select catalog.upsert_concept('BOT', 'BOT/STRUC/ANATOM/TISSUE', 'Plant Tissues and Tissue Systems', true, 1);
select catalog.upsert_concept('BOT', 'BOT/STRUC/ANATOM/VASCUL', 'Vascular Bundles in Root, Stem and Leaf', true, 2);
select catalog.upsert_concept('BOT', 'BOT/STRUC/ANATOM/SECGRO', 'Secondary Growth', true, 3);
select catalog.upsert_concept('BOT', 'BOT/STRUC/CELUNI', 'Cell: The Unit of Life', true, 2);
select catalog.upsert_concept('BOT', 'BOT/STRUC/CELUNI/ORGANE', 'Cell Organelles', true, 1);
select catalog.upsert_concept('BOT', 'BOT/STRUC/CELUNI/CELWAL', 'Cell Wall and Cell Membrane', true, 2);
select catalog.upsert_concept('BOT', 'BOT/STRUC/CELUNI/PLASTI', 'Plastids', true, 3);
select catalog.upsert_concept('BOT', 'BOT/STRUC/BIOMOL', 'Biomolecules and Enzymes', true, 3);
select catalog.upsert_concept('BOT', 'BOT/STRUC/BIOMOL/ENZKIN', 'Enzymes and Enzyme Kinetics', true, 1);
select catalog.upsert_concept('BOT', 'BOT/STRUC/BIOMOL/METABO', 'Structure and Classification of Biomolecules', true, 2);
select catalog.upsert_concept('BOT', 'BOT/STRUC/CELDIV', 'Cell Cycle and Cell Division', true, 4);
select catalog.upsert_concept('BOT', 'BOT/STRUC/CELDIV/MITOSI', 'Mitosis', true, 1);
select catalog.upsert_concept('BOT', 'BOT/STRUC/CELDIV/MEIOSI', 'Meiosis', true, 2);

-- Plant Physiology
select catalog.upsert_concept('BOT', 'BOT/PLPHY', 'Plant Physiology', false, 3);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/TRANSP', 'Transport in Plants', true, 1);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/TRANSP/OSMOSI', 'Diffusion, Osmosis and Plasmolysis', true, 1);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/TRANSP/TRANSPI', 'Transpiration', true, 2);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/TRANSP/ASCENT', 'Ascent of Sap', true, 3);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/MINNUT', 'Mineral Nutrition', true, 2);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/MINNUT/MACROE', 'Essential Macro- and Micronutrients', true, 1);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/MINNUT/NITFIX', 'Biological Nitrogen Fixation', true, 2);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/PHOTOS', 'Photosynthesis in Higher Plants', true, 3);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/PHOTOS/LIGHTR', 'Light Reaction (Photochemical Phase)', true, 1);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/PHOTOS/CALVIN', 'Calvin Cycle (C3 Pathway)', true, 2);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/PHOTOS/C4PATH', 'C4 Pathway (Hatch-Slack Pathway)', true, 3);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/PHOTOS/PHOTOR', 'Photorespiration', true, 4);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/RESPIR', 'Respiration in Plants', true, 4);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/RESPIR/GLYCOL', 'Glycolysis', true, 1);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/RESPIR/KREBS', 'Krebs Cycle (Citric Acid Cycle)', true, 2);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/RESPIR/ETSCHN', 'Electron Transport Chain and Oxidative Phosphorylation', true, 3);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/PLGROW', 'Plant Growth and Development', true, 5);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/PLGROW/HORMON', 'Plant Growth Regulators', true, 1);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/PLGROW/PHOTOP', 'Photoperiodism', true, 2);
select catalog.upsert_concept('BOT', 'BOT/PLPHY/PLGROW/VERNAL', 'Vernalization', true, 3);

-- Reproduction, Genetics and Ecology
select catalog.upsert_concept('BOT', 'BOT/REPGE', 'Reproduction, Genetics and Ecology', false, 4);
select catalog.upsert_concept('BOT', 'BOT/REPGE/PLREPR', 'Sexual Reproduction in Flowering Plants', true, 1);
select catalog.upsert_concept('BOT', 'BOT/REPGE/PLREPR/MICROS', 'Microsporogenesis and Male Gametophyte', true, 1);
select catalog.upsert_concept('BOT', 'BOT/REPGE/PLREPR/MEGASP', 'Megasporogenesis and Female Gametophyte', true, 2);
select catalog.upsert_concept('BOT', 'BOT/REPGE/PLREPR/POLLIN', 'Pollination', true, 3);
select catalog.upsert_concept('BOT', 'BOT/REPGE/PLREPR/DOUFER', 'Double Fertilization', true, 4);
select catalog.upsert_concept('BOT', 'BOT/REPGE/INHERI', 'Principles of Inheritance and Variation', true, 2);
select catalog.upsert_concept('BOT', 'BOT/REPGE/INHERI/MENDEL', 'Mendelian Inheritance', true, 1);
select catalog.upsert_concept('BOT', 'BOT/REPGE/INHERI/LINKAG', 'Linkage and Recombination', true, 2);
select catalog.upsert_concept('BOT', 'BOT/REPGE/INHERI/PEDIGR', 'Pedigree Analysis', true, 3);
select catalog.upsert_concept('BOT', 'BOT/REPGE/INHERI/MUTATI', 'Chromosomal Disorders and Mutation', true, 4);
select catalog.upsert_concept('BOT', 'BOT/REPGE/MOLBAS', 'Molecular Basis of Inheritance', true, 3);
select catalog.upsert_concept('BOT', 'BOT/REPGE/MOLBAS/DNAREP', 'DNA Replication', true, 1);
select catalog.upsert_concept('BOT', 'BOT/REPGE/MOLBAS/TRANSC', 'Transcription', true, 2);
select catalog.upsert_concept('BOT', 'BOT/REPGE/MOLBAS/TRANSL', 'Translation', true, 3);
select catalog.upsert_concept('BOT', 'BOT/REPGE/MOLBAS/LACOPE', 'Lac Operon and Gene Regulation', true, 4);
select catalog.upsert_concept('BOT', 'BOT/REPGE/ECOLOG', 'Ecology and Environment', true, 4);
select catalog.upsert_concept('BOT', 'BOT/REPGE/ECOLOG/POPULA', 'Population Ecology', true, 1);
select catalog.upsert_concept('BOT', 'BOT/REPGE/ECOLOG/ECOSYS', 'Ecosystem Structure and Function', true, 2);
select catalog.upsert_concept('BOT', 'BOT/REPGE/ECOLOG/BIODIV', 'Biodiversity and Conservation', true, 3);
select catalog.upsert_concept('BOT', 'BOT/REPGE/ECOLOG/POLLUT', 'Environmental Pollution', true, 4);
select catalog.upsert_concept('BOT', 'BOT/REPGE/BIOTEC', 'Biotechnology and its Applications', true, 5);
select catalog.upsert_concept('BOT', 'BOT/REPGE/BIOTEC/RDNA', 'Recombinant DNA Technology', true, 1);
select catalog.upsert_concept('BOT', 'BOT/REPGE/BIOTEC/PCRTEC', 'PCR and Molecular Diagnostics', true, 2);
select catalog.upsert_concept('BOT', 'BOT/REPGE/BIOTEC/GMCROP', 'Genetically Modified Crops', true, 3);

-- Check your work:
--   select tree, concept_path from catalog.v_concept_tree where subject_code='BOT';
