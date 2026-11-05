import { describe, expect, it } from 'vitest';
import {
  ApiShapeError,
  asRecord,
  countOrNull,
  flagOrFalse,
  humanize,
  optionalDate,
  optionalString,
  requiredCount,
  requiredDate,
  requiredString,
} from '../row-fields';

describe('row-fields', () => {
  it('reads a required string and refuses a missing, empty or non-string one instead of inventing a value', () => {
    expect(requiredString({ status: 'reported' }, 'status')).toBe('reported');
    for (const row of [{}, { status: '' }, { status: 4 }, { status: null }]) {
      expect(() => requiredString(row, 'status')).toThrow(ApiShapeError);
    }
  });

  it('reads an optional text column as null when it holds nothing', () => {
    expect(optionalString({ name: 'Ada' }, 'name')).toBe('Ada');
    for (const row of [{}, { name: '' }, { name: null }, { name: 3 }]) expect(optionalString(row, 'name')).toBeNull();
  });

  it('reads a required date and refuses one that is missing or not a date, never defaulting to now', () => {
    expect(requiredDate({ at: '2026-03-04T10:00:00.000Z' }, 'at').toISOString()).toBe('2026-03-04T10:00:00.000Z');
    expect(requiredDate({ at: 0 }, 'at').getTime()).toBe(0);
    for (const row of [{}, { at: null }, { at: 'tomorrow-ish' }, { at: {} }]) expect(() => requiredDate(row, 'at')).toThrow(ApiShapeError);
  });

  it('reads an optional date as null when the column holds nothing, and refuses a value that is not a time', () => {
    expect(optionalDate({ at: null }, 'at')).toBeNull();
    expect(optionalDate({}, 'at')).toBeNull();
    expect(optionalDate({ at: '2026-03-04T10:00:00.000Z' }, 'at')?.toISOString()).toBe('2026-03-04T10:00:00.000Z');
    for (const row of [{ at: 'tomorrow-ish' }, { at: {} }, { at: '' }]) expect(() => optionalDate(row, 'at')).toThrow(ApiShapeError);
  });

  it('reads a count and refuses anything that is not a finite number', () => {
    expect(requiredCount({ total: 0 }, 'total')).toBe(0);
    for (const row of [{}, { total: '3' }, { total: null }, { total: Number.NaN }]) expect(() => requiredCount(row, 'total')).toThrow(ApiShapeError);
  });

  it('keeps an unknown figure null, and refuses a figure that is neither null nor a number', () => {
    expect(countOrNull({ rate: null }, 'rate')).toBeNull();
    expect(countOrNull({ rate: 0 }, 'rate')).toBe(0);
    expect(countOrNull({ rate: 61.5 }, 'rate')).toBe(61.5);
    for (const row of [{}, { rate: '61' }]) expect(() => countOrNull(row, 'rate')).toThrow(ApiShapeError);
  });

  it('reads a nullable yes/no column: no recorded answer is "no", and anything that is not a boolean is refused', () => {
    expect(flagOrFalse({ wide: true }, 'wide')).toBe(true);
    expect(flagOrFalse({ wide: false }, 'wide')).toBe(false);
    for (const row of [{}, { wide: null }]) expect(flagOrFalse(row, 'wide')).toBe(false);
    for (const row of [{ wide: 'true' }, { wide: 1 }]) expect(() => flagOrFalse(row, 'wide')).toThrow(ApiShapeError);
  });

  it('refuses a value that is not a record', () => {
    expect(asRecord({ a: 1 }, 'row')).toEqual({ a: 1 });
    for (const value of [null, 'x', 3, []]) expect(() => asRecord(value, 'row')).toThrow(ApiShapeError);
  });

  it('shows a stored code as words', () => {
    expect(humanize('under_review')).toBe('under review');
    expect(humanize('near_miss')).toBe('near miss');
  });
});
