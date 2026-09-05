/**
 * Shared builders for the Technical Specification Document generator.
 * See docs/tsd/README.md for how to run this.
 */
const d = require("docx");

const CONTENT_WIDTH = 10080; // DXA: Letter (12240) minus 2 x 1080 margins

const COLORS = {
  ink: "1F2933",
  heading: "1A3A5C",
  rule: "9AA5B1",
  headerFill: "E4E9EF",
  altFill: "F5F7FA",
  muted: "52606D",
};

function runs(text, opts = {}) {
  return new d.TextRun({
    text,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color || COLORS.ink,
    size: opts.size || 20,
    font: opts.font,
  });
}

/** Heading. level 1..4, text already carries its own clause number. */
function H(level, text) {
  const levels = [
    d.HeadingLevel.HEADING_1,
    d.HeadingLevel.HEADING_2,
    d.HeadingLevel.HEADING_3,
    d.HeadingLevel.HEADING_4,
  ];
  return new d.Paragraph({
    heading: levels[level - 1],
    keepNext: true,
    spacing: { before: level === 1 ? 320 : 240, after: 120 },
    children: [new d.TextRun({ text })],
  });
}

/** Body paragraph. Accepts a string, or an array of [text, opts] pairs. */
function P(text, opts = {}) {
  const children = Array.isArray(text)
    ? text.map((t) => (Array.isArray(t) ? runs(t[0], t[1]) : runs(t)))
    : [runs(text, opts)];
  return new d.Paragraph({
    children,
    spacing: { after: 120, line: 264 },
    alignment: d.AlignmentType.JUSTIFIED,
  });
}

/** Bullet list from an array of strings. */
function B(items) {
  return items.map(
    (t) =>
      new d.Paragraph({
        children: Array.isArray(t) ? t.map((x) => (Array.isArray(x) ? runs(x[0], x[1]) : runs(x))) : [runs(t)],
        bullet: { level: 0 },
        spacing: { after: 60, line: 264 },
      })
  );
}

/** Numbered list from an array of strings. */
function N(items, reference = "ordered") {
  return items.map(
    (t) =>
      new d.Paragraph({
        children: [runs(t)],
        numbering: { reference, level: 0 },
        spacing: { after: 60, line: 264 },
      })
  );
}

function cell(text, opts = {}) {
  const paras = String(text)
    .split(/\n/)
    .map(
      (line) =>
        new d.Paragraph({
          children: [runs(line, { bold: opts.bold, size: opts.size || 18, italics: opts.italics })],
          spacing: { before: 20, after: 20, line: 240 },
          alignment: opts.align || d.AlignmentType.LEFT,
        })
    );
  return new d.TableCell({
    width: { size: opts.width, type: d.WidthType.DXA },
    shading: opts.fill ? { type: d.ShadingType.CLEAR, fill: opts.fill, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    verticalAlign: d.VerticalAlign.TOP,
    children: paras,
  });
}

/**
 * Table. headers: array of strings. rows: array of arrays.
 * weights: relative column weights (defaults to equal).
 */
function T(headers, rows, weights) {
  const w = weights && weights.length === headers.length ? weights : headers.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  const widths = w.map((x) => Math.round((x / total) * CONTENT_WIDTH));
  widths[widths.length - 1] = CONTENT_WIDTH - widths.slice(0, -1).reduce((a, b) => a + b, 0);

  const border = { style: d.BorderStyle.SINGLE, size: 4, color: COLORS.rule };
  return new d.Table({
    width: { size: CONTENT_WIDTH, type: d.WidthType.DXA },
    columnWidths: widths,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new d.TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell(h, { width: widths[i], bold: true, fill: COLORS.headerFill })),
      }),
      ...rows.map(
        (r, ri) =>
          new d.TableRow({
            children: r.map((c, i) =>
              cell(c === null || c === undefined ? "" : c, {
                width: widths[i],
                fill: ri % 2 === 1 ? COLORS.altFill : undefined,
              })
            ),
          })
      ),
    ],
  });
}

/** Caption for a table or figure. `kind` is "Table" or "Figure". */
function CAP(kind, number, title) {
  return new d.Paragraph({
    children: [runs(`${kind} ${number} — ${title}`, { italics: true, size: 17, color: COLORS.muted })],
    spacing: { before: 60, after: 200 },
    alignment: d.AlignmentType.LEFT,
  });
}

/** Monospaced block (diagram, code, payload). `lines` is an array of strings. */
function CODE(lines, opts = {}) {
  const border = { style: d.BorderStyle.SINGLE, size: 4, color: COLORS.rule, space: 6 };
  return lines.map((line, i) => {
    const first = i === 0;
    const last = i === lines.length - 1;
    return new d.Paragraph({
      children: [
        new d.TextRun({ text: line || " ", font: "Consolas", size: opts.size || 15, color: COLORS.ink }),
      ],
      spacing: { before: first ? 60 : 0, after: last ? 60 : 0, line: 220 },
      shading: { type: d.ShadingType.CLEAR, fill: "F5F7FA", color: "auto" },
      keepNext: !last,
      border: {
        top: first ? border : undefined,
        bottom: last ? border : undefined,
        left: border,
        right: border,
      },
    });
  });
}


// --- Caption registry -------------------------------------------------------
// Figure/table numbers are allocated in document order as the part modules are
// required, then read back by the front matter to build the List of Figures and
// List of Tables. Requiring the parts out of order would renumber both lists.
const registry = { figures: [], tables: [] };

/** Table caption: allocates the next table number and records the title. */
function TBL(title) {
  registry.tables.push(title);
  return CAP("Table", registry.tables.length, title);
}

/** Figure caption: allocates the next figure number and records the title. */
function FIG(title) {
  registry.figures.push(title);
  return CAP("Figure", registry.figures.length, title);
}

/** Callout paragraph — used for assumptions, decisions and TBD flags. */
function NOTE(label, text) {
  return new d.Paragraph({
    children: [runs(`${label}: `, { bold: true }), runs(text)],
    spacing: { before: 80, after: 140, line: 264 },
    shading: { type: d.ShadingType.CLEAR, fill: "EEF3F8", color: "auto" },
    border: { left: { style: d.BorderStyle.SINGLE, size: 12, color: COLORS.heading, space: 8 } },
  });
}

function PB() {
  return new d.Paragraph({ children: [new d.PageBreak()] });
}

function SPACER(after = 120) {
  return new d.Paragraph({ children: [], spacing: { after } });
}

module.exports = { d, H, P, B, N, T, CAP, TBL, FIG, CODE, NOTE, PB, SPACER, runs, COLORS, CONTENT_WIDTH, registry };
