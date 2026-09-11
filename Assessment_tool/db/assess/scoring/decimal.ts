/**
 * Minimal exact-decimal arithmetic for marks (R-11: NUMERIC only, never
 * floating point). Every value in and out of this module is a base-10
 * decimal string ("4", "-1.00", "0.5"). Internally each value is converted
 * to a BigInt scaled by 10^SCALE, arithmetic runs entirely in BigInt space,
 * and the result is formatted back to a decimal string.
 *
 * No third-party decimal library is introduced for this (R-12) — the
 * operations scoring needs (add, compare, tolerance checks, proportional
 * partial credit) are narrow enough that this is easier to audit than a new
 * dependency would be to justify.
 */

const SCALE = 9;
const SCALE_FACTOR = 10n ** BigInt(SCALE);

function toScaled(value: string): bigint {
  const trimmed = value.trim();
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [intPart, fracPart = ""] = unsigned.split(".");
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracPart) || (intPart === "" && fracPart === "")) {
    throw new Error(`decimal.ts: not a valid decimal string: "${value}"`);
  }
  const fracPadded = (fracPart + "0".repeat(SCALE)).slice(0, SCALE);
  const scaled = BigInt(intPart || "0") * SCALE_FACTOR + BigInt(fracPadded || "0");
  return negative ? -scaled : scaled;
}

function fromScaled(scaled: bigint): string {
  const negative = scaled < 0n;
  const magnitude = negative ? -scaled : scaled;
  const intPart = magnitude / SCALE_FACTOR;
  const fracPart = magnitude % SCALE_FACTOR;
  const fracStr = fracPart.toString().padStart(SCALE, "0").replace(/0+$/, "");
  const sign = negative && (intPart !== 0n || fracPart !== 0n) ? "-" : "";
  return fracStr ? `${sign}${intPart}.${fracStr}` : `${sign}${intPart}`;
}

export function add(...values: string[]): string {
  return fromScaled(values.reduce((total, v) => total + toScaled(v), 0n));
}

export function subtract(a: string, b: string): string {
  return fromScaled(toScaled(a) - toScaled(b));
}

export function multiply(a: string, b: string): string {
  return fromScaled((toScaled(a) * toScaled(b)) / SCALE_FACTOR);
}

export function divide(a: string, b: string): string {
  const bScaled = toScaled(b);
  if (bScaled === 0n) {
    throw new Error("decimal.ts: division by zero");
  }
  return fromScaled((toScaled(a) * SCALE_FACTOR) / bScaled);
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  const diff = toScaled(a) - toScaled(b);
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}

export function abs(a: string): string {
  const scaled = toScaled(a);
  return fromScaled(scaled < 0n ? -scaled : scaled);
}

export function isZeroOrNegative(a: string): boolean {
  return toScaled(a) <= 0n;
}

export function clampMin(a: string, min: string): string {
  return compare(a, min) < 0 ? min : a;
}

export function sum(values: string[]): string {
  return values.length === 0 ? "0" : add(...values);
}
