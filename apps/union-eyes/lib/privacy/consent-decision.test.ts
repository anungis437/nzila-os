// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { hasStoredConsentDecision } from './consent-decision';

beforeEach(() => localStorage.clear());
describe('privacy decision precedes optional guidance', () => {
  it('does not infer acceptance from missing, malformed or incomplete storage', () => {
    expect(hasStoredConsentDecision()).toBe(false);
    localStorage.setItem('cookie_consent_id', 'owned-test');
    localStorage.setItem('cookie_consent', '{');
    expect(hasStoredConsentDecision()).toBe(false);
    localStorage.setItem('cookie_consent', JSON.stringify({ preferences: { essential: true } }));
    expect(hasStoredConsentDecision()).toBe(false);
  });
  it('accepts an explicit rejection of optional cookies without changing it', () => {
    const saved = JSON.stringify({ expiresAt: new Date(Date.now() + 60000).toISOString(),
      preferences: { essential: true, functional: false, analytics: false, marketing: false } });
    localStorage.setItem('cookie_consent_id', 'owned-test');
    localStorage.setItem('cookie_consent', saved);
    expect(hasStoredConsentDecision()).toBe(true);
    expect(localStorage.getItem('cookie_consent')).toBe(saved);
  });
  it('requires a new decision when the previous one expires', () => {
    localStorage.setItem('cookie_consent_id', 'owned-test');
    localStorage.setItem('cookie_consent', JSON.stringify({ expiresAt: '2000-01-01',
      preferences: { essential: true, functional: true, analytics: true, marketing: true } }));
    expect(hasStoredConsentDecision()).toBe(false);
  });
});
