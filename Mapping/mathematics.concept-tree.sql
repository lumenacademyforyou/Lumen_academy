-- =====================================================================
-- Mathematics — canonical concept tree
-- Template LA-TPL-SUBJ-MAT
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
-- Note: MAT/CALC/DIFFER/ROLLLA's name is deliberately chosen to match how
-- jee-main.exam-template.sql already labels the syllabus node mapped to
-- it ("Differentiability and mean value theorems") — Rolle's Theorem and
-- Lagrange's Mean Value Theorem are exactly that topic.
--
-- Prerequisites: 010_question_model.sql, 000_template_helpers.sql
-- Re-running this file is safe: every line upserts.
-- =====================================================================

insert into catalog.subject (subject_code, subject_name, discipline)
values ('MAT', 'Mathematics', 'MATHEMATICS')
on conflict (subject_code) do nothing;

select catalog.upsert_concept('MAT', 'MAT', 'Mathematics', false, 1);

-- Sets, Relations and Functions
select catalog.upsert_concept('MAT', 'MAT/SETRE', 'Sets, Relations and Functions', false, 1);
select catalog.upsert_concept('MAT', 'MAT/SETRE/SETS', 'Sets', true, 1);
select catalog.upsert_concept('MAT', 'MAT/SETRE/SETS/SETOPS', 'Set Operations', true, 1);
select catalog.upsert_concept('MAT', 'MAT/SETRE/SETS/VENND', 'Venn Diagrams', true, 2);
select catalog.upsert_concept('MAT', 'MAT/SETRE/RELFUN', 'Relations and Functions', true, 2);
select catalog.upsert_concept('MAT', 'MAT/SETRE/RELFUN/DOMRAN', 'Domain and Range of a Relation', true, 1);
select catalog.upsert_concept('MAT', 'MAT/SETRE/RELFUN/COMPOS', 'Composition of Functions', true, 2);
select catalog.upsert_concept('MAT', 'MAT/SETRE/RELFUN/INVERS', 'Inverse of a Function', true, 3);
select catalog.upsert_concept('MAT', 'MAT/SETRE/TRIGON', 'Trigonometric Functions', true, 3);
select catalog.upsert_concept('MAT', 'MAT/SETRE/TRIGON/IDENTI', 'Trigonometric Identities', true, 1);
select catalog.upsert_concept('MAT', 'MAT/SETRE/TRIGON/EQUATN', 'Trigonometric Equations', true, 2);
select catalog.upsert_concept('MAT', 'MAT/SETRE/TRIGON/INVTRI', 'Inverse Trigonometric Functions', true, 3);

-- Algebra
select catalog.upsert_concept('MAT', 'MAT/ALGEB', 'Algebra', false, 2);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/COMPLX', 'Complex Numbers and Quadratic Equations', true, 1);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/COMPLX/ARGAND', 'Argand Plane and Polar Representation', true, 1);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/COMPLX/ROOTSQ', 'Quadratic Equations and Nature of Roots', true, 2);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/LINEQ', 'Linear Inequalities and Linear Programming', true, 2);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/LINEQ/GRAPHIN', 'Graphical Solution of Linear Inequalities', true, 1);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/LINEQ/FEASIB', 'Feasible Region and Optimal Solution', true, 2);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/PERCOM', 'Permutations and Combinations', true, 3);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/PERCOM/ARRANG', 'Permutations', true, 1);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/PERCOM/SELECT', 'Combinations', true, 2);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/BINOM', 'Binomial Theorem', true, 4);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/BINOM/GENTER', 'General Term of Binomial Expansion', true, 1);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/BINOM/MIDTER', 'Middle Term of Binomial Expansion', true, 2);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/SEQSER', 'Sequences and Series', true, 5);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/SEQSER/APROG', 'Arithmetic Progression', true, 1);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/SEQSER/GPROG', 'Geometric Progression', true, 2);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/SEQSER/SPECSE', 'Special Series (Sum of Squares and Cubes)', true, 3);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/MATDET', 'Matrices and Determinants', true, 6);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/MATDET/MATOPS', 'Matrix Operations', true, 1);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/MATDET/INVMAT', 'Inverse of a Matrix', true, 2);
select catalog.upsert_concept('MAT', 'MAT/ALGEB/MATDET/CRAMER', 'Cramer''s Rule and Systems of Linear Equations', true, 3);

