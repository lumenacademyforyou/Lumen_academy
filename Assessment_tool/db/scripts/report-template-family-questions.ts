/**
 * report-template-family-questions — docs/test-engine-fix-prompt.md Defect 1,
 * "Related quality issue (flag, do not silently fix)".
 *
 * The artifact strip (migration 036) made the stems clean. It did not make
 * them *good*: "Which fundamental physical principle governs the conservation
 * laws in <unit name>?" is a generator template with the unit name
 * interpolated, and it produces near-meaningless items whichever unit you
 * substitute. The spec is explicit that these are for a subject expert to
 * review, never for the tool to delete — so this script only reports.
 *
 * Two detectors, both evidence-based rather than a hand-written blocklist:
 *
 *   1. Unit-name interpolation — the stem literally contains the title of a
 *      catalog.syllabus_node unit. Replace that title with a placeholder and
 *      questions from different units collapse onto one "skeleton", which is
 *      exactly what a template family looks like.
 *   2. Topic-name interpolation — the same shape as (1) but not tied to the
 *      catalog. Checked live first, rather than assumed: this bank's stems
 *      interpolate NCERT *chapter* names ("Current Electricity", "Wave
 *      Optics"), and catalog.syllabus_node holds only 38 composite *unit*
 *      titles ("Electrostatics & Current Electricity"), so detector (1)
 *      legitimately returns zero and would have hidden the whole problem on
 *      its own. This detector replaces any title-cased topic phrase in an
 *      "in <Topic>" / "In <Topic>," position with a placeholder and groups on
 *      what's left, so it finds the family regardless of what the catalog
 *      happens to call things.
 *   3. skeleton_fp families — migration 030 already computes skeleton_fp
 *      (normalized stem with every number collapsed to '#') and deliberately
 *      leaves it unenforced, because it also collapses legitimate "same
 *      formula, different numbers" drills. That makes it the right *report*
 *      signal even though it is the wrong dedup key.
 *
 *   npx tsx db/scripts/report-template-family-questions.ts [--json]
 */
import { pool } from "../shared/pool.js";

interface FamilyRow {
  skeleton: string;
  members: number;
  units: string[];
  question_ids: string[];
  sample_stem: string;
}

