import { describe, it, expect, vi } from 'vitest';

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
      type: 'sql',
    }),
    { raw: (s: string) => ({ rawValue: s, type: 'sql-raw' }) }
  ),
  SQL: class SQL {},
  relations: vi.fn(() => ({})),
}));

import { isValidIdentifier } from '../safe-sql-identifiers';

describe('safe-sql-identifiers', () => {
  describe('isValidIdentifier', () => {
    it('accepts valid identifier', () => {
      expect(isValidIdentifier('user_name')).toBe(true);
    });

    it('accepts identifier starting with underscore', () => {
      expect(isValidIdentifier('_id')).toBe(true);
    });

    it('accepts identifier with dollar sign', () => {
      expect(isValidIdentifier('col$1')).toBe(true);
    });

    it('rejects empty string', () => {
      expect(isValidIdentifier('')).toBe(false);
    });

    it('rejects identifier starting with digit', () => {
      expect(isValidIdentifier('1col')).toBe(false);
    });

    it('rejects identifier longer than 63 chars', () => {
      expect(isValidIdentifier('a'.repeat(64))).toBe(false);
    });

    it('rejects SQL reserved keywords', () => {
      expect(isValidIdentifier('SELECT')).toBe(false);
      expect(isValidIdentifier('from')).toBe(false);
      expect(isValidIdentifier('WHERE')).toBe(false);
    });

    it('rejects identifiers with special characters', () => {
      expect(isValidIdentifier('user-name')).toBe(false);
      expect(isValidIdentifier('user name')).toBe(false);
    });
  });
});