-- Coordinate Geometry
select catalog.upsert_concept('MAT', 'MAT/COORD', 'Coordinate Geometry', false, 3);
select catalog.upsert_concept('MAT', 'MAT/COORD/STLINE', 'Straight Lines', true, 1);
select catalog.upsert_concept('MAT', 'MAT/COORD/STLINE/SLOPE', 'Slope of a Line', true, 1);
select catalog.upsert_concept('MAT', 'MAT/COORD/STLINE/DISTAN', 'Distance and Section Formulas', true, 2);
select catalog.upsert_concept('MAT', 'MAT/COORD/STLINE/ANGLES', 'Angle Between Two Lines', true, 3);
select catalog.upsert_concept('MAT', 'MAT/COORD/CONICS', 'Conic Sections', true, 2);
select catalog.upsert_concept('MAT', 'MAT/COORD/CONICS/CIRCLE', 'Circle', true, 1);
select catalog.upsert_concept('MAT', 'MAT/COORD/CONICS/PARABO', 'Parabola', true, 2);
select catalog.upsert_concept('MAT', 'MAT/COORD/CONICS/ELLIPS', 'Ellipse', true, 3);
select catalog.upsert_concept('MAT', 'MAT/COORD/CONICS/HYPERB', 'Hyperbola', true, 4);
select catalog.upsert_concept('MAT', 'MAT/COORD/THREED', 'Three Dimensional Geometry', true, 3);
select catalog.upsert_concept('MAT', 'MAT/COORD/THREED/DIRCOS', 'Direction Cosines and Direction Ratios', true, 1);
select catalog.upsert_concept('MAT', 'MAT/COORD/THREED/LINE3D', 'Equation of a Line in Space', true, 2);
select catalog.upsert_concept('MAT', 'MAT/COORD/THREED/PLANE3D', 'Equation of a Plane', true, 3);

-- Calculus
select catalog.upsert_concept('MAT', 'MAT/CALC', 'Calculus', false, 4);
select catalog.upsert_concept('MAT', 'MAT/CALC/LIMCON', 'Limits and Continuity', true, 1);
select catalog.upsert_concept('MAT', 'MAT/CALC/LIMCON/LIMEVA', 'Evaluation of Limits', true, 1);
select catalog.upsert_concept('MAT', 'MAT/CALC/LIMCON/CONTIN', 'Continuity of a Function', true, 2);
select catalog.upsert_concept('MAT', 'MAT/CALC/DIFFER', 'Differentiation and its Applications', true, 2);
select catalog.upsert_concept('MAT', 'MAT/CALC/DIFFER/CHAINR', 'Chain Rule and Differentiation of Composite Functions', true, 1);
select catalog.upsert_concept('MAT', 'MAT/CALC/DIFFER/TANNOR', 'Tangents and Normals', true, 2);
select catalog.upsert_concept('MAT', 'MAT/CALC/DIFFER/MAXMIN', 'Maxima and Minima', true, 3);
select catalog.upsert_concept('MAT', 'MAT/CALC/DIFFER/ROLLLA', 'Rolle''s Theorem and Lagrange''s Mean Value Theorem', true, 4);
select catalog.upsert_concept('MAT', 'MAT/CALC/INTEGR', 'Integration and its Applications', true, 3);
select catalog.upsert_concept('MAT', 'MAT/CALC/INTEGR/INDEFI', 'Indefinite Integration', true, 1);
select catalog.upsert_concept('MAT', 'MAT/CALC/INTEGR/DEFINI', 'Definite Integration', true, 2);
select catalog.upsert_concept('MAT', 'MAT/CALC/INTEGR/AREAUC', 'Area Under Curves', true, 3);
select catalog.upsert_concept('MAT', 'MAT/CALC/DIFFEQ', 'Differential Equations', true, 4);
select catalog.upsert_concept('MAT', 'MAT/CALC/DIFFEQ/VARSEP', 'Variable Separable Method', true, 1);
select catalog.upsert_concept('MAT', 'MAT/CALC/DIFFEQ/LINEAR1', 'First Order Linear Differential Equations', true, 2);

-- Vectors, Statistics and Probability
select catalog.upsert_concept('MAT', 'MAT/VECST', 'Vectors, Statistics and Probability', false, 5);
select catalog.upsert_concept('MAT', 'MAT/VECST/VECTOR', 'Vector Algebra', true, 1);
select catalog.upsert_concept('MAT', 'MAT/VECST/VECTOR/DOTPRO', 'Dot Product (Scalar Product)', true, 1);
select catalog.upsert_concept('MAT', 'MAT/VECST/VECTOR/CROSSP', 'Cross Product (Vector Product)', true, 2);
select catalog.upsert_concept('MAT', 'MAT/VECST/VECTOR/SCATRI', 'Scalar Triple Product', true, 3);
select catalog.upsert_concept('MAT', 'MAT/VECST/STATIS', 'Statistics', true, 2);
select catalog.upsert_concept('MAT', 'MAT/VECST/STATIS/MEANMD', 'Mean and Median', true, 1);
select catalog.upsert_concept('MAT', 'MAT/VECST/STATIS/VARSD', 'Variance and Standard Deviation', true, 2);
select catalog.upsert_concept('MAT', 'MAT/VECST/PROBAB', 'Probability', true, 3);
select catalog.upsert_concept('MAT', 'MAT/VECST/PROBAB/CONDPR', 'Conditional Probability', true, 1);
select catalog.upsert_concept('MAT', 'MAT/VECST/PROBAB/BAYES', 'Bayes'' Theorem', true, 2);
select catalog.upsert_concept('MAT', 'MAT/VECST/PROBAB/BINDIS', 'Binomial Distribution', true, 3);

-- Check your work:
--   select tree, concept_path from catalog.v_concept_tree where subject_code='MAT';
