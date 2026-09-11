import fs from "node:fs";
import path from "node:path";

// docs/latex-rendering-fix-prompt.md Part B — one re-runnable transform that
// normalises the ad hoc math notation across db/content/content-batches/new_content
// into something a renderer can actually typeset, in English *and* in the
// Tamil translations[] (which duplicate the same formulae verbatim).
//
// Companion to db/scripts/audit-latex-new-content.mjs: that one reports, this
// one fixes, and the audit is the acceptance check after every run.
//
//   node db/scripts/normalize-latex-new-content.mjs            # dry run (default)
//   node db/scripts/normalize-latex-new-content.mjs --write    # rewrite files in place
//   node db/scripts/normalize-latex-new-content.mjs --write --only Physics
//
// Dry run by default, matching db/scripts/import/import-content.ts's
// convention. The review artefact is `git diff` on the content files, so the
// writer preserves each file's existing 2-space JSON layout, its CRLF-or-LF
// line endings and its trailing-newline-or-not exactly (verified: all 38
// files round-trip byte-for-byte through JSON.parse/stringify), and a file
// whose questions are already clean is never rewritten at all.
//
// Every rule below is idempotent — running twice changes nothing on the
// second pass — which is what makes it safe to re-run over already-fixed
// content when new batches land.

const ROOT = path.resolve("db/content/content-batches/new_content");

// Priority order from the fix prompt: Physics is worst (~74% of questions),
// then the flagged Chemistry chapters, then Botany/Zoology as a spot check.
const SUBJECT_PRIORITY = ["Physics", "Chemistry", "Botany", "Zoology"];

// ---------------------------------------------------------------------------
// Text transforms
// ---------------------------------------------------------------------------

