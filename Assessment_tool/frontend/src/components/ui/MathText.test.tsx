import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MathText from "./MathText";

// docs/latex-rendering-fix-prompt.md — the app had no math rendering at all,
// so every one of these used to come out as the literal source characters.
// The regression that matters most is the last block: the ~1000 clean
// Botany/Zoology questions must still render as one untouched text node.

function renderMath(text: string | null | undefined) {
  const { container } = render(<MathText>{text}</MathText>);
  return container;
}

describe("MathText", () => {
  it("renders a real <sup> node for a braced exponent, not literal text", () => {
    const container = renderMath("3.9 * 10^{15}");
    const sup = container.querySelector("sup");
    expect(sup).not.toBeNull();
    expect(sup?.textContent).toBe("15");
    expect(container.textContent).not.toContain("^{15}");
    expect(container.textContent).not.toContain("{");
  });

  it("renders an unbraced digit run as a single superscript", () => {
    const container = renderMath("10^15");
    expect(container.querySelector("sup")?.textContent).toBe("15");
  });

  it("renders a braced subscript as a real <sub> node", () => {
    const container = renderMath("Rate = P * Z_{AB}");
    const sub = container.querySelector("sub");
    expect(sub?.textContent).toBe("AB");
    expect(container.textContent).toBe("Rate = P * ZAB");
  });

  it("nests a subscript inside a superscript", () => {
    const container = renderMath("e^{-E_a / RT}");
    const sup = container.querySelector("sup");
    expect(sup).not.toBeNull();
    expect(sup?.querySelector("sub")?.textContent).toBe("a");
  });

  it("keeps a single-character script bare (ion charges, squares)", () => {
    const container = renderMath("Cl^- and x^2");
    const sups = container.querySelectorAll("sup");
    expect(Array.from(sups).map((s) => s.textContent)).toEqual(["-", "2"]);
  });

  it("renders chemical formulae with real subscripts and ion charges", () => {
    const container = renderMath("Cu^{2+}(aq) + H_2O and C_6H_{12}O_6 and NH_4^+");
    expect(Array.from(container.querySelectorAll("sub")).map((s) => s.textContent)).toEqual(["2", "6", "12", "6", "4"]);
    expect(Array.from(container.querySelectorAll("sup")).map((s) => s.textContent)).toEqual(["2+", "+"]);
    expect(container.textContent).toBe("Cu2+(aq) + H2O and C6H12O6 and NH4+");
  });

  it("never swallows a bond hyphen or a hydrate dot into a subscript", () => {
    const hyphen = renderMath("CH_3-CH=NH");
    expect(hyphen.querySelector("sub")?.textContent).toBe("3");
    expect(hyphen.textContent).toBe("CH3-CH=NH");

    const hydrate = renderMath("CuSO_4.5H_2O");
    expect(Array.from(hydrate.querySelectorAll("sub")).map((s) => s.textContent)).toEqual(["4", "2"]);
  });

  it("keeps a hyphen after an unbraced exponent as a hyphen", () => {
    const container = renderMath("an sp^2-hybridized carbon and SO4^2- ions");
    expect(Array.from(container.querySelectorAll("sup")).map((s) => s.textContent)).toEqual(["2", "2-"]);
    expect(container.textContent).toBe("an sp2-hybridized carbon and SO42- ions");
  });

  it("hands a genuine LaTeX command to KaTeX", () => {
    const container = renderMath("\\sqrt{6} * (h / (2 \\pi))");
    expect(container.querySelector(".katex")).not.toBeNull();

    // What the student actually sees is .katex-html; the sibling
    // .katex-mathml keeps the original TeX in an <annotation> on purpose (screen
    // readers and copy-paste), so assert on the visual half only.
    const visible = Array.from(container.querySelectorAll(".katex-html"))
      .map((el) => el.textContent)
      .join(" ");
    expect(visible).not.toContain("\\sqrt");
    expect(visible).not.toContain("\\pi");
    expect(visible).toContain("6");
    expect(visible).toContain("π");
  });

  it("renders math inside Tamil prose the same way as English", () => {
    const container = renderMath("மோதல் கொள்கையில், Rate = P * Z_{AB} * e^{-Ea / RT} என்ற");
    expect(container.querySelector("sub")?.textContent).toBe("AB");
    expect(container.querySelector("sup")?.textContent).toBe("-Ea / RT");
    expect(container.textContent).toContain("மோதல் கொள்கையில்");
  });

  it("still strips template artifacts, as displayQuestionText did", () => {
    const container = renderMath("What is the SI unit of force? (Case 12)");
    expect(container.textContent).toBe("What is the SI unit of force?");
  });

  it("leaves plain text with no math markup byte-for-byte unchanged", () => {
    const plain =
      "In dicot stems, what is the origin and function of the intra-fascicular cambium and inter-fascicular cambium during secondary growth?";
    const container = renderMath(plain);
    expect(container.textContent).toBe(plain);
    expect(container.querySelector("sup")).toBeNull();
    expect(container.querySelector("sub")).toBeNull();
    expect(container.querySelector(".katex")).toBeNull();
  });

  it("renders nothing for null/empty input", () => {
    expect(renderMath(null).textContent).toBe("");
    expect(renderMath("").textContent).toBe("");
  });
});
