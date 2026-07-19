import { describe, expect, it } from 'vitest';

import {
  assertSafeDeterministicText,
  assertSupportedLocale,
  stableDeterministicId,
} from '../deterministicReportGuardrails';

describe('lib/icra/adaptation/deterministicReportGuardrails', () => {
  describe('assertSupportedLocale', () => {
    it('accepts supported locales', () => {
      expect(() => assertSupportedLocale('en-CA')).not.toThrow();
      expect(() => assertSupportedLocale('fr-CA')).not.toThrow();
    });

    it('throws for unsupported locales', () => {
      expect(() => assertSupportedLocale('es-MX')).toThrow(/Unsupported locale/);
    });
  });

  describe('assertSafeDeterministicText', () => {
    it('passes for clean text', () => {
      expect(() => assertSafeDeterministicText('A plain sentence.', 'summary')).not.toThrow();
    });

    it('throws on empty/whitespace text', () => {
      expect(() => assertSafeDeterministicText('   ', 'summary')).toThrow(/must not be empty/);
    });

    it('throws on email-like content', () => {
      expect(() => assertSafeDeterministicText('reach me at a@b.com', 'summary')).toThrow(/email-like/);
    });

    it('throws on URL-like content', () => {
      expect(() => assertSafeDeterministicText('see https://example.com', 'summary')).toThrow(/URL-like/);
    });
  });

  describe('stableDeterministicId', () => {
    it('is deterministic for identical inputs', () => {
      const a = stableDeterministicId('rep', ['x', 'y']);
      const b = stableDeterministicId('rep', ['x', 'y']);
      expect(a).toBe(b);
      expect(a).toMatch(/^rep-[0-9a-f]{8}$/);
    });

    it('differs for different inputs', () => {
      expect(stableDeterministicId('rep', ['x'])).not.toBe(stableDeterministicId('rep', ['y']));
    });
  });
});
