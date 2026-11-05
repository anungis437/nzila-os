/**
 * Reads the fields of a record a route sent, for browser code.
 *
 * A column the database never leaves empty that is missing from a record means the response is not what the route promises: it is an error
 * for the screen to report, not a record to complete. Nothing here invents a value (no empty string, no "today", no default status) to
 * make a malformed record look complete, and a nullable column that holds nothing is null, never a placeholder.
 */
import { ApiShapeError, isRecord } from "./api-envelope";

export { ApiShapeError, isRecord };

export function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ApiShapeError(`${what} is not a record`);
  return value;
}

export function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value === "") throw new ApiShapeError(`${key} is missing`);
  return value;
}

/** A nullable text column: null when the record has none. */
export function optionalString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value !== "" ? value : null;
}

export function requiredDate(row: Record<string, unknown>, key: string): Date {
  const value = row[key];
  const date = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  if (date === null || Number.isNaN(date.getTime())) throw new ApiShapeError(`${key} is not a date`);
  return date;
}

/** A nullable timestamp column: null when the record has none, an error when it holds something that is not a time. */
export function optionalDate(row: Record<string, unknown>, key: string): Date | null {
  return row[key] === null || row[key] === undefined ? null : requiredDate(row, key);
}

export function requiredCount(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiShapeError(`${key} is not a number`);
  return value;
}

/** A figure the route could not compute is null, and stays null: it is not zero. */
export function countOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ApiShapeError(`${key} is not a number`);
  return value;
}

/** A nullable yes/no column. No recorded answer is "no": the column's own default is false, and a screen never guesses "yes". */
export function flagOrFalse(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (value === null || value === undefined) return false;
  if (typeof value !== "boolean") throw new ApiShapeError(`${key} is not a boolean`);
  return value;
}

/** A stored code (`under_review`, `near_miss`) as words, for display. */
export function humanize(code: string): string {
  return code.replace(/_/g, " ");
}
