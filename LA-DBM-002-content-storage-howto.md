# How Images, LaTeX, Tables, Circuits and Graphs Are Stored and Retrieved

**Document ID:** LA-DBM-002
**Companion to:** LA-DBM-001 (the storage model)
**Status:** every query below was executed against PostgreSQL 16; the output shown is real

---

## 1. The one idea

Nothing is a blob. A question stem is an **ordered list of typed blocks** in `content.content_block`. Each block is exactly one thing, and its payload lives in the table built for that thing.

| Block type | Payload lives in | What is actually stored |
|---|---|---|
| `TEXT` | `content_block.text_content` | the prose, with `text_format` = PLAIN / MARKDOWN / HTML |
| `LATEX` | `content_block.text_content` | LaTeX source, rendered by KaTeX in the browser |
| `EQUATION` | `content.equation` + `equation_variable` | a named relation with each symbol's meaning and SI unit |
| `TABLE`, `DATASET` | `content.data_table` | columns and rows as JSONB |
| `IMAGE`, `DIAGRAM`, `GRAPH`, `CIRCUIT`, `CHEMICAL_STRUCTURE`, `REACTION_SCHEME`, `EXPERIMENTAL_SETUP`, `GEOMETRY_FIGURE`, `COORDINATE_FIGURE`, `LABELLED_DIAGRAM`, `BIOLOGICAL_STRUCTURE` | `content.asset` | URI, MIME type, dimensions, SHA-256 checksum |

A single `CHECK` constraint enforces that the payload matches the declared type, so an `EQUATION` block cannot smuggle in an image and a `TABLE` block cannot be empty.

**Binaries never go in the database.** The bytes live in object storage; `content.asset` holds the pointer and the checksum. The checksum is what deduplicates — the same circuit diagram used in twelve questions is one row in `content.asset` and twelve rows in `content_block`.

---

## 2. Storing each type

The seven files under `templates/content/` are runnable versions of everything below. Each one creates a scratch question, stores the content, reads it back, and rolls back, so you can run it to see the shape before writing your own.

### Image

```sql
insert into content.asset
  (asset_id, asset_kind, storage_uri, mime_type, byte_size, width_px, height_px, checksum_sha256)
values
  ('…', 'LABELLED_DIAGRAM', 'assets/bot/anatomy/ts-dicot-stem.png',
   'image/png', 184320, 900, 640, '<sha256 computed at upload>');

insert into content.content_block
  (question_id, block_role, seq, block_type, asset_id, alt_text, caption)
values
  ('…', 'STEM', 1, 'IMAGE', '…',
   'Transverse section of a dicot stem showing epidermis, cortex, vascular bundles in a ring, and central pith',
   'Figure 1');
```

`alt_text` is compulsory on any block carrying an asset, enforced by constraint. It is what a student sees when the image fails to load on a weak connection mid-paper.

### LaTeX

Stored as source, never as a picture of a formula:

```sql
insert into content.content_block
  (question_id, block_role, seq, block_type, text_content, text_format)
values
  ('…', 'STEM', 1, 'LATEX',
   'Given $I = \tfrac{1}{2}MR^{2}$, find the acceleration $a$.', 'LATEX');
```

The database cannot tell whether LaTeX parses. The importer must run every `LATEX` block through KaTeX and reject the row if it throws, so a broken formula fails at load rather than in front of a student.

### Equation

Use this rather than `LATEX` when the formula is displayed, named, or reused:

```sql
insert into content.equation (equation_id, latex_source, display_mode, equation_name)
values ('…', 'a = \frac{g \sin\theta}{1 + I/MR^{2}}', 'DISPLAY',
        'Acceleration of a rolling body on an incline');

insert into content.equation_variable (equation_id, symbol, meaning, si_unit, sort_order) values
  ('…', 'a',     'linear acceleration of the centre of mass', 'm s^-2', 1),
  ('…', 'theta', 'angle of the incline',                      'rad',    2);
```

Naming the symbols is what turns the equation from a picture into data — "which questions exercise this relation" becomes a query.

### Table

Structure, not a screenshot:

```sql
insert into content.data_table (table_id, table_kind, caption, column_defs, row_data, units)
values ('…', 'TABLE', 'Masses taken in each trial',
        '["Trial","Mass of Mg","Mass of HCl"]'::jsonb,
        '[["I",2.4,7.3],["II",4.8,7.3],["III",2.4,14.6]]'::jsonb,
        '["","g","g"]'::jsonb);
```