/** Reads a balanced (...) starting at `open` (index of the "("). Null if unbalanced. */
function readParenGroup(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return { body: s.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** "sqrt(l(l + 1))" -> "\sqrt{l(l + 1)}". Balanced-paren aware; nested calls handled by the outer loop. */
function rewriteSqrtCalls(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    // Only a bare `sqrt(` call — never the `\sqrt{` this rule already produced.
    const m = /^sqrt\s*\(/i.exec(s.slice(i));
    const isWordStart = i === 0 || !/[A-Za-z0-9\\]/.test(s[i - 1]);
    if (m && isWordStart) {
      const group = readParenGroup(s, i + m[0].length - 1);
      if (group) {
        out += "\\sqrt{" + rewriteSqrtCalls(group.body) + "}";
        i = group.end;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

/** "e^(-Ea / RT)" -> "e^{-Ea / RT}", "f_(n+1)" -> "f_{n+1}". Balanced-paren aware. */
function rewriteParenScripts(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if ((s[i] === "^" || s[i] === "_") && s[i + 1] === "(") {
      const group = readParenGroup(s, i + 1);
      if (group) {
        out += s[i] + "{" + group.body + "}";
        i = group.end;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

// Exponent bodies are a *pure* digit run or a *pure* letter run, never mixed.
// That is what keeps "d^2U/dx^2" as d²U/dx² instead of misreading it as
// d^{2U}, while still bracing "10^15", "^238" and "^Delta".
//   ^-1     -> ^{-1}     (signed)
//   ^1.4    -> ^{1.4}    (decimal; a "." not followed by a digit is a full stop)
//   ^2-     -> ^{2-}     (ion charge: trailing sign only after a digit run,
//                         and only when a word character does not follow, so
//                         "x^2-y" keeps its minus as subtraction)
//   ^2U     -> ^{2}U      (the charge group must stay *optional* here rather
//                          than failing the whole match, so "d^2U/dx^2" is
//                          still seen as an exponent of 2 followed by a U)
const EXPONENT = /\^(?!\{)([+-]?)(?:(\d+(?:\.\d+)?)((?:[+-](?![A-Za-z0-9]))?)|([A-Za-z]+))/g;

/**
 * Braces any exponent whose body is more than one character. Single chars
 * ("^2", "^n", "^-") are left bare — except where a letter follows straight
 * on, as in "d^2U/dx^2", where the brace is the only thing that says the
 * exponent stopped at the 2 and the U is the function. Bracing that one keeps
 * it reading as d²U/dx² *and* clears the audit's unbraced-exponent regex,
 * which cannot tell "^2U" (correct) from "^15" (broken) on its own.
 */
function braceExponents(s) {
  return s.replace(EXPONENT, (whole, sign, digits, charge, letters, offset, full) => {
    const body = digits !== undefined ? sign + digits + (charge || "") : sign + letters;
    const followedByLetter = /[A-Za-z]/.test(full[offset + whole.length] ?? "");
    return body.length > 1 || followedByLetter ? `^{${body}}` : whole;
  });
}

// Subscript bodies read the other way round, because subscripts here are
// variable names rather than numbers:
//   letter-led  -> letters then optional digits   ("_max", "_v1", "_SO2")
//   digit-led   -> the digit run only             ("_92U" -> "_{92}U", nuclear
//                  notation), except for a µ-prefixed unit ("_2μF").
const SUBSCRIPT = /_(?!\{)(?:([A-Za-z]+\d*)|(\d+(?:μ[A-Za-z]+)?))/g;

/** Braces any subscript whose body is more than one character. */
function braceSubscripts(s) {
  return s.replace(SUBSCRIPT, (whole, word, num) => {
    const body = word !== undefined ? word : num;
    return body.length > 1 ? `_{${body}}` : whole;
  });
}

/**
 * "1/n1^2" -> "1/n_1^2". Scoped hard: a *word-initial* single letter followed
 * by one digit and immediately by "^". The word-boundary requirement is what
 * excludes chemical formulae — "CrO4^2-", "CO3^2-", "Cr2O7^2-", "C2H5^" all
 * have a word character before the letter and are left alone.
 *
 * ELEMENT_SYMBOLS then excludes the formulae that ARE word-initial. In this
 * bank that is only "O2^2-" (molecular oxygen), but the whole set of common
 * single-letter symbols is listed rather than just O, so a later batch adding
 * "N2^...", "H2^..." or "S2^..." does not silently start subscripting
 * molecules. Physics variables (A1, V1, r1, v1, t1, n1) are unaffected.
 */
const ELEMENT_SYMBOLS = new Set(["H", "N", "O", "F", "S", "C", "P"]);
function subscriptVariableIndices(s) {
  return s.replace(/\b([A-Za-z])(\d)\^/g, (whole, letter, digit) =>
    ELEMENT_SYMBOLS.has(letter) ? whole : `${letter}_${digit}^`
  );
}

/**
 * Spelled-out symbols, *only* where the surrounding characters are math.
 *
 * "lambda" never appears as English prose in this bank (it is always a
 * wavelength), so it converts on a plain word boundary. "pi" very much does —
 * "pi bonds", "pi-electrons", "pi* antibonding", "ring-pi donation" are all
 * chemistry prose — so it converts only when it sits directly after a digit,
 * "(" or "/" AND is not followed by "-", "*" or a word character. That
 * catches "(4 pi)", "h / 2pi", "8/pi", "4 pi v" and leaves every prose use.
 * Both guard against a preceding backslash so re-runs are no-ops.
 */
function rewriteSpelledSymbols(s) {
  let out = s.replace(/(?<!\\)\blambda\b/g, "\\lambda");
  // No leading \b: "h / 2pi" has no word boundary between the digit and the
  // "p". The lookbehind does that job instead, and the trailing guard is what
  // rejects "pi2px", "pi-electrons", "pi*" and "pituitary".
  out = out.replace(/(?<=\d\s?|[/(]\s?)(?<!\\)pi(?![-*\w])/g, "\\pi");
  return out;
}

/** The full pipeline. Order matters: sqrt/paren groups are resolved before anything looks at bare ^ and _. */
export function normalizeMath(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  let s = text;
  s = rewriteSqrtCalls(s);
  s = rewriteParenScripts(s);
  s = subscriptVariableIndices(s);
  s = braceExponents(s);
  s = braceSubscripts(s);
  s = rewriteSpelledSymbols(s);
  return s;
}

// ---------------------------------------------------------------------------
// Chemical formulae and ion charges
// ---------------------------------------------------------------------------
//
// The bank writes chemistry the way people type it — "H2O", "CH3COOH",
// "Cu2+", "[Co(NH3)6]3+" — so none of it carried a ^ or _ for MathText to
// render. This pass rewrites formula tokens into subscript/superscript markup:
//
//   H2O            -> H_2O                 C12H22O11    -> C_{12}H_{22}O_{11}
//   (CH3)3N        -> (CH_3)_3N            SO4^{2-}     -> SO_4^{2-}
//   NH4+           -> NH_4^+               MnO4-/Mn2+   -> MnO_4^-/Mn^{2+}
//   Cu2+  Na+  N3- -> Cu^{2+} Na^+ N^{3-}  [CoF6]3-     -> [CoF_6]^{3-}
//   O2+ (MO)       -> O_2^+                6 e-         -> 6 e^-
//
// Every guard below exists because the survey of all 38 files found a real
// case it protects (see docs/latex-rendering-fix-prompt.md follow-up):
//
//  * A token is only a formula if every capitalised symbol in it is a real
//    element. That alone rejects "E2", "T1", "L2", "G1 phase", "H2A", "CD4+",
//    "EDTA4-", "NADH", "GA3", "[A]0".
//  * A SINGLE symbol with a count ("K1", "V2", "C4 plants", "P700", "B12",
//    "F1 generation", "I2" as a current) is a variable or a name far more often
//    than a molecule, so it is only subscripted when it is a real molecule in
//    MOLECULES — and outside Chemistry that list is just O2/N2/H2/O3.
//  * An indexed family in the same field ("N1 * V1 = N2 * V2") means N2 is a
//    variable there, not nitrogen.
//  * A trailing sign is only a charge when nothing word-like follows it, so
//    bond hyphens ("CH3-CH=NH", "P-Cl", "Zn-Hg"), Tamil suffixes ("I-ன்") and
//    arrows ("->") are never charges; and a "-" closing a bivalent group that
//    opens with a dangling bond ("(-O-O-)", "(-CH2-)", "(-SO2-)") is a bond.
//  * On a monatomic ion the digits are the charge ("Cu2+" is Cu²⁺, not Cu₂⁺);
//    on a molecule or polyatomic ion they are the count ("NH4+", "O2+").
//
// Like everything else in this file it only ever inserts _ ^ { } — the letters,
// digits and signs of every field stay in the same order.

const ELEMENTS = new Set(
  (
    "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr " +
    "Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb " +
    "Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr"
  ).split(" ")
);

// Placeholder symbols chemistry writing treats as elements — alkyl R, halogen
// X, metal M, lanthanoid Ln, deuterium D ("RCOO-", "X2", "Ln(OH)3", "D2O").
// Chemistry files only: elsewhere "X-rays", "R-type" and "D-(+)" are prose.
const GENERIC_SYMBOLS = new Set(["R", "X", "M", "Ln", "D"]);
// …and of those, only X and M ever stand alone as an ion ("X-(aq)", "M+").
const GENERIC_IONS = new Set(["X", "M"]);

const MOLECULES_CHEMISTRY = new Set(["H2", "N2", "O2", "O3", "F2", "Cl2", "Br2", "I2", "S2", "S8", "P4", "He2", "Li2", "X2"]);
const MOLECULES_OTHER_SUBJECTS = new Set(["H2", "N2", "O2", "O3"]);

// Names that happen to spell valid element symbols.
const NOT_FORMULAE = new Set(["SN1", "SN2", "IP3", "CF0", "CF1", "H2B"]); // H2B: the histone, beside H2A/H3/H4
// "Rh+" / "Rh-" outside Chemistry is a blood group, not rhodium.
const NOT_IONS_OUTSIDE_CHEMISTRY = new Set(["Rh"]);

// "O2-" is genuinely ambiguous in plain text: superoxide O₂⁻ (molecular
// orbital questions) or oxide O²⁻. The default reading is the molecular ion;
// these questions use it as the oxide ion — an isoelectronic N³⁻/O²⁻/F⁻ series,
// and oxide-to-metal charge transfer in chromate — resolved by the chemistry.
const OXIDE_ION_QUESTIONS = new Set(["LMN-CHEM-CHEM04-000010", "LMN-CHEM-CHEM10-000007"]);

const sub = (digits) => (digits.length === 1 ? `_${digits}` : `_{${digits}}`);

/**
 * Parses a formula starting at `i`: element symbols with optional counts, and
 * (...) / [...] groups with optional counts, one level of nesting inside a
 * group. Returns null if a group cannot be closed or a capital is not a symbol.
 */
// Lowercase ligand abbreviations written inside formula brackets: "[Co(en)2Cl2]+".
const LIGAND_GROUP = /^\((en|py|ox|gly|dien|acac|bipy|phen)\)/;

/**
 * Parses a formula starting at `i`: element symbols with optional counts, and
 * (...) / [...] groups with optional counts, one level of nesting inside a
 * group. Inside a group, bonds are allowed when a chain continues after them
 * ("(CH3-CH2-CH2)3B"). Returns null if a group cannot be closed or a capital
 * is not a symbol.
 */
function parseFormulaUnits(s, i, ctx, closer = null, depth = 0) {
  const units = [];
  const countAt = (j) => /^\d+/.exec(s.slice(j))?.[0] ?? "";
  while (i < s.length) {
    const c = s[i];
    if (/[A-Z]/.test(c)) {
      const two = c + (s[i + 1] ?? "");
      let sym = null;
      if (/[a-z]/.test(s[i + 1] ?? "") && ctx.isSymbol(two)) sym = two;
      else if (ctx.isSymbol(c)) sym = c;
      if (!sym) return null;
      i += sym.length;
      if (/[a-z]/.test(s[i] ?? "")) return null; // "Copper", "Hb" — a word, not a formula
      const count = countAt(i);
      i += count.length;
      units.push({ type: "el", sym, count });
      continue;
    }
    if (closer && units.length > 0 && /[-=≡]/.test(c) && /[A-Z(]/.test(s[i + 1] ?? "")) {
      units.push({ type: "bond", text: c });
      i++;
      continue;
    }
    if (c === "(" && ctx.chemistry && depth < 2) {
      const ligand = LIGAND_GROUP.exec(s.slice(i));
      if (ligand) {
        i += ligand[0].length;
        const count = countAt(i);
        i += count.length;
        units.push({ type: "ligand", text: ligand[0], count });
        continue;
      }
    }
    if ((c === "(" || c === "[") && depth < 2) {
      const close = c === "(" ? ")" : "]";
      const inner = parseFormulaUnits(s, i + 1, ctx, close, depth + 1);
      if (!inner || inner.units.length === 0) {
        if (closer) return null;
        break; // "(aq)", "(s)", "(15 e-)" — the formula simply ends here
      }
      i = inner.end + 1;
      const count = countAt(i);
      i += count.length;
      units.push({ type: "group", open: c, close, inner: inner.units, count });
      continue;
    }
    if (closer) return c === closer ? { units, end: i } : null;
    break;
  }
  if (closer) return null;
  return { units, end: i };
}

/** Element and ligand units, flattened through groups. */
function elementsOf(units) {
  return units.flatMap((u) => (u.type === "el" || u.type === "ligand" ? [u] : u.type === "group" ? elementsOf(u.inner) : []));
}

function renderUnits(units) {
  const n = (count) => (count ? sub(count) : "");
  return units
    .map((u) => {
      if (u.type === "el") return u.sym + n(u.count);
      if (u.type === "ligand") return u.text + n(u.count);
      if (u.type === "bond") return u.text;
      return u.open + renderUnits(u.inner) + u.close + n(u.count);
    })
    .join("");
}

/** A "-" closing a group that opens with a dangling bond: "(-O-O-)", "(-CH2-)". */
function closesBivalentGroup(s, tokenStart) {
  if (s[tokenStart - 1] !== "-") return false;
  let j = tokenStart - 1;
  while (j >= 0 && /[A-Za-z0-9)\]=+\-_^{}]/.test(s[j])) j--;
  return s.slice(j + 1, tokenStart).startsWith("-");
}

/** The sign straight after a token, if it reads as an ion charge. */
function readCharge(s, tokenStart, end) {
  const sign = s[end];
  if (sign !== "+" && sign !== "-") return null;
  const rest = s.slice(end + 1);
  const next = rest[0] ?? "";
  const ok =
    next === "" ||
    /[\s),\].;:/?]/.test(next) ||
    /^\((aq|s|g|l)\)/.test(rest) || // "Ag+(aq)"; any other "(" after a sign is a bond: "CH3-(CH2)14"
    (sign === "+" && (next === "-" || next === "=")); // "CH3-CH+-CH3", "H2N+=C"
  if (!ok) return null;
  if (sign === "-" && closesBivalentGroup(s, tokenStart)) return null;
  // "CH3-CH(OH)-", "CH(CH3)-CH=CH2": a hyphen after a substituent bracket continues the chain.
  if (sign === "-" && s[end - 1] === ")") return null;
  return sign;
}

function rewriteFormulaAt(s, start, ctx) {
  const parsed = parseFormulaUnits(s, start, ctx);
  if (!parsed || parsed.units.length === 0) return null;
  const { units, end } = parsed;
  if (/[a-z]/.test(s[end] ?? "")) return null;

  const raw = s.slice(start, end);
  if (NOT_FORMULAE.has(raw) || NOT_FORMULAE.has(raw.replace(/^[([]|[)\]]$/g, ""))) return null;

  const elements = elementsOf(units);
  if (elements.length === 0) return null;
  const charge = readCharge(s, start, end);
  const last = units[units.length - 1];

  if (elements.length === 1) {
    const el = elements[0];
    if (units.some((u) => u.type === "group" && u.count)) return null;
    const molecule = el.count && ctx.molecules.has(el.sym + el.count) && !ctx.indexedSymbols.has(el.sym);

    if (charge && last.type === "el") {
      if (!ELEMENTS.has(el.sym) && !(ctx.chemistry && GENERIC_IONS.has(el.sym))) return null;
      if (!ctx.chemistry && NOT_IONS_OUTSIDE_CHEMISTRY.has(el.sym)) return null;
      const oxide = el.sym === "O" && el.count === "2" && OXIDE_ION_QUESTIONS.has(ctx.questionUid);
      if (el.count && molecule && !oxide) return { text: `${el.sym}${sub(el.count)}^${charge}`, end: end + 1 };
      if (el.count) {
        if (el.count.length > 1 || el.count === "0") return null;
        return { text: `${el.sym}^{${el.count}${charge}}`, end: end + 1 };
      }
      return { text: `${el.sym}^${charge}`, end: end + 1 };
    }
    if (!molecule) return null;
    return { text: renderUnits(units), end };
  }

  const hasCount = elements.some((e) => e.count) || units.some((u) => u.type === "group" && u.count);
  if (!hasCount && !charge) return null;

  if (charge) {
    // "[CoF6]3-": a count straight after a closing square bracket is the charge.
    if (last.type === "group" && last.close === "]" && last.count) {
      const body = renderUnits(units.slice(0, -1)) + last.open + renderUnits(last.inner) + last.close;
      return { text: `${body}^{${last.count}${charge}}`, end: end + 1 };
    }
    return { text: `${renderUnits(units)}^${charge}`, end: end + 1 };
  }
  return { text: renderUnits(units), end };
}

/**
 * Rewrites every chemical formula and ion charge in one text field.
 * ctx.subject is the content folder ("Chemistry", "Botany", …); ctx.questionUid
 * resolves the documented O2- ambiguity.
 */
export function normalizeChemistry(text, ctx = {}) {
  if (typeof text !== "string" || text.length === 0) return text;
  const chemistry = ctx.subject === "Chemistry";
  const isSymbol = (sym) => ELEMENTS.has(sym) || (chemistry && GENERIC_SYMBOLS.has(sym));
  // "N1 * V1 = N2 * V2": a symbol that also appears with index 1 is a variable family.
  const indexedSymbols = new Set([...text.matchAll(/(?<![A-Za-z])([A-Z][a-z]?)1(?![0-9])/g)].map((m) => m[1]));
  const local = {
    chemistry,
    isSymbol,
    indexedSymbols,
    molecules: chemistry ? MOLECULES_CHEMISTRY : MOLECULES_OTHER_SUBJECTS,
    questionUid: ctx.questionUid,
  };

  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const prev = text[i - 1] ?? "";
    if (/[A-Z([]/.test(c) && !/[A-Za-z_^{}\\]/.test(prev)) {
      const rewritten = rewriteFormulaAt(text, i, local);
      if (rewritten) {
        out += rewritten.text;
        i = rewritten.end;
        continue;
      }
    }
    out += c;
    i++;
  }
  // The electron: "6 e-", "(15 e-)", "+ 2e- ->".
  return out.replace(/(?<=\d\s?)e-(?=[\s),.;:]|$)/g, "e^-");
}

// ---------------------------------------------------------------------------
// Symbols, Greek letters, orbitals, constants and indices
// ---------------------------------------------------------------------------
//
// The last pass: everything a printed textbook shows differently from how it
// was typed, once exponents and formulae are already right.
//
//   ->  <=>  <->  =>  >=  <=  !=        →  ⇌  ↔  ⇒  ≥  ≤  ≠
//   6.626 * 10^{-34}   8.5 x 10^{28}     6.626 × 10^{-34}   8.5 × 10^{28}
//   Delta H  beta-globin  pi bonds       ΔH  β-globin  π bonds
//   1s2 2p6  (n-1)d10  2px1  sp3d2       1s^2 2p^6  (n-1)d^{10}  2p_x^1  sp^{3}d^2
//   Ksp  pKa  Ea  E°cell  t1/2  log10    K_{sp}  pK_a  E_a  E°_{cell}  t_{1/2}  log_{10}
//   P1 = P2   U12                        P_1 = P_2   U_{12}          (Physics, Chemistry)
//   F1  G1 phase  C4 plants  B12  T3     F_1  G_1  C_4  B_{12}  T_3  (Botany/Zoology, named list)
//   NAD+  EDTA4-  CD4+                   NAD^+  EDTA^{4-}  CD4^+
//
// As with the other passes, every guard traces to a real case in the survey:
// "pi* antibonding" keeps its star, "E2 elimination" and "C2-C3 bond" keep
// their digits, "T2 bacteriophage", "H3 histone", "P700" and "C7 vertebra"
// are names printed without subscripts, and "Sigma (σ) factor" is left as
// written rather than doubled.

const GREEK = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", epsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", Theta: "Θ", kappa: "κ", lambda: "λ", Lambda: "Λ", mu: "μ", nu: "ν", pi: "π", Pi: "π",
  rho: "ρ", sigma: "σ", Sigma: "σ", tau: "τ", phi: "φ", Phi: "Φ", chi: "χ", psi: "ψ", omega: "ω", Omega: "Ω",
}; // "xi" deliberately absent: it is also the roman numeral (xi)
const GREEK_WORD = new RegExp(`(?<![A-Za-z\\\\])(${Object.keys(GREEK).sort((a, b) => b.length - a.length).join("|")})(?![a-z])`, "g");

/** A superscript count, braced whenever a letter, digit, sign or dot follows so no renderer can misread the boundary. */
const sup = (digits, next = "") => (digits.length === 1 && !/[A-Za-z0-9+\-.]/.test(next) ? `^${digits}` : `^{${digits}}`);
const subOf = (digits) => (digits.length === 1 ? `_${digits}` : `_{${digits}}`);

function rewriteGreekWords(s) {
  // "(RT)^{Delta} n_g" came out of the exponent pass split; the Δ belongs to n_g.
  let out = s.replace(/\^\{Delta\} n_g/g, "^{Δn_g}");
  // "Delta H", "Delta n_g", "Delta Tf": the symbol sits flush against the quantity.
  out = out.replace(/(?<![A-Za-z\\])Delta (?=(?:[HSGUVTPxvq]|Ea|T[fb])(?![a-z])|n_)/g, "Δ");
  return out.replace(GREEK_WORD, (word, _w, offset, str) => {
    // Capital "Pi" alone is inorganic phosphate ("ADP and Pi are released");
    // it is only π in "Pi bond(ing)".
    if (word === "Pi" && !str.startsWith(" bond", offset + word.length)) return word;
    const letter = GREEK[word];
    if (str.startsWith(` (${letter})`, offset + word.length)) return word; // "Sigma (σ) factor"
    return letter;
  });
}

const HYBRIDS = { d2sp3: "d^{2}sp^3", sp3d2: "sp^{3}d^2", sp3d: "sp^{3}d", dsp2: "dsp^2", sp3: "sp^3", sp2: "sp^2" };

function rewriteHybridisation(s) {
  return s.replace(/(?<![A-Za-z0-9])(d2sp3|sp3d2|sp3d|dsp2|sp3|sp2)(?![A-Za-z0-9])/g, (m, _h, offset, str) => {
    const t = HYBRIDS[m];
    return /[A-Za-z0-9+\-.]/.test(str[offset + m.length] ?? "") ? t.replace(/\^(\d)$/, "^{$1}") : t; // "sp^{2}-hybridized"
  });
}

function rewriteOrbitals(s) {
  // "2px1", "2px^1", "(3px)" -> "2p_x^1", "(3p_x)"
  let out = s.replace(/(?<![A-Za-z0-9])([1-7])p([xyz])(?:\^?(\d))?(?![0-9A-Za-z_])/g, (m, n, axis, count, offset, str) =>
    `${n}p_${axis}${count ? sup(count, str[offset + m.length]) : ""}`
  );
  // "1s2 2s2 2p6", "4f14", "(n-1)d10 ns2" -> "1s^2 2s^2 2p^6", "4f^{14}", "(n-1)d^{10} ns^2"
  out = out.replace(/(\(n-[12]\)|(?<![A-Za-z0-9])[1-7n])([spdf])(\d{1,2})(?![0-9A-Za-z_^{])/g, (m, n, l, count, offset, str) =>
    `${n}${l}${sup(count, str[offset + m.length])}`
  );
  // bare d-electron counts: "(d5)", "d0 configuration", "d1 to d9"
  return out.replace(/(?<![A-Za-z0-9_^\-])d(\d{1,2})(?![0-9A-Za-z_^{])/g, (m, count, offset, str) => `d${sup(count, str[offset + m.length])}`);
}

function rewriteConstants(s, chemistry) {
  let out = s.replace(/(?<![A-Za-z])log10(?![0-9])/g, "log_{10}");
  if (!chemistry) return out;
  return out
    .replace(/E°_\{([A-Z][a-z]?)(\d)\}([+-])\/([A-Z][a-z]?)/g, "E°_{$1^{$2$3}/$4}") // repairs "E°_{Cu2}+/Cu"
    .replace(/t_\{(\d+)\}\.(\d)%/g, "t_{$1.$2%}") // repairs "t_{99}.9%"
    .replace(/(?<![A-Za-z0-9_])t1\/2(?![0-9])/g, "t_{1/2}")
    .replace(/(?<![A-Za-z0-9_])t(\d{2}(?:\.\d)?)%/g, "t_{$1%}")
    .replace(/(?<![A-Za-z_])pK([ab])(?![A-Za-z0-9])/g, "pK_$1")
    .replace(/(?<![A-Za-z_])K(sp|eq)(?![A-Za-z0-9])/g, "K_{$1}")
    .replace(/(?<![A-Za-z_])K([abcpwhf])(?![A-Za-z0-9])/g, "K_$1")
    .replace(/(?<![A-Za-z_])E(°?)cell(?![A-Za-z])/g, "E$1_{cell}")
    .replace(/(?<![A-Za-z_])Ea_\{(\w+)\}/g, "E_{a,$1}")
    .replace(/(?<![A-Za-z_])Ea(?![A-Za-z0-9_])/g, "E_a")
    .replace(/(?<=Δ)T([bf])(?![A-Za-z0-9_])/g, "T_$1") // only after Δ: bare "Tb" is also terbium
    .replace(/\[([A-Z])\]0_(\d)/g, "[$1]_{0,$2}")
    .replace(/\[([A-Z])\]0(?![0-9_])/g, "[$1]_0");
}

// Chemistry letters whose digits are names, not indices: carbon numbering
// (C1, C2-C3), elimination mechanisms (E1, E2), and d-electron counts, which
// rewriteOrbitals owns.
const INDEX_EXCLUDED_CHEMISTRY = new Set(["C", "E", "d"]);

function rewriteIndexedVariables(s, subject) {
  if (subject !== "Physics" && subject !== "Chemistry") return s;
  return s.replace(/(?<![A-Za-z0-9_^{\\°'.])((?:[A-Za-z]\d{1,2}){1,3})(?![A-Za-z0-9_^{(%])/g, (chain) => {
    const parts = chain.match(/[A-Za-z]\d{1,2}/g);
    if (subject === "Chemistry" && parts.some((p) => INDEX_EXCLUDED_CHEMISTRY.has(p[0]))) return chain;
    return parts.map((p) => p[0] + subOf(p.slice(1))).join("");
  });
}

// Names that textbooks print with a subscript. A fixed list, per subject,
// because the same shapes are also names printed WITHOUT one ("T2 phage",
// "C2 vertebra", "H3 histone").
const NAMED_INDICES = {
  Botany: ["F1", "F2", "C2", "C3", "C4", "G0", "G1", "G2", "GA3", "CF0", "CF1", "a3", "c1", "N0"],
  Zoology: ["T3", "T4", "B1", "B3", "B7", "B12", "IP3", "H2L2", "H4L2", "H1L3", "H2L4"],
};

function rewriteNamedIndices(s, subject) {
  const names = NAMED_INDICES[subject];
  if (!names) return s;
  let out = s.replace(new RegExp(`(?<![A-Za-z0-9_^{])(${names.join("|")})(?![A-Za-z0-9_^{])`, "g"), (name) =>
    name.replace(/\d+/g, (d) => subOf(d))
  );
  if (subject === "Botany") {
    out = out.replace(/(?<=ibberellin |ஜிப்ரல்லின் )A3(?![A-Za-z0-9])/g, "A_3").replace(/(?<![A-Za-z0-9_])Nt(?= = )/g, "N_t");
  }
  return out;
}

function rewriteChargedNames(s) {
  return s
    .replace(/(?<![A-Za-z0-9])(NADP|NAD|CD4|CD8)\+(?=[\s),.;:]|$)/g, "$1^+")
    .replace(/(?<![A-Za-z0-9])EDTA4-(?=[\s),.;:]|$)/g, "EDTA^{4-}");
}

function rewriteRelations(s) {
  return s
    .replace(/<=>/g, "⇌")
    .replace(/<->/g, "↔")
    .replace(/->/g, "→")
    .replace(/=>/g, "⇒")
    .replace(/>=/g, "≥")
    .replace(/<=/g, "≤")
    .replace(/!=/g, "≠");
}

function rewriteMultiplication(s) {
  return s
    .replace(/(\d)\s[xX]\s(?=10\^)/g, "$1 × ")
    .replace(/(?<=\S) \* (?=\S)/g, " × ")
    .replace(/(?<=[\p{L}\p{N})\]}'])\*(?=[\p{L}\p{N}(\[{\\])/gu, (star, offset, str) => (/[σπ]$/.test(str.slice(0, offset)) ? star : "×")); // π*, σ* are orbitals
}

/** The symbols pass. ctx.subject scopes the chemistry- and biology-specific rules. */
export function normalizeNotation(text, ctx = {}) {
  if (typeof text !== "string" || text.length === 0) return text;
  const chemistry = ctx.subject === "Chemistry";
  let s = rewriteGreekWords(text);
  if (chemistry) {
    s = rewriteHybridisation(s);
    s = rewriteOrbitals(s);
  }
  s = rewriteConstants(s, chemistry);
  s = rewriteIndexedVariables(s, ctx.subject);
  s = rewriteNamedIndices(s, ctx.subject);
  s = rewriteChargedNames(s);
  s = rewriteRelations(s);
  return rewriteMultiplication(s);
}

// ---------------------------------------------------------------------------
// Question-level pass
// ---------------------------------------------------------------------------

// Kept deliberately in step with audit-latex-new-content.mjs's own
// "questionHasMathMarkup" test — the audit's stemFormatMismatch check is
// per-question and looks at every field (stem, options, solution, all
// translations), so the format flags have to be set on the same per-question
// basis for the audit to reach zero.
const MATH_MARKUP = /[\^_]|\\[a-zA-Z]+|sqrt\(/i;

function questionHasMath(q) {
  const fields = [q.stemText, q.solution?.explanationText];
  for (const o of q.options ?? []) fields.push(o.text);
  for (const t of q.translations ?? []) {
    fields.push(t.stemText);
    for (const ot of t.optionTexts ?? []) fields.push(ot);
  }
  return fields.some((f) => typeof f === "string" && MATH_MARKUP.test(f));
}

/** Math first (it braces "SO4^2-" to "SO4^{2-}"), then chemistry (which makes that "SO_4^{2-}"). */
export function normalizeField(text, ctx) {
  // …and symbols last, so the chemistry rule still sees ASCII arrows and signs.
  return normalizeNotation(normalizeChemistry(normalizeMath(text), ctx), ctx);
}

/** Rewrites one question in place. Returns the number of fields whose text changed. */
function normalizeQuestion(q, stats, subject) {
  let changed = 0;
  const ctx = { subject, questionUid: q.questionUid };
  const apply = (obj, key) => {
    const before = obj[key];
    if (typeof before !== "string") return;
    const after = normalizeField(before, ctx);
    if (after !== before) {
      obj[key] = after;
      changed++;
      if (stats.samples.length < 12 && before.length < 220) stats.samples.push({ uid: q.questionUid, key, before, after });
    }
  };

  apply(q, "stemText");
  if (q.solution) apply(q.solution, "explanationText");
  for (const o of q.options ?? []) apply(o, "text");
  for (const t of q.translations ?? []) {
    apply(t, "stemText");
    if (Array.isArray(t.optionTexts)) {
      for (let i = 0; i < t.optionTexts.length; i++) {
        const before = t.optionTexts[i];
        const after = normalizeField(before, ctx);
        if (after !== before) {
          t.optionTexts[i] = after;
          changed++;
        }
      }
    }
  }

  // Format flags last, so they reflect the normalised text.
  let flagged = 0;
  if (questionHasMath(q)) {
    if (q.stemFormat !== "latex") {
      q.stemFormat = "latex";
      flagged++;
    }
    if (q.solution && q.solution.solutionFormat !== "latex") {
      q.solution.solutionFormat = "latex";
      flagged++;
    }
  }
  stats.formatFlagsSet += flagged;
  return changed + flagged;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function listJsonFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function subjectOf(file) {
  const rel = path.relative(ROOT, file);
  return rel.split(path.sep)[0];
}

function main() {
  const write = process.argv.includes("--write");
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;

  let files = listJsonFiles(ROOT);
  if (only) files = files.filter((f) => subjectOf(f).toLowerCase() === only.toLowerCase());
  files.sort((a, b) => {
    const sa = SUBJECT_PRIORITY.indexOf(subjectOf(a));
    const sb = SUBJECT_PRIORITY.indexOf(subjectOf(b));
    return sa !== sb ? sa - sb : a.localeCompare(b);
  });

  const stats = { formatFlagsSet: 0, samples: [] };
  let filesChanged = 0;
  let questionsChanged = 0;
  const perFile = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf-8");
    const arr = JSON.parse(raw);
    let touched = 0;
    for (const q of arr) if (normalizeQuestion(q, stats, subjectOf(file)) > 0) touched++;

    if (touched === 0) {
      // "Don't touch files the audit reports as 0/30" — falls out of this
      // rather than out of a hard-coded skip list.
      perFile.push({ file: path.relative(process.cwd(), file), questionsChanged: 0 });
      continue;
    }

    let out = JSON.stringify(arr, null, 2);
    if (raw.includes("\r\n")) out = out.replace(/\n/g, "\r\n");
    if (raw.endsWith("\r\n")) out += "\r\n";
    else if (raw.endsWith("\n")) out += "\n";

    if (out !== raw) {
      if (write) fs.writeFileSync(file, out, "utf-8");
      filesChanged++;
      questionsChanged += touched;
    }
    perFile.push({ file: path.relative(process.cwd(), file), questionsChanged: touched });
  }

  console.log(write ? "MODE: --write (files rewritten in place)" : "MODE: dry run (no files written; pass --write to apply)");
  console.log(`files scanned:      ${files.length}`);
  console.log(`files changed:      ${filesChanged}`);
  console.log(`questions changed:  ${questionsChanged}`);
  console.log(`format flags set:   ${stats.formatFlagsSet}`);
  console.log("\nper file:");
  for (const f of perFile) console.log(`  ${String(f.questionsChanged).padStart(3)}  ${f.file}`);

  if (stats.samples.length) {
    console.log("\nsample rewrites:");
    for (const s of stats.samples) {
      console.log(`\n  ${s.uid} · ${s.key}`);
      console.log(`    before: ${s.before}`);
      console.log(`    after:  ${s.after}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("normalize-latex-new-content.mjs")) {
  main();
}
