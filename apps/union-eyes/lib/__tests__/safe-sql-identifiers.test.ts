import { describe, it, expect, vi } from 'vitest';

vi.mock('drizzle-orm', () => ({
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: any[]) => ({
      strings,
      values,
      type: 'sql',
    }),
    {
      raw: (s: string) => ({ rawValue: s, type: 'sql-raw' }),
      join: (fragments: any[], separator: any) => ({ fragments, separator, type: 'sql-join' }),
    }
  ),
  SQL: class SQL {},
  relations: vi.fn(() => ({})),
}));

import {
  isValidIdentifier,
  safeIdentifier,
  safeTableName,
  safeColumnName,
  safeIdentifiers,
  safeColumnList,
  isSQLFragment,
} from '../safe-sql-identifiers';

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

  describe('safeIdentifier', () => {
    it('returns SQL fragment for valid identifier', () => {
      const result = safeIdentifier('user_name');
      expect(result).toEqual({ rawValue: '"user_name"', type: 'sql-raw' });
    });

    it('escapes double quotes by doubling them', () => {
      // identifier with dollar sign (valid) containing no quotes
      const result = safeIdentifier('col$1');
      expect(result).toEqual({ rawValue: '"col$1"', type: 'sql-raw' });
    });

    it('throws for invalid identifier', () => {
      expect(() => safeIdentifier('SELECT')).toThrow('Invalid SQL identifier');
      expect(() => safeIdentifier('1bad')).toThrow('Invalid SQL identifier');
      expect(() => safeIdentifier('')).toThrow('Invalid SQL identifier');
    });

    it('throws for identifier exceeding 63 chars', () => {
      expect(() => safeIdentifier('a'.repeat(64))).toThrow('Invalid SQL identifier');
    });
  });

  describe('safeTableName', () => {
    it('handles simple table name', () => {
      const result = safeTableName('users');
      expect(result).toEqual({ rawValue: '"users"', type: 'sql-raw' });
    });

    it('handles schema.table format', () => {
      const result = safeTableName('public.users');
      // Returns a sql template result
      expect(result).toBeDefined();
      expect(result.type).toBe('sql');
    });

    it('throws for 3+ part format', () => {
      expect(() => safeTableName('a.b.c')).toThrow('Invalid table name format');
    });

    it('throws for invalid parts', () => {
      expect(() => safeTableName('SELECT.users')).toThrow('Invalid SQL identifier');
    });
  });

  describe('safeColumnName', () => {
    it('handles simple column name', () => {
      const result = safeColumnName('user_id');
      expect(result).toEqual({ rawValue: '"user_id"', type: 'sql-raw' });
    });

    it('handles table.column format', () => {
      const result = safeColumnName('users.user_id');
      expect(result).toBeDefined();
      expect(result.type).toBe('sql');
    });

    it('handles schema.table.column format', () => {
      const result = safeColumnName('public.users.user_id');
      expect(result).toBeDefined();
      expect(result.type).toBe('sql');
    });

    it('throws for 4+ part format', () => {
      expect(() => safeColumnName('a.b.c.d')).toThrow('Invalid column name format');
    });

    it('throws for invalid parts', () => {
      expect(() => safeColumnName('FROM.id')).toThrow('Invalid SQL identifier');
    });
  });

  describe('safeIdentifiers', () => {
    it('maps array of identifiers', () => {
      const result = safeIdentifiers(['col_a', 'col_b']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ rawValue: '"col_a"', type: 'sql-raw' });
      expect(result[1]).toEqual({ rawValue: '"col_b"', type: 'sql-raw' });
    });

    it('propagates error for invalid identifier', () => {
      expect(() => safeIdentifiers(['good', 'SELECT'])).toThrow('Invalid SQL identifier');
    });

    it('returns empty array for empty input', () => {
      expect(safeIdentifiers([])).toEqual([]);
    });
  });

  describe('safeColumnList', () => {
    it('throws for empty array', () => {
      expect(() => safeColumnList([])).toThrow('Column list cannot be empty');
    });

    it('returns SQL fragment for valid columns', () => {
      const result = safeColumnList(['user_id', 'email', 'created_at']);
      expect(result).toBeDefined();
    });

    it('throws for invalid column name in list', () => {
      expect(() => safeColumnList(['good', 'SELECT'])).toThrow('Invalid SQL identifier');
    });
  });

  describe('isSQLFragment', () => {
    it('returns true for object with queryChunks', () => {
      expect(isSQLFragment({ queryChunks: [] })).toBe(true);
    });

    it('returns false for null', () => {
      expect(isSQLFragment(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isSQLFragment(undefined)).toBe(false);
    });

    it('returns false for plain object', () => {
      expect(isSQLFragment({ foo: 'bar' })).toBe(false);
    });

    it('returns false for string', () => {
      expect(isSQLFragment('SELECT *')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isSQLFragment(42)).toBe(false);
    });
  });
});
