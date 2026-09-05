/**
 * Builds the Technical Specification Document.
 *
 *   NODE_PATH=<dir containing node_modules/docx> node docs/tsd/build.js [outfile]
 *
 * Content lives in part1..part5; this file owns the cover page, the front
 * matter, the styles and the section/header/footer setup. The parts are
 * required in order because figure and table numbers are allocated in
 * document order as they load.
 */
const fs = require("fs");
const path = require("path");
const { d, H, P, B, T, CODE, NOTE, PB, SPACER, runs, COLORS, CONTENT_WIDTH, registry } = require("./helpers.cjs");

const META = {
  product: "Lumen Academy — NEET Assessment Tool",
  project: "NEET-assessment-tool-CSK",
  docTitle: "Technical Specification Document",
  docId: "LA-TSD-001",
  version: "0.1",
  status: "Draft",
  created: "2026-09-05",
  updated: "2026-09-05",
  classification: "[INPUT REQUIRED] — INTERNAL proposed",
};

/* Parts are loaded before the front matter so figure/table numbering is final. */
const body = [
  ...require("./part1.cjs"),
  ...require("./part2.cjs"),
  ...require("./part3.cjs"),
  ...require("./part4.cjs"),
  ...require("./part5.cjs"),
];

/* ------------------------------- cover page ------------------------------- */
function coverLine(label, value, opts = {}) {
  return new d.Paragraph({
    spacing: { after: 60 },
    children: [
      runs(label + ": ", { bold: true, size: 20 }),
      runs(value, { size: 20, italics: opts.italics }),
    ],
  });
}

const cover = [
  new d.Paragraph({ spacing: { after: 1400 }, children: [] }),
  new d.Paragraph({
    spacing: { after: 60 },
    children: [runs(META.product.toUpperCase(), { bold: true, size: 22, color: COLORS.muted })],
  }),
  new d.Paragraph({
    spacing: { after: 120 },
    border: { bottom: { style: d.BorderStyle.SINGLE, size: 12, color: COLORS.heading, space: 8 } },
    children: [runs(META.docTitle, { bold: true, size: 52, color: COLORS.heading })],
  }),
  new d.Paragraph({
    spacing: { after: 900 },
    children: [
      runs(
        "Authoritative technical baseline for the requirements, architecture, interfaces, persistence, security, delivery and operation of the product.",
        { size: 21, color: COLORS.muted, italics: true }
      ),
    ],
  }),
  coverLine("Product Name", META.product),
  coverLine("Project Name", META.project),
  coverLine("Document Title", META.docTitle),
  coverLine("Document ID", META.docId),
  coverLine("Version", META.version),
  coverLine("Status", "Draft  /  In Review  /  Approved   →   " + META.status),
  coverLine("Author", "[INPUT REQUIRED] — repository maintainers of record: C. Santhosh Kumar, Prince A., Deepan B."),
  coverLine("Technical Owner", "[INPUT REQUIRED]"),
  coverLine("Product Owner", "[INPUT REQUIRED]"),
  coverLine("Reviewers", "[INPUT REQUIRED]"),
  coverLine("Approvers", "[INPUT REQUIRED]"),
  coverLine("Created Date", META.created),
  coverLine("Last Updated", META.updated),
  coverLine("Classification", META.classification),
  new d.Paragraph({ spacing: { before: 700 }, children: [] }),
  new d.Paragraph({
    border: { top: { style: d.BorderStyle.SINGLE, size: 6, color: COLORS.rule, space: 8 } },
    children: [
      runs(
        "This document contains no credentials, keys or connection strings. Every example value shown in square brackets is a placeholder.",
        { size: 17, color: COLORS.muted, italics: true }
      ),
    ],
  }),
  PB(),
];

/* ------------------------------ front matter ------------------------------ */
const frontHeading = (text) =>
  new d.Paragraph({
    heading: d.HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 140 },
    children: [new d.TextRun({ text })],
  });

