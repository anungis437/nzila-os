import { describe, it, expect } from 'vitest';
import { locales, defaultLocale, formattingLocale } from '../locales';

describe('lib/locales', () => {
  it('exposes the supported locales tuple', () => {
    expect(locales).toEqual(['en-CA', 'fr-CA', 'it', 'pt']);
  });

  it('defaults to en-CA', () => {
    expect(defaultLocale).toBe('en-CA');
    expect(locales).toContain(defaultLocale);
  });
});

describe('formattingLocale', () => {
  it('passes the application locales through', () => {
    expect(formattingLocale('en-CA')).toBe('en-CA');
    expect(formattingLocale('fr-CA')).toBe('fr-CA');
    expect(formattingLocale('it')).toBe('it');
    expect(formattingLocale('pt')).toBe('pt');
  });

  it('reads stored language values by their language', () => {
    expect(formattingLocale('fr')).toBe('fr-CA');
    expect(formattingLocale('FR_ca')).toBe('fr-CA');
    expect(formattingLocale('fr-FR')).toBe('fr-CA');
    expect(formattingLocale('en')).toBe('en-CA');
    expect(formattingLocale('en-US')).toBe('en-CA');
  });

  it('formats unknown or missing values as en-CA', () => {
    expect(formattingLocale(undefined)).toBe('en-CA');
    expect(formattingLocale(null)).toBe('en-CA');
    expect(formattingLocale('')).toBe('en-CA');
    expect(formattingLocale('de')).toBe('en-CA');
  });

  it('keeps US English for English readers when asked, and only for them', () => {
    expect(formattingLocale('en-CA', 'en-US')).toBe('en-US');
    expect(formattingLocale(null, 'en-US')).toBe('en-US');
    expect(formattingLocale('fr-CA', 'en-US')).toBe('fr-CA');
  });

  it('gives French readers French dates and money', () => {
    const day = new Date(Date.UTC(2026, 2, 4, 12));
    expect(day.toLocaleDateString(formattingLocale('fr'), { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })).toBe('4 mars 2026');
    expect(new Intl.NumberFormat(formattingLocale('fr-CA'), { style: 'currency', currency: 'CAD' }).format(1234.5)).toBe('1 234,50 $');
  });
});
