import { describe, expect, it } from 'vitest';
import { localizedAuthEntryPath, preferredLocale } from './locales';

describe('preferredLocale', () => {
  it('follows the NEXT_LOCALE cookie over the browser language', () => {
    expect(preferredLocale('a=b; NEXT_LOCALE=fr-CA', 'en-CA,en;q=0.9')).toBe('fr-CA');
    expect(preferredLocale('NEXT_LOCALE=en-CA', 'fr-CA')).toBe('en-CA');
  });
  it('falls back to the browser language, then to the default', () => {
    expect(preferredLocale(null, 'fr-CA,fr;q=0.9')).toBe('fr-CA');
    expect(preferredLocale('', 'de-DE')).toBe('en-CA');
    expect(preferredLocale(undefined, undefined)).toBe('en-CA');
  });
});

describe('localizedAuthEntryPath', () => {
  it('names the entry pages that have a locale twin and nothing else', () => {
    expect(localizedAuthEntryPath('/login')).toBe('/login');
    expect(localizedAuthEntryPath('/signup/')).toBe('/signup');
    expect(localizedAuthEntryPath('/sign-up')).toBe('/sign-up');
    expect(localizedAuthEntryPath('/forgot-password')).toBeNull();
    expect(localizedAuthEntryPath('/login-help')).toBeNull();
    expect(localizedAuthEntryPath('/en-CA/login')).toBeNull();
  });
});
