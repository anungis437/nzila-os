import { describe, expect, it } from 'vitest';

import {
  isKnownIdentityAlias,
  resolveLegacyDbTable,
  resolveLegacyEnv,
  resolveLegacyHubspotProperty,
  resolveLegacyRoute,
  resolveLegacyStripePriceKey,
} from '../compatibilityFallbacks';

describe('lib/runtime/identity/compatibilityFallbacks', () => {
  describe('resolveLegacyEnv', () => {
    it('prefers canonical when present', () => {
      expect(resolveLegacyEnv('OCRA_DATABASE_URL', { OCRA_DATABASE_URL: 'c', ICRA_DATABASE_URL: 'l' })).toBe('c');
    });
    it('falls back to legacy form', () => {
      expect(resolveLegacyEnv('OCRA_DATABASE_URL', { ICRA_DATABASE_URL: 'l' })).toBe('l');
    });
    it('returns undefined for unknown name', () => {
      expect(resolveLegacyEnv('OCRA_UNKNOWN', {})).toBeUndefined();
    });
  });

  describe('resolveLegacyRoute', () => {
    it('maps exact legacy route', () => {
      expect(resolveLegacyRoute('/api/icra/profile')).toBe('/api/ocra/profile');
    });
    it('maps nested route by prefix', () => {
      expect(resolveLegacyRoute('/api/icra/assessments/123')).toBe('/api/ocra/assessments/123');
    });
    it('returns unknown route unchanged', () => {
      expect(resolveLegacyRoute('/api/other')).toBe('/api/other');
    });
  });

  describe('resolveLegacyStripePriceKey / Hubspot / DbTable', () => {
    it('maps both legacy and canonical to canonical', () => {
      expect(resolveLegacyStripePriceKey('stripe_price_icra_pilot')).toBe('stripe_price_ocra_pilot');
      expect(resolveLegacyStripePriceKey('stripe_price_ocra_pilot')).toBe('stripe_price_ocra_pilot');
      expect(resolveLegacyStripePriceKey('unknown')).toBeUndefined();
      expect(resolveLegacyHubspotProperty('icra_composite_score')).toBe('ocra_composite_score');
      expect(resolveLegacyDbTable('icra_assessments')).toBe('ocra_assessments');
    });
  });

  describe('isKnownIdentityAlias', () => {
    it('recognizes known aliases and rejects unknown', () => {
      expect(isKnownIdentityAlias('ICRA_DATABASE_URL')).toBe(true);
      expect(isKnownIdentityAlias('ocra_assessments')).toBe(true);
      expect(isKnownIdentityAlias('totally-unknown')).toBe(false);
    });
  });
});
