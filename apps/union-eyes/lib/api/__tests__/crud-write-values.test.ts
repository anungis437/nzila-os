import { describe, expect, it } from 'vitest';
import { boolean, date, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { ApiError, ErrorCode } from '../errors';
import { normalizeWriteValues, parseIsoInstant, propertyOfColumn } from '../crud-write-values';

const mood = pgEnum('crud_write_values_mood', ['calm', 'agitated']);
const things = pgTable('crud_write_values_things', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id'),
  happenedAt: timestamp('happened_at', { withTimezone: true }),
  happenedOn: date('happened_on'),
  stampedAt: timestamp('stamped_at', { mode: 'string' }),
  mood: mood('mood'),
  rank: text('rank', { enum: ['low', 'high'] }),
  title: varchar('title', { length: 20 }),
  count: integer('count'),
  active: boolean('active'),
});

const refusal = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('expected the value to be refused');
};

describe('parseIsoInstant', () => {
  it('reads a date, a date-time and an offset as the instant they name, with no zone meaning UTC', () => {
    expect(parseIsoInstant('2026-01-15')?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(parseIsoInstant('2026-01-15T10:30:00Z')?.toISOString()).toBe('2026-01-15T10:30:00.000Z');
    expect(parseIsoInstant('2026-01-15T10:30:00')?.toISOString()).toBe('2026-01-15T10:30:00.000Z');
    expect(parseIsoInstant('2026-01-15 10:30')?.toISOString()).toBe('2026-01-15T10:30:00.000Z');
    expect(parseIsoInstant('2026-01-15T10:30:00.123456Z')?.toISOString()).toBe('2026-01-15T10:30:00.123Z');
    expect(parseIsoInstant('2026-01-15T10:30:00-05:00')?.toISOString()).toBe('2026-01-15T15:30:00.000Z');
    expect(parseIsoInstant('2026-01-15T10:30:00+0530')?.toISOString()).toBe('2026-01-15T05:00:00.000Z');
    expect(parseIsoInstant('2026-01-15T10:30:00+02')?.toISOString()).toBe('2026-01-15T08:30:00.000Z');
    expect(parseIsoInstant('0099-03-01')?.getUTCFullYear()).toBe(99);
  });

  it('refuses text that is not an ISO 8601 date or names a day or time that does not exist', () => {
    for (const text of ['', 'not-a-date', '2026', '2026-1-5', 'March 5, 2026', '2026-13-01', '2026-00-10', '2026-04-31', '2026-02-29', '2100-02-29', '2026-01-15T24:00:00Z', '2026-01-15T10:60:00Z', '2026-01-15T10:30:60Z', '2026-01-15T10:30:00+24:00', '2026-01-15T10:30:00+05:60', '2026-01-15T10:30:00 PST', '2026-01-15T']) {
      expect(parseIsoInstant(text), text).toBeNull();
    }
  });

  it('accepts the days a calendar has, including the leap day', () => {
    expect(parseIsoInstant('2024-02-29')?.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(parseIsoInstant('2000-02-29')?.toISOString()).toBe('2000-02-29T00:00:00.000Z');
    expect(parseIsoInstant('2026-04-30')?.toISOString()).toBe('2026-04-30T00:00:00.000Z');
    expect(parseIsoInstant('2026-12-31T23:59:59Z')?.toISOString()).toBe('2026-12-31T23:59:59.000Z');
  });
});

describe('normalizeWriteValues', () => {
  it('turns ISO text into a Date for a column that maps a Date, so the driver no longer sees text it cannot serialize', () => {
    const shaped = normalizeWriteValues({ happenedAt: '2026-01-15T10:30:00.000Z', happenedOn: '2026-04-02' }, things);
    expect(shaped.happenedAt).toEqual(new Date('2026-01-15T10:30:00.000Z'));
    expect(typeof shaped.happenedOn).toBe('string');
  });

  it('keeps a Date it was given, and checks and keeps the text of a string-mode column', () => {
    const when = new Date('2026-02-01T00:00:00Z');
    expect(normalizeWriteValues({ happenedAt: when }, things).happenedAt).toBe(when);
    expect(normalizeWriteValues({ stampedAt: '2026-02-01T12:00:00' }, things).stampedAt).toBe('2026-02-01T12:00:00');
    expect(refusal(() => normalizeWriteValues({ stampedAt: 'tomorrow' }, things)).message).toContain('stampedAt');
  });

  it('names the field when a date, a timestamp, a uuid or an enum member is malformed', () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ happenedAt: 'not-a-date' }, 'happenedAt must be an ISO 8601'],
      [{ happenedAt: 1768473000000 }, 'happenedAt must be an ISO 8601'],
      [{ happenedAt: new Date('nope') }, 'happenedAt must be an ISO 8601'],
      [{ happenedOn: '2026-02-31' }, 'happenedOn must be an ISO 8601'],
      [{ ownerId: 'not-a-uuid' }, 'ownerId must be a UUID'],
      [{ ownerId: 42 }, 'ownerId must be a UUID'],
      [{ mood: 'furious' }, 'mood must be one of: calm, agitated'],
      [{ mood: 3 }, 'mood must be one of: calm, agitated'],
      [{ rank: 'middle' }, 'rank must be one of: low, high'],
    ];
    for (const [values, message] of cases) {
      const error = refusal(() => normalizeWriteValues(values, things));
      expect(error, JSON.stringify(values)).toBeInstanceOf(ApiError);
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.message).toContain(message);
    }
  });

  it('accepts a well-formed uuid, enum member and null, and leaves every other column to the database', () => {
    const values = { ownerId: '8d0f6c5e-3f43-4a35-9d0b-6a8b2f1c7e11', mood: 'calm', rank: 'high', happenedAt: null, happenedOn: null, title: 'x'.repeat(500), count: 'abc', active: 'maybe' };
    expect(normalizeWriteValues(values, things)).toEqual(values);
  });

  it('ignores a field the table does not have, absent values and a table of plain columns', () => {
    expect(normalizeWriteValues({ nothing: 'x', happenedAt: undefined }, things)).toEqual({ nothing: 'x', happenedAt: undefined });
    const plain = { id: 'id', title: 'title' } as never;
    expect(normalizeWriteValues({ id: 'x', title: 'y' }, plain)).toEqual({ id: 'x', title: 'y' });
  });

  it('does not change the values it was given', () => {
    const values = { happenedAt: '2026-01-15T10:30:00Z' };
    normalizeWriteValues(values, things);
    expect(values.happenedAt).toBe('2026-01-15T10:30:00Z');
  });
});

describe('propertyOfColumn', () => {
  it('names the property a client sends for a database column', () => {
    expect(propertyOfColumn(things, 'owner_id')).toBe('ownerId');
    expect(propertyOfColumn(things, 'happened_at')).toBe('happenedAt');
    expect(propertyOfColumn(things, 'no_such_column')).toBeUndefined();
  });
});
