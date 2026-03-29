import { describe, it, expect } from 'vitest';
import { cn, formatCurrency } from '../utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
    });

    it('resolves tailwind conflicts', () => {
      const result = cn('px-2', 'px-4');
      expect(result).toBe('px-4');
    });

    it('handles conditional classes', () => {
      const result = cn('base', false && 'hidden', 'extra');
      expect(result).toBe('base extra');
    });
  });

  describe('formatCurrency', () => {
    it('formats CAD by default', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('1,234.56');
    });

    it('accepts custom currency', () => {
      const result = formatCurrency(100, 'USD', 'en-US');
      expect(result).toContain('100.00');
    });
  });
});
