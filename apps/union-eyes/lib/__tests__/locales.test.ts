import { describe, it, expect } from 'vitest';
import { locales, defaultLocale } from '../locales';

describe('lib/locales', () => {
  it('exposes the supported locales tuple', () => {
    expect(locales).toEqual(['en-CA', 'fr-CA', 'it', 'pt']);
  });

  it('defaults to en-CA', () => {
    expect(defaultLocale).toBe('en-CA');
    expect(locales).toContain(defaultLocale);
  });
});
