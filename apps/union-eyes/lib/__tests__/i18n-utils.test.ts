import { describe, it, expect, vi } from 'vitest';

vi.mock('@/i18n', () => ({
  locales: ['en-CA', 'fr-CA'] as const,
}));

import {
  isValidLocale,
  getLocaleFromParams,
  formatDate,
  formatCurrency,
  formatNumber,
} from '../i18n-utils';

describe('i18n-utils', () => {
  describe('isValidLocale', () => {
    it('returns true for supported locales', () => {
      expect(isValidLocale('en-CA')).toBe(true);
      expect(isValidLocale('fr-CA')).toBe(true);
    });

    it('returns false for unsupported locale', () => {
      expect(isValidLocale('de-DE')).toBe(false);
    });
  });

  describe('getLocaleFromParams', () => {
    it('returns locale when valid', () => {
      expect(getLocaleFromParams({ locale: 'fr-CA' })).toBe('fr-CA');
    });

    it('defaults to en-CA for missing/invalid locale', () => {
      expect(getLocaleFromParams({})).toBe('en-CA');
      expect(getLocaleFromParams({ locale: 'zz-ZZ' })).toBe('en-CA');
    });
  });

  describe('formatDate', () => {
    it('formats date in en-CA locale', () => {
      const result = formatDate('2026-03-15T12:00:00Z', 'en-CA');
      expect(result).toContain('March');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });
  });

  describe('formatCurrency', () => {
    it('formats CAD by default', () => {
      const result = formatCurrency(100, 'en-CA');
      expect(result).toContain('100');
    });
  });

  describe('formatNumber', () => {
    it('formats number with locale', () => {
      const result = formatNumber(1234.5, 'en-CA');
      expect(result).toContain('1,234.5');
    });
  });
});