A screenshot of a table cannot be searched, translated, read aloud, or re-flowed onto a phone. This can. `table_kind = 'MATCHING_GRID'` uses the same structure for match-the-following items.

### Circuit

A vector asset, with the component values kept alongside as a table so the same schematic serves many questions with different values:

```sql
insert into content.asset (asset_id, asset_kind, storage_uri, mime_type, …)
values ('…', 'CIRCUIT', 'assets/phy/elec/wheatstone-bridge.svg', 'image/svg+xml', …);
```

Prefer SVG over PNG for schematics: it stays sharp at every zoom level, which matters when a student pinch-zooms on a phone during a timed paper.

### Graph

Two strategies, and the choice matters:

- **A rendered figure** in `content.asset` with a `GRAPH` block — when the plot is a fixed picture the student reads values off.
- **The underlying series** in `content.data_table` with a `DATASET` block — when the client should draw it. This stays legible at any width, can be re-themed, and can be read aloud.

Prefer the second whenever the data is simple enough to plot from.

---

## 3. Retrieving in the console

The point of the block model is that retrieval is *one query for every content type*. From `psql`:

```sql
select seq, block_type,
       coalesce(text_content, latex_source, storage_uri, column_defs::text) as payload,
       coalesce(mime_type, '-') as mime
  from content.v_question_render
 where lumen_id = 'LMN-PHY-CURELE-000001' and language_code = 'en'
 order by seq;
```

Real output from a question carrying all seven types:

```
 seq | block_type |             payload              |     mime
-----+------------+----------------------------------+---------------
   1 | TEXT       | The bridge below is balanced.    | -
   2 | CIRCUIT    | assets/phy/elec/wheatstone.svg   | image/svg+xml
   3 | EQUATION   | \frac{P}{Q} = \frac{R}{S}        | -
   4 | TABLE      | ["Component", "Value"]           | -
   5 | GRAPH      | assets/phy/elec/iv-curve.svg     | image/svg+xml
   6 | IMAGE      | assets/phy/elec/meter-bridge.png | image/png
   7 | LATEX      | Find $S$ when $P=10\,\Omega$.    | -
(7 rows)
```

`content.question.representation_types` is kept in step by trigger from the blocks actually present. For that question it derived, with no application code:

```
{CIRCUIT,EQUATION,GRAPH,IMAGE,LATEX,TABLE,TEXT}
```

which makes "every question containing a circuit diagram" a single GIN index lookup:

```sql
select lumen_id from content.question
 where representation_types @> array['CIRCUIT'];
```

Other console queries worth keeping to hand:

```sql
-- how many questions share one asset
select count(*) from content.content_block where asset_id = '…';

-- every question using a named relation
select q.lumen_id from content.content_block b
  join content.question q on q.question_id = b.question_id
 where b.equation_id = '…';

-- flatten a stored table into rows for inspection or CSV export
select ordinality as row_no, value as row_values
  from content.data_table dt, jsonb_array_elements(dt.row_data) with ordinality
 where dt.table_id = '…';

-- search inside table content, which a screenshot could never support
select table_id, caption from content.data_table
 where row_data::text ilike '%14.6%';
```

---

## 4. What the client does with each block

The API returns the block list in order; the renderer switches on `block_type`.

| `block_type` | Client behaviour |
|---|---|
| `TEXT` | render `text_content` according to `text_format` |
| `LATEX` | pass `text_content` to KaTeX |
| `EQUATION` | render `latex_source` in `display_mode`; optionally show the variable table on tap |
| `TABLE` | build a table element from `column_defs` and `row_data`, appending `units` to headers |
| `DATASET` | plot client-side from `row_data` |
| asset types | `<img>` from `storage_uri`, with `alt` from `alt_text` and the figure caption below |

Because each block is separately typed, a translated stem is the same structure with `language_code = 'ta'` — the diagram is not re-uploaded, and the Tamil blocks start again at sequence 1 in their own lane.

---

## 5. The one rule to hold the line on

**If it contains text a student needs to read, it must not be an image.** Tables, formulas and labels stored as pictures are invisible to search, impossible to translate, unusable by a screen reader, and unreadable on a small screen. The model gives every one of those a proper home, and the constraints make the proper home the easy path.