const front = [
  frontHeading("Document Revision History"),
  T(
    ["Version", "Date", "Author", "Summary of change", "Status"],
    [
      [
        "0.1",
        META.created,
        "[INPUT REQUIRED]",
        "Initial baseline. Requirements reverse-specified from the implemented system and from the programme's own directive and tracker documents; architecture, interface, persistence, security, delivery and operational sections established. Open items recorded in the TBD register rather than assumed.",
        "Draft",
      ],
      ["[TBD]", "[TBD]", "[TBD]", "[Next revision]", "[TBD]"],
    ],
    [0.6, 0.9, 1.2, 4, 0.7]
  ),
  SPACER(240),

  frontHeading("Review and Approval Matrix"),
  T(
    ["Role", "Name", "Responsibility", "Decision", "Date", "Signature"],
    [
      ["Author", "[INPUT REQUIRED]", "Produces and maintains the document", "Prepared", "[TBD]", ""],
      ["Technical Owner", "[INPUT REQUIRED]", "Accountable for architectural accuracy", "[Approve / Reject]", "[TBD]", ""],
      ["Product Owner", "[INPUT REQUIRED]", "Accountable for scope and requirements", "[Approve / Reject]", "[TBD]", ""],
      ["Backend Lead", "[INPUT REQUIRED]", "Reviews API, domain and persistence design", "[Reviewed]", "[TBD]", ""],
      ["Frontend Lead", "[INPUT REQUIRED]", "Reviews client architecture and accessibility", "[Reviewed]", "[TBD]", ""],
      ["QA Lead", "[INPUT REQUIRED]", "Reviews testability and acceptance criteria", "[Reviewed]", "[TBD]", ""],
      ["Security Reviewer", "[INPUT REQUIRED]", "Reviews Sections 12, 13 and 25", "[Reviewed]", "[TBD]", ""],
      ["Operations / SRE", "[INPUT REQUIRED]", "Reviews Sections 14 to 21, 28 and 29", "[Reviewed]", "[TBD]", ""],
    ],
    [1.1, 1.2, 2.2, 1, 0.7, 0.8]
  ),
  SPACER(240),

  frontHeading("Distribution List"),
  T(
    ["Recipient / group", "Purpose", "Access"],
    [
      ["Engineering team", "Implementation and review baseline", "Read/write via the repository"],
      ["Technical and product owners", "Approval and scope control", "Read/write"],
      ["QA", "Test design and traceability", "Read"],
      ["Operations", "Deployment, monitoring and runbooks", "Read"],
      ["Security reviewer", "Security and compliance review", "Read"],
      ["Future maintainers", "System understanding and change impact", "Read via the repository"],
      ["External parties", "None authorised at this classification", "None"],
    ],
    [1.6, 2.6, 1.4]
  ),
  SPACER(240),
  PB(),

  frontHeading("Table of Contents"),
  new d.Paragraph({
    spacing: { after: 160 },
    children: [
      runs(
        "The table below is a Word field. To populate or refresh it, open the document in Word, click anywhere in the table and press F9, or use References → Update Table. Headings use built-in heading styles, so the field resolves automatically.",
        { italics: true, size: 17, color: COLORS.muted }
      ),
    ],
  }),
  new d.TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
  }),
  PB(),

  frontHeading("List of Figures"),
  T(
    ["Figure", "Title"],
    registry.figures.map((t, i) => ["Figure " + (i + 1), t]),
    [0.8, 5]
  ),
  SPACER(200),
  PB(),

  frontHeading("List of Tables"),
  T(
    ["Table", "Title"],
    registry.tables.map((t, i) => ["Table " + (i + 1), t]),
    [0.8, 5]
  ),
  SPACER(200),
  PB(),

  frontHeading("List of Acronyms"),
  T(
    ["Acronym", "Expansion"],
    [
      ["ADR", "Architecture Decision Record"],
      ["API", "Application Programming Interface"],
      ["CDN", "Content Delivery Network"],
      ["CI/CD", "Continuous Integration / Continuous Delivery"],
      ["CORS", "Cross-Origin Resource Sharing"],
      ["CRUD", "Create, Read, Update, Delete"],
      ["CSP", "Content Security Policy"],
      ["DDL", "Data Definition Language"],
      ["DR", "Disaster Recovery"],
      ["ER", "Entity-Relationship"],
      ["ESM", "ECMAScript Module"],
      ["FR", "Functional Requirement"],
      ["HA", "High Availability"],
      ["IRT", "Item Response Theory"],
      ["JWT", "JSON Web Token"],
      ["MCQ", "Multiple Choice Question"],
      ["MoSCoW", "Must / Should / Could / Won't — priority scheme"],
      ["NEET", "National Eligibility cum Entrance Test"],
      ["NFR", "Non-Functional Requirement"],
      ["ORM", "Object-Relational Mapper"],
      ["OTP", "One-Time Password"],
      ["OWASP", "Open Worldwide Application Security Project"],
      ["PITR", "Point-In-Time Recovery"],
      ["RBAC", "Role-Based Access Control"],
      ["RLS", "Row-Level Security"],
      ["RPO", "Recovery Point Objective"],
      ["RTO", "Recovery Time Objective"],
      ["SLA / SLO", "Service Level Agreement / Service Level Objective"],
      ["SPA", "Single-Page Application"],
      ["SQL", "Structured Query Language"],
      ["SQLSTATE", "PostgreSQL five-character error code"],
      ["TBD", "To Be Determined"],
      ["TLS", "Transport Layer Security"],
      ["TSD", "Technical Specification Document"],
      ["UAT", "User Acceptance Testing"],
      ["UUID", "Universally Unique Identifier"],
      ["WAF", "Web Application Firewall"],
      ["WCAG", "Web Content Accessibility Guidelines"],
    ],
    [1, 4.2]
  ),
  SPACER(200),

  frontHeading("How to read this document"),
  P(
    "Sections 1 to 4 establish what the product is, what is in scope and what it must do. Sections 5 to 10 specify how it is built: architecture, stack, components, interfaces and persistence. Sections 11 to 13 specify behaviour, identity and security. Sections 14 to 21 specify how it is delivered, tested and operated. Sections 22 to 29 specify its dependencies, governance, decisions, risks and support model. Sections 30 to 32 specify how completion is judged, how requirements are traced, and what remains undecided."
  ),
  P(
    "Three conventions apply throughout. Requirement language follows the usual convention: shall is mandatory, should is a recommendation, may is optional. Anything not yet decided is marked [TBD], [TO BE DEFINED] or [INPUT REQUIRED] and appears in the register in Section 32 — no value has been invented to fill a gap. Statements describing the current implementation are distinguished from statements describing the target state; where the two differ, both are given."
  ),
  PB(),
];

