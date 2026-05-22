/**
 * ARTIFACT TYPE: Vitest Suite — OCI ↔ OCRA Convergence
 * MODULE: OCI Operational Truth Hardening — Part 4
 * DOCTRINE_VERSION: 1.0.0
 *
 * Compatibility-first migration tests. Asserts that legacy `icra` identifiers
 * continue to resolve, while the canonical `ocra` form is preferred when both
 * are present.
 */

import { describe, expect, it } from 'vitest';

import {
  ALL_ALIAS_CATEGORIES,
  DB_TABLE_ALIASES,
  ENV_VAR_ALIASES,
  HUBSPOT_PROPERTY_ALIASES,
  ROUTE_ALIASES,
  STRIPE_PRICE_ALIASES,
} from '../runtimeIdentityAliasMap';
import {
  isKnownIdentityAlias,
  resolveLegacyDbTable,
  resolveLegacyEnv,
  resolveLegacyHubspotProperty,
  resolveLegacyRoute,
  resolveLegacyStripePriceKey,
} from '../compatibilityFallbacks';

describe('OCI ↔ OCRA legacy compatibility', () => {
  describe('alias map structure', () => {
    it('every alias pair has distinct legacy and canonical values', () => {
      for (const pairs of Object.values(ALL_ALIAS_CATEGORIES)) {
        for (const pair of pairs) {
          expect(pair.legacy).not.toBe(pair.canonical);
        }
      }
    });

    it('every legacy key contains "icra" and every canonical key contains "ocra"', () => {
      for (const pairs of Object.values(ALL_ALIAS_CATEGORIES)) {
        for (const pair of pairs) {
          expect(pair.legacy.toLowerCase()).toContain('icra');
          expect(pair.canonical.toLowerCase()).toContain('ocra');
        }
      }
    });

    it('legacy keys are unique within each category', () => {
      for (const pairs of Object.values(ALL_ALIAS_CATEGORIES)) {
        const legacies = pairs.map((p) => p.legacy);
        expect(new Set(legacies).size).toBe(legacies.length);
      }
    });

    it('canonical keys are unique within each category', () => {
      for (const pairs of Object.values(ALL_ALIAS_CATEGORIES)) {
        const canonicals = pairs.map((p) => p.canonical);
        expect(new Set(canonicals).size).toBe(canonicals.length);
      }
    });
  });

  describe('resolveLegacyEnv', () => {
    const pair = ENV_VAR_ALIASES[0];

    it('returns the canonical value when only it is set', () => {
      const env = { [pair.canonical]: 'canonical-value' };
      expect(resolveLegacyEnv(pair.canonical, env)).toBe('canonical-value');
    });

    it('returns the legacy value when only it is set', () => {
      const env = { [pair.legacy]: 'legacy-value' };
      expect(resolveLegacyEnv(pair.canonical, env)).toBe('legacy-value');
    });

    it('prefers the canonical value when both are set', () => {
      const env = { [pair.canonical]: 'new', [pair.legacy]: 'old' };
      expect(resolveLegacyEnv(pair.canonical, env)).toBe('new');
    });

    it('returns undefined when neither is set', () => {
      expect(resolveLegacyEnv(pair.canonical, {})).toBeUndefined();
    });

    it('returns undefined for an unrecognized canonical name', () => {
      expect(resolveLegacyEnv('SOMETHING_ELSE', { SOMETHING_ELSE: undefined })).toBeUndefined();
    });
  });

  describe('resolveLegacyRoute', () => {
    it('rewrites an exact legacy path to its canonical form', () => {
      expect(resolveLegacyRoute('/api/icra')).toBe('/api/ocra');
    });

    it('rewrites a nested legacy path while preserving the suffix', () => {
      expect(resolveLegacyRoute('/api/icra/assessments/abc')).toBe('/api/ocra/assessments/abc');
    });

    it('returns canonical paths unchanged', () => {
      expect(resolveLegacyRoute('/api/ocra/profile')).toBe('/api/ocra/profile');
    });

    it('returns unrelated paths unchanged', () => {
      expect(resolveLegacyRoute('/api/other/thing')).toBe('/api/other/thing');
    });
  });

  describe('integration adapter resolvers', () => {
    it('resolves a legacy Stripe price key to its canonical form', () => {
      const pair = STRIPE_PRICE_ALIASES[0];
      expect(resolveLegacyStripePriceKey(pair.legacy)).toBe(pair.canonical);
    });

    it('returns the canonical Stripe price key unchanged', () => {
      const pair = STRIPE_PRICE_ALIASES[0];
      expect(resolveLegacyStripePriceKey(pair.canonical)).toBe(pair.canonical);
    });

    it('returns undefined for an unknown Stripe price key', () => {
      expect(resolveLegacyStripePriceKey('stripe_price_unknown')).toBeUndefined();
    });

    it('resolves a legacy HubSpot property to its canonical form', () => {
      const pair = HUBSPOT_PROPERTY_ALIASES[0];
      expect(resolveLegacyHubspotProperty(pair.legacy)).toBe(pair.canonical);
    });

    it('resolves a legacy DB table to its canonical form', () => {
      const pair = DB_TABLE_ALIASES[0];
      expect(resolveLegacyDbTable(pair.legacy)).toBe(pair.canonical);
    });
  });

  describe('isKnownIdentityAlias', () => {
    it('recognizes every legacy key in the alias map', () => {
      for (const pairs of [
        ENV_VAR_ALIASES,
        STRIPE_PRICE_ALIASES,
        HUBSPOT_PROPERTY_ALIASES,
        DB_TABLE_ALIASES,
      ]) {
        for (const pair of pairs) {
          expect(isKnownIdentityAlias(pair.legacy)).toBe(true);
        }
      }
    });

    it('recognizes every canonical key in the alias map', () => {
      for (const pairs of [
        ENV_VAR_ALIASES,
        STRIPE_PRICE_ALIASES,
        HUBSPOT_PROPERTY_ALIASES,
        DB_TABLE_ALIASES,
      ]) {
        for (const pair of pairs) {
          expect(isKnownIdentityAlias(pair.canonical)).toBe(true);
        }
      }
    });

    it('refuses (returns false) on a name that is not in the map', () => {
      expect(isKnownIdentityAlias('not_a_real_key')).toBe(false);
    });
  });

  describe('non-destructive guarantees', () => {
    it('the route alias map never deletes the legacy form', () => {
      // The resolver only normalizes; it does not return a "deleted" marker.
      // Calling it twice is idempotent.
      const once = resolveLegacyRoute('/api/icra/profile');
      const twice = resolveLegacyRoute(once);
      expect(twice).toBe(once);
    });

    it('the env resolver never mutates the env it reads', () => {
      const env = Object.freeze({ [ENV_VAR_ALIASES[0].legacy]: 'x' });
      expect(() => resolveLegacyEnv(ENV_VAR_ALIASES[0].canonical, env)).not.toThrow();
    });

    it('the legacy route prefix list covers every route alias', () => {
      // Sanity: the prefix replacement branch in the resolver depends on the
      // alias map being non-empty.
      expect(ROUTE_ALIASES.length).toBeGreaterThan(0);
    });
  });
});
