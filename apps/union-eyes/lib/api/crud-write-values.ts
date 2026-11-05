import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { ApiError } from './errors';

/**
 * What a generic write may carry into a column, checked and shaped just before it is written.
 *
 * A JSON client sends every date and timestamp as text, but Drizzle's default `timestamp` and `date` columns map a value to the driver
 * with `value.toISOString()`. A string therefore reached PostgreSQL as a TypeError (an HTTP 500), and a table with a required timestamp
 * (a right-of-refusal event's refusal date) could never be created through its route. Here ISO 8601 text becomes a Date for a column that takes
 * one, and is checked and kept as text for a column that takes text. A malformed uuid, a value outside an enum and a date that does not exist
 * are refused with a 400 that names the field, instead of reaching the database.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_8601 = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|z|[+-]\d{2}(?::?\d{2})?)?)?$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * An ISO 8601 calendar date or date-time as an instant, or null when the text is not one or names a day that does not exist (2026-02-31).
 * Text with no zone is read as UTC, so the same body stores the same instant wherever the server runs.
 */
export function parseIsoInstant(text: string): Date | null {
  const match = ISO_8601.exec(text.trim());
  if (!match) return null;
  const [, y, mo, d, hh = '00', mi = '00', ss = '00', fraction = '', zone = ''] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(hh);
  const minute = Number(mi);
  const second = Number(ss);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month) || hour > 23 || minute > 59 || second > 59) return null;
  let offsetMinutes = 0;
  if (zone && zone.toUpperCase() !== 'Z') {
    const digits = zone.slice(1).replace(':', '');
    const zoneHours = Number(digits.slice(0, 2));
    const zoneMinutes = digits.length > 2 ? Number(digits.slice(2)) : 0;
    if (zoneHours > 23 || zoneMinutes > 59) return null;
    offsetMinutes = (zone.startsWith('-') ? -1 : 1) * (zoneHours * 60 + zoneMinutes);
  }
  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, day);
  instant.setUTCHours(hour, minute, second, fraction ? Math.floor(Number(`0.${fraction}`) * 1000) : 0);
  instant.setTime(instant.getTime() - offsetMinutes * 60_000);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** The members of an enum-typed column, or undefined when the column is not one. */
function enumMembers(column: PgColumn): readonly string[] | undefined {
  const members = (column as unknown as { enumValues?: readonly string[] }).enumValues;
  return Array.isArray(members) && members.length > 0 ? members : undefined;
}

const instantOf = (field: string, value: unknown): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = typeof value === 'string' ? parseIsoInstant(value) : null;
  if (!parsed) throw ApiError.badRequest(`${field} must be an ISO 8601 date or date-time`, { field });
  return parsed;
};

/**
 * Returns the values with each field shaped for its column, or throws a 400 naming the first field that cannot be. Absent and null values are left
 * for the database to judge (a required column answers as a missing field through the database error mapping).
 */
export function normalizeWriteValues(values: Record<string, unknown>, table: PgTable): Record<string, unknown> {
  const shaped: Record<string, unknown> = { ...values };
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    const column = (table as unknown as Record<string, PgColumn | undefined>)[field];
    if (!column) continue;
    const members = enumMembers(column);
    if (members) {
      if (typeof value !== 'string' || !members.includes(value)) throw ApiError.badRequest(`${field} must be one of: ${members.join(', ')}`, { field });
      continue;
    }
    switch ((column as unknown as { columnType?: string }).columnType) {
      case 'PgUUID':
        if (typeof value !== 'string' || !UUID.test(value)) throw ApiError.badRequest(`${field} must be a UUID`, { field });
        break;
      case 'PgTimestamp':
      case 'PgDate':
        shaped[field] = instantOf(field, value);
        break;
      case 'PgTimestampString':
      case 'PgDateString':
        if (typeof value === 'string') instantOf(field, value);
        break;
      default:
        break;
    }
  }
  return shaped;
}

/** The property a client sends for a database column, so an error names the field it can act on rather than a column name. */
export function propertyOfColumn(table: PgTable, columnName: string): string | undefined {
  for (const [property, column] of Object.entries(table as unknown as Record<string, unknown>)) {
    if (column && typeof column === 'object' && (column as { name?: unknown }).name === columnName && 'columnType' in column) return property;
  }
  return undefined;
}
