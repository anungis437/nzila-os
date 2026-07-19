/**
 * ARTIFACT TYPE: Vitest Suite — Anti-Exposure Validation
 * MODULE: OCI Operational Truth Hardening — Part 7
 * DOCTRINE_VERSION: 1.0.0
 *
 * Sector envelopes must NEVER carry institution-identifying material. This
 * suite asserts the surface invariant — no key named like an institution
 * handle, hash, name, slug, or contact appears on a composed envelope.
 */

import { describe, expect, it } from 'vitest';

import { K_ANONYMITY_FLOOR } from '../ethics/intelligenceEthicsValidators';
import { createContinuityIntelligenceRegistry } from '../network/continuityIntelligenceRegistry';
import { createIntelligenceNetworkEngine } from '../network/intelligenceNetworkEngine';
import { FIXTURE_OBSERVED_AT, makeGrant, makeTrajectory } from '../../integration/__fixtures__/ociFixtures';

const FORBIDDEN_KEY_FRAGMENTS = [
  'institutionref',
  'institutionhash',
  'institutionname',
  'institutionslug',
  'reviewer',
  'contact',
  'email',
  'phone',
  'address',
  'handle',
];

function buildReadableEnvelope() {
  const registry = createContinuityIntelligenceRegistry();
  for (let i = 0; i < K_ANONYMITY_FLOOR; i++) {
    registry.grant(makeGrant(`exp${i}`));
  }
  const engine = createIntelligenceNetworkEngine(registry);
  const records = Array.from({ length: K_ANONYMITY_FLOOR }, (_, i) =>
    makeTrajectory(`exp${i}`, FIXTURE_OBSERVED_AT, 'stabilizing'),
  );
  engine.ingestTrajectories(records);
  return engine.composeBaseline('labour_union', 'b-exposure', '2026-01-02T00:00:00.000Z');
}

describe('Anti-exposure validation — sector envelope surface', () => {
  it('a readable envelope contains no institution-identifying keys', () => {
    const env = buildReadableEnvelope();
    const keys = Object.keys(env).map((k) => k.toLowerCase());
    for (const k of keys) {
      for (const frag of FORBIDDEN_KEY_FRAGMENTS) {
        expect(k.includes(frag), `forbidden key fragment "${frag}" appeared on envelope key "${k}"`).toBe(false);
      }
    }
  });

  it('the serialized envelope JSON contains no institutionRefHash string', () => {
    const env = buildReadableEnvelope();
    const json = JSON.stringify(env);
    expect(json).not.toMatch(/institutionRefHash/);
    expect(json).not.toMatch(/hash_exp\d/);
  });

  it('the envelope reports contributingInstitutions as a count, not a list', () => {
    const env = buildReadableEnvelope();
    expect(typeof env.contributingInstitutions).toBe('number');
    expect(Array.isArray((env as any as Record<string, unknown>).contributingInstitutions)).toBe(false);
  });

  it('the envelope is frozen-equivalent to its JSON round-trip', () => {
    const env = buildReadableEnvelope();
    expect(JSON.parse(JSON.stringify(env))).toEqual(env);
  });
});
