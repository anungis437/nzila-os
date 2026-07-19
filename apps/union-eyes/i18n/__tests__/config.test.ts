import { describe, expect, it } from 'vitest';

import {
  defaultLocale,
  localeFallbacks,
  localeFlags,
  localeNames,
  locales,
  visibleLocales,
} from '../config';

describe('i18n/config', () => {
  it('declares the supported locales', () => {
    expect(locales).toEqual(['en-CA', 'fr-CA', 'it', 'pt']);
  });

  it('defaults to Canadian English', () => {
    expect(defaultLocale).toBe('en-CA');
    expect(locales).toContain(defaultLocale);
  });

  it('only surfaces translated locales in the public picker', () => {
    expect(visibleLocales).toEqual(['en-CA', 'fr-CA']);
    visibleLocales.forEach((locale) => expect(locales).toContain(locale));
  });

  it('provides a display name for every locale', () => {
    locales.forEach((locale) => {
      expect(localeNames[locale]).toBeTruthy();
    });
  });

  it('provides a flag for every locale', () => {
    locales.forEach((locale) => {
      expect(localeFlags[locale]).toBeTruthy();
    });
  });

  it('maps each locale to itself in the fallback table', () => {
    locales.forEach((locale) => {
      expect(localeFallbacks[locale]).toBe(locale);
    });
  });
});