/* --------------------------------- styles --------------------------------- */
const doc = new d.Document({
  creator: "Lumen Academy engineering",
  title: META.product + " — " + META.docTitle,
  description: META.docId + " v" + META.version,
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 20, color: COLORS.ink } },
      heading1: {
        run: { font: "Calibri Light", size: 30, bold: true, color: COLORS.heading },
        paragraph: {
          spacing: { before: 320, after: 140 },
          border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: COLORS.rule, space: 4 } },
        },
      },
      heading2: {
        run: { font: "Calibri Light", size: 25, bold: true, color: COLORS.heading },
        paragraph: { spacing: { before: 260, after: 120 } },
      },
      heading3: {
        run: { font: "Calibri", size: 22, bold: true, color: COLORS.heading },
        paragraph: { spacing: { before: 220, after: 100 } },
      },
      heading4: {
        run: { font: "Calibri", size: 21, bold: true, italics: true, color: COLORS.muted },
        paragraph: { spacing: { before: 180, after: 80 } },
      },
    },
  },
  numbering: {
    config: [
      {
        reference: "ordered",
        levels: [
          {
            level: 0,
            format: d.LevelFormat.DECIMAL,
            text: "%1.",
            alignment: d.AlignmentType.START,
            style: { paragraph: { indent: { left: 480, hanging: 240 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        titlePage: true,
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080, header: 560, footer: 560 },
        },
      },
      headers: {
        first: new d.Header({ children: [new d.Paragraph({ children: [] })] }),
        default: new d.Header({
          children: [
            new d.Paragraph({
              tabStops: [{ type: d.TabStopType.RIGHT, position: CONTENT_WIDTH }],
              border: { bottom: { style: d.BorderStyle.SINGLE, size: 4, color: COLORS.rule, space: 4 } },
              children: [
                runs(META.product + " — " + META.docTitle, { size: 16, color: COLORS.muted }),
                new d.TextRun({ text: "\t", size: 16 }),
                runs(META.docId + "  |  v" + META.version + "  |  " + META.status, { size: 16, color: COLORS.muted }),
              ],
            }),
          ],
        }),
      },
      footers: {
        first: new d.Footer({ children: [new d.Paragraph({ children: [] })] }),
        default: new d.Footer({
          children: [
            new d.Paragraph({
              tabStops: [
                { type: d.TabStopType.CENTER, position: Math.round(CONTENT_WIDTH / 2) },
                { type: d.TabStopType.RIGHT, position: CONTENT_WIDTH },
              ],
              border: { top: { style: d.BorderStyle.SINGLE, size: 4, color: COLORS.rule, space: 4 } },
              children: [
                runs("Classification: " + META.classification, { size: 16, color: COLORS.muted }),
                new d.TextRun({ text: "\t", size: 16 }),
                new d.TextRun({
                  children: ["Page ", d.PageNumber.CURRENT, " of ", d.PageNumber.TOTAL_PAGES],
                  size: 16,
                  color: COLORS.muted,
                }),
                new d.TextRun({ text: "\t", size: 16 }),
                runs("Last updated " + META.updated, { size: 16, color: COLORS.muted }),
              ],
            }),
          ],
        }),
      },
      children: [...cover, ...front, ...body],
    },
  ],
});

const out = process.argv[2] || path.join(process.cwd(), "docs", "LA-TSD-001_Technical_Specification_Document.docx");
d.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log(
    "Wrote " + out + " (" + (buf.length / 1024).toFixed(0) + " KB), " + registry.figures.length + " figures, " + registry.tables.length + " tables."
  );
});