async function main(): Promise<void> {
  const asJson = process.argv.includes("--json");

  const unitNames = (
    await pool.query<{ title: string }>(
      `select distinct title from catalog.syllabus_node where node_type = 'unit' and title is not null order by title`
    )
  ).rows.map((r) => r.title);

  // 1. Unit-name interpolation families.
  const interpolated = await pool.query<FamilyRow>(
    `with unit_titles as (
       select distinct title from catalog.syllabus_node where node_type = 'unit' and title is not null
     ),
     hits as (
       select q.question_id, q.stem_text, u.title,
              replace(q.stem_text, u.title, '<UNIT>') as skeleton
         from content.question q
         join unit_titles u on q.stem_text like '%' || u.title || '%'
        where q.lifecycle_status = 'published'
     )
     select skeleton,
            count(*)::int as members,
            array_agg(distinct title order by title) as units,
            array_agg(question_id::text) as question_ids,
            min(stem_text) as sample_stem
       from hits
      group by skeleton
     having count(*) > 1
      order by count(*) desc`
  );

  // 2. Topic-name interpolation, catalog-independent.
  const allStems = await pool.query<{ question_id: string; stem_text: string }>(
    `select question_id, stem_text from content.question where lifecycle_status = 'published'`
  );
  // "…conservation laws in Current Electricity?"  ->  "…conservation laws in <TOPIC>?"
  // "In Work, Energy and Power, a body of mass…"  ->  "In <TOPIC>, a body of mass…"
  const TOPIC_SPAN = /\b([Ii]n)\s+((?:[A-Z][a-z]+|and|of|the|&|,)(?:\s+(?:[A-Z][a-z]+|and|of|the|&))*)/g;
  const topicFamilies = new Map<string, { ids: string[]; sample: string; topics: Set<string> }>();
  for (const row of allStems.rows) {
    const topics = new Set<string>();
    const skeleton = row.stem_text.replace(TOPIC_SPAN, (_m, prep: string, topic: string) => {
      topics.add(topic.trim().replace(/,$/, ""));
      return `${prep} <TOPIC>`;
    });
    if (topics.size === 0) continue;
    const entry = topicFamilies.get(skeleton) ?? { ids: [], sample: row.stem_text, topics: new Set<string>() };
    entry.ids.push(row.question_id);
    for (const topic of topics) entry.topics.add(topic);
    topicFamilies.set(skeleton, entry);
  }
  const topicFamilyRows = [...topicFamilies.entries()]
    .filter(([, v]) => v.ids.length > 1)
    .sort((a, b) => b[1].ids.length - a[1].ids.length);

  // 3. skeleton_fp families (numeric drill variants).
  const numericFamilies = await pool.query<{ members: number; sample_stem: string; question_ids: string[] }>(
    `select count(*)::int as members,
            min(stem_text) as sample_stem,
            array_agg(question_id::text) as question_ids
       from content.question
      where lifecycle_status = 'published' and skeleton_fp is not null
      group by skeleton_fp
     having count(*) > 1
      order by count(*) desc`
  );

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          unitNameFamilies: interpolated.rows,
          topicNameFamilies: topicFamilyRows.map(([skeleton, v]) => ({ skeleton, members: v.ids.length, topics: [...v.topics], questionIds: v.ids })),
          numericFamilies: numericFamilies.rows,
        },
        null,
        2
      )
    );
  } else {
    console.log(`\n=== Template families: unit name interpolated into the stem ===`);
    console.log(`(checked against ${unitNames.length} live unit titles — the list is read from catalog.syllabus_node, never hardcoded)\n`);
    if (interpolated.rowCount === 0) {
      console.log("None.");
    }
    for (const row of interpolated.rows) {
      console.log(`* ${row.members} questions share this skeleton, across ${row.units.length} unit(s):`);
      console.log(`    ${row.skeleton}`);
      console.log(`    units    : ${row.units.join(", ")}`);
      console.log(`    questions: ${row.question_ids.join(", ")}`);
      console.log("");
    }

    console.log(`\n=== Template families: a topic name interpolated into an otherwise fixed stem ===`);
    console.log(`(catalog-independent — see this file's header for why detector 1 alone returns zero on this bank)\n`);
    if (topicFamilyRows.length === 0) console.log("None.");
    for (const [skeleton, v] of topicFamilyRows.slice(0, 25)) {
      console.log(`* ${v.ids.length} questions share this skeleton:`);
      console.log(`    ${skeleton.slice(0, 180)}`);
      console.log(`    topics substituted: ${[...v.topics].slice(0, 12).join(", ")}${v.topics.size > 12 ? ", …" : ""}`);
      console.log(`    questions: ${v.ids.slice(0, 6).join(", ")}${v.ids.length > 6 ? `, … (+${v.ids.length - 6})` : ""}`);
      console.log("");
    }
    if (topicFamilyRows.length > 25) console.log(`… and ${topicFamilyRows.length - 25} more families.\n`);

    console.log(`\n=== Numeric-variant families (same skeleton_fp, different numbers) ===`);
    console.log(`These are NOT automatically wrong — "same formula, different numbers" is legitimate practice.`);
    console.log(`Listed so a subject expert can decide, per family.\n`);
    if (numericFamilies.rowCount === 0) console.log("None.");
    for (const row of numericFamilies.rows.slice(0, 30)) {
      console.log(`* ${row.members}x — ${row.sample_stem.slice(0, 140)}`);
    }
    if ((numericFamilies.rowCount ?? 0) > 30) console.log(`… and ${(numericFamilies.rowCount ?? 0) - 30} more families.`);

    const flagged = interpolated.rows.reduce((n, r) => n + r.members, 0);
    console.log(`\n--- Summary ---`);
    const topicFlagged = topicFamilyRows.reduce((n, [, v]) => n + v.ids.length, 0);
    console.log(`unit-name-interpolated questions flagged for review  : ${flagged}   (catalog unit titles)`);
    console.log(`topic-name-interpolated questions flagged for review : ${topicFlagged}   (${topicFamilyRows.length} families)`);
    console.log(`numeric-variant families                             : ${numericFamilies.rowCount}`);
    console.log(`Nothing was modified or deleted by this script.\n`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
