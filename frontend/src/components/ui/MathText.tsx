import React, { useLayoutEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { displayQuestionText } from "../../utils/questionText";

// docs/latex-rendering-fix-prompt.md Part A — the app had no math rendering
// capability at all: every stem/option/solution went through
// displayQuestionText() and landed in the DOM as a plain string, so "10^15"
// read as the literal four characters and "sqrt(6)" as a function call.
//
// Why a hand-written ^/_ pass in front of KaTeX rather than KaTeX alone:
// this question bank authors math *inline inside prose*, in English and in
// Tamil, with no $...$ delimiters anywhere ("In the collision theory ...,
// the rate equation is expressed as Rate = P * Z_AB * e^{-E_a / RT}. The
// term 'P' represents:"). Handing a whole mixed sentence to KaTeX would
// typeset the prose as math — and Tamil glyphs are not in KaTeX's fonts at
// all. So the default path is the cheap structural one (^/_ -> real
// <sup>/<sub>, React-escaped, no dangerouslySetInnerHTML) and KaTeX is
// called only for the segments that are genuine LaTeX commands (\sqrt{...},
// \lambda, \pi). Everything else stays a text node and reflows, wraps and
// inherits colour like the prose it sits in.
//
// Why katex and not MathJax: synchronous single-pass rendering (no async
// typeset queue to coordinate with React's commit), ~thirty times faster on
// the short expressions this bank contains, and a real DOM-node API
// (katex.render) rather than a string of HTML — which is what lets this
// component satisfy the "no dangerouslySetInnerHTML on unescaped content"
// requirement outright instead of sanitising after the fact.

type MathNode =
  | { kind: "text"; value: string }
  | { kind: "latex"; expr: string }
  | { kind: "sup" | "sub"; body: string };

/** Reads a balanced {...} starting at `open` (the index of the "{"). Returns null if it never closes. */
function readBraceGroup(s: string, open: number): { body: string; end: number } | null {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return { body: s.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

// A signed digit run, optionally decimal, optionally carrying a trailing ion
// charge ("10^-3", "10^15", "1.4", "2-" as in SO4^2-). The trailing sign is
// only taken when a digit run precedes it, so "x^2 - y" keeps its minus.
// The trailing sign is dropped when a letter or digit follows it, so the hyphen
// in "sp^2-hybridized" stays a hyphen instead of becoming a superscript "2-".
const DIGIT_RUN = /^[+-]?\d+(?:\.\d+)?(?:[+-](?![A-Za-z0-9]))?/;

// Subscripts are counts and indices, never signed or decimal. Using DIGIT_RUN
// for them read the bond hyphen in "CH_3-CH=NH" as a subscript "3-" and the
// hydrate dot in "CuSO_4.5H_2O" as a subscript "4.5".
const SUBSCRIPT_DIGIT_RUN = /^\d+/;

/**
 * Splits mixed prose/math into renderable segments. Never throws: anything it
 * cannot classify stays a text node, so unknown input degrades to today's
 * behaviour rather than to a blank stem.
 */
export function parseMathText(input: string): MathNode[] {
  const nodes: MathNode[] = [];
  let text = "";
  const flush = () => {
    if (text) nodes.push({ kind: "text", value: text });
    text = "";
  };

  let i = 0;
  while (i < input.length) {
    const ch = input[i];

    // A genuine LaTeX command: \name plus any brace groups it takes
    // (\sqrt{6}, \frac{a}{b}, \lambda). Handed to KaTeX whole.
    if (ch === "\\" && /[a-zA-Z]/.test(input[i + 1] ?? "")) {
      let j = i + 1;
      while (j < input.length && /[a-zA-Z]/.test(input[j])) j++;
      while (input[j] === "{") {
        const group = readBraceGroup(input, j);
        if (!group) break;
        j = group.end;
      }
      flush();
      nodes.push({ kind: "latex", expr: input.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === "^" || ch === "_") {
      const kind = ch === "^" ? "sup" : "sub";
      // Braced group first — the shape db/scripts/normalize-latex-new-content.mjs
      // normalises the whole bank to.
      if (input[i + 1] === "{") {
        const group = readBraceGroup(input, i + 1);
        if (group) {
          flush();
          nodes.push({ kind, body: group.body });
          i = group.end;
          continue;
        }
      }
      const rest = input.slice(i + 1);
      const run = (kind === "sup" ? DIGIT_RUN : SUBSCRIPT_DIGIT_RUN).exec(rest);
      if (run) {
        flush();
        nodes.push({ kind, body: run[0] });
        i += 1 + run[0].length;
        continue;
      }
      // Single non-space character: "Cl^-", "x^2", "Z^n".
      const next = input[i + 1];
      if (next && !/\s/.test(next)) {
        flush();
        nodes.push({ kind, body: next });
        i += 2;
        continue;
      }
    }

    text += ch;
    i++;
  }

  flush();
  return nodes;
}

/**
 * One KaTeX-typeset segment. Uses katex.render (real DOM nodes) rather than
 * renderToString + dangerouslySetInnerHTML. Falls back to the literal source
 * text if KaTeX cannot parse it, so a bad expression degrades to the old
 * plain-string behaviour instead of a red error block or an empty span.
 */
function KatexSegment({ expr }: { expr: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      katex.render(expr, el, { throwOnError: true, displayMode: false, strict: false, trust: false });
    } catch {
      el.textContent = expr;
    }
  }, [expr]);

  // Server/pre-effect content is the raw expression, so there is never a
  // blank flash and no-JS output is still readable.
  return <span ref={ref}>{expr}</span>;
}

function renderNodes(nodes: MathNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (node.kind === "text") return <React.Fragment key={key}>{node.value}</React.Fragment>;
    if (node.kind === "latex") return <KatexSegment key={key} expr={node.expr} />;
    // Scripts nest: "e^{-E_a / RT}" is a sup whose body carries its own sub.
    const inner = renderNodes(parseMathText(node.body), key);
    return node.kind === "sup" ? <sup key={key}>{inner}</sup> : <sub key={key}>{inner}</sub>;
  });
}

interface MathTextProps {
  /** Raw stem/option/explanation text straight off the API envelope. */
  children: string | null | undefined;
  className?: string;
}

/**
 * The single render path for any student-facing question text. Runs
 * displayQuestionText() first (the template-artifact strip every render site
 * already owed) and then turns the surviving math notation into real markup.
 *
 * Plain prose with no math markup comes out as one text node, byte-for-byte
 * what the old `{displayQuestionText(x)}` produced — which is what keeps the
 * ~1000 clean Botany/Zoology questions untouched.
 */
export default function MathText({ children, className }: MathTextProps) {
  const cleaned = displayQuestionText(children);
  if (!cleaned) return null;

  const rendered = renderNodes(parseMathText(cleaned), "m");
  return className ? <span className={className}>{rendered}</span> : <>{rendered}</>;
}
