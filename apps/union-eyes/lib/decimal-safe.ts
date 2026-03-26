/**
 * Cents-safe decimal math for monetary values.
 * Converts to integer cents for arithmetic, avoiding floating-point rounding errors.
 * All "money" functions accept string | number | null | undefined and return "X.XX" strings.
 */

/** Convert a monetary value to integer cents. */
export function toCents(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  return Math.round(Number(value) * 100);
}

/** Convert integer cents back to a decimal string "X.XX". */
export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Safely parse a value to a "X.XX" monetary string. */
export function parseMoney(value: string | number | null | undefined): string {
  return fromCents(toCents(value));
}

/** Add two monetary values → "X.XX". */
export function addMoney(a: string | number | null | undefined, b: string | number | null | undefined): string {
  return fromCents(toCents(a) + toCents(b));
}

/** Subtract b from a → "X.XX". */
export function subtractMoney(a: string | number | null | undefined, b: string | number | null | undefined): string {
  return fromCents(toCents(a) - toCents(b));
}

/** Multiply a monetary amount by a rate/factor → "X.XX" (rounds to cents). */
export function multiplyMoney(amount: string | number, factor: number): string {
  return (Math.round(Number(amount) * factor * 100) / 100).toFixed(2);
}

/** Divide two monetary values → result as number (for ratios). Returns 0 if denominator is 0. */
export function divideMoney(numerator: string | number, denominator: string | number): number {
  const d = Number(denominator);
  if (d === 0) return 0;
  return Number(numerator) / d;
}

/** Negate a monetary value → "X.XX". */
export function negateMoney(value: string | number | null | undefined): string {
  return fromCents(-toCents(value));
}

/** Absolute value of a monetary amount → "X.XX". */
export function absMoney(value: string | number | null | undefined): string {
  return fromCents(Math.abs(toCents(value)));
}

/** Compare two monetary values → negative if a < b, 0 if equal, positive if a > b. */
export function compareMoney(a: string | number, b: string | number): number {
  return toCents(a) - toCents(b);
}

/** Sum an array of monetary values → "X.XX". */
export function sumMoney(values: (string | number | null | undefined)[]): string {
  const totalCents = values.reduce<number>((sum, v) => sum + toCents(v), 0);
  return fromCents(totalCents);
}

/** Convert monetary value to number with cents precision (for interfaces that require number). */
export function moneyToNumber(value: string | number | null | undefined): number {
  return toCents(value) / 100;
}
