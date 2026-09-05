# Technical Specification Document generator

Builds `docs/LA-TSD-001_Technical_Specification_Document.docx` — the product's Technical
Specification Document (TSD) — from source, so the document can be regenerated and
diffed rather than hand-edited as a binary.

## Regenerate

`docx` is not a dependency of this project (nothing at runtime or in CI needs it), so
install it out of tree and point Node at it:

```bash
npm install --no-save --prefix /tmp/tsd docx
NODE_PATH=/tmp/tsd/node_modules node docs/tsd/build.cjs
```

Optional first argument overrides the output path:

```bash
NODE_PATH=/tmp/tsd/node_modules node docs/tsd/build.cjs /tmp/tsd-draft.docx
```

The build prints the output path, the file size and the figure/table counts.

## Layout

| File | Contents |
|---|---|
| `build.cjs` | Cover page, front matter (revision history, approval matrix, distribution list, table of contents, list of figures/tables/acronyms), styles, headers and footers, document assembly |
| `helpers.cjs` | Shared builders: headings, paragraphs, lists, tables, captions, monospaced diagram blocks, callouts, and the figure/table caption registry |
| `part1.cjs` | Sections 1–4: executive summary, scope, requirements, system overview |
| `part2.cjs` | Sections 5–7: architecture, technology stack, component design |
| `part3.cjs` | Sections 8–13: API, database, data architecture, workflows, authn/authz, security |
| `part4.cjs` | Sections 14–24: infrastructure, environments, CI/CD, testing, resilience, observability, capacity, HA/DR, integrations, configuration, dependencies |
| `part5.cjs` | Sections 25–33: compliance, decision records, risks, runbooks, maintenance, acceptance criteria, traceability, TBD register, appendices |

The files are `.cjs` because the repository is an ES module package and these scripts
use `require`.

## Conventions to preserve when editing

- **Figure and table numbers are allocated in document order** as `build.cjs` requires
  the parts. Do not reorder the `require` calls, and add a `FIG()`/`TBL()` caption
  immediately after the figure or table it belongs to — otherwise the List of Figures
  and List of Tables in the front matter renumber incorrectly.
- **Headings carry their own clause number in the text** (`H(2, "5.3 Logical architecture")`)
  and use built-in Word heading styles, which is what makes the table-of-contents field
  resolve. Keep both.
- **Identifiers are permanent**: `FR-nnn`, `NFR-<AREA>-nnn`, `API-nnn`, `ADR-nnn`,
  `RISK-nn`, `TBD-nn`, `AC-nn`. A withdrawn item is marked withdrawn; its identifier is
  never reused. Every `FR-nnn` must have a row in the traceability matrix (Section 31).
- **Never invent a value.** Anything undecided is `[TBD]`, `[TO BE DEFINED]` or
  `[INPUT REQUIRED]` in the text *and* a row in the TBD register (Section 32).
- **No secrets.** No credential, key, token or connection string belongs in the document
  or in these sources. Example values are placeholders in square brackets.
- Requirement language: *shall* is mandatory, *should* is a recommendation, *may* is optional.
- Diagram blocks are monospaced ASCII. Keep lines at or under **102 characters** so they
  fit the 7-inch text column at the configured font size.

## Consistency check

Identifier definitions and cross-references can be checked without opening Word:

```bash
python3 - <<'PY'
import re, glob, collections
src = "\n".join(open(f).read() for f in sorted(glob.glob('docs/tsd/part*.cjs')))
fr = re.findall(r'\["(FR-\d{3})", "([^"]{20,})", "([MSC])", "(IMPL|DIR|SEC|OPS)"\]', src)
ids = [r[0] for r in fr]
nums = sorted(int(i.split('-')[1]) for i in ids)
print("FRs:", len(ids), "unique:", len(set(ids)),
      "gaps:", [n for n in range(nums[0], nums[-1]+1) if n not in nums] or "none")
trace = set(re.findall(r'\["(FR-\d{3})", "[^"]*", "[^"]*", "[^"]*", "[^"]*", "[^"]*", "[^"]*"\]', src))
print("missing from traceability matrix:", sorted(set(ids) - trace) or "none")
for kind, pat in [("API", r'\bAPI-\d{3}'), ("RISK", r'\bRISK-\d{2}'),
                  ("TBD", r'\bTBD-\d{2}'), ("ADR", r'\bADR-\d{3}')]:
    declared = set(re.findall(r'\["(' + pat[2:] + r')"', src)) | set(re.findall(r'adr\("(' + pat[2:] + r')"', src))
    print(f"{kind} referenced but not defined:", sorted(set(re.findall(pat, src)) - declared) or "none")
PY
```

## Rendering note

LibreOffice in the cloud session this document was authored in could not load any file
(`soffice --convert-to pdf` fails even on a one-line document), so the output was verified
structurally — heading tree, table and cell integrity, header/footer fields, table-of-contents
field, diagram line widths — rather than by rendering it to PDF. Open the `.docx` in Word,
press `Ctrl+A` then `F9` to populate the table of contents, and give it a visual pass before
circulating it for approval.
