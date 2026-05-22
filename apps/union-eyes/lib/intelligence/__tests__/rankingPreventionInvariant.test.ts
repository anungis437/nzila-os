/**
 * ARTIFACT TYPE: Vitest Suite — Ranking Prevention Invariant
 * MODULE: OCI Operational Truth Hardening — Part 7
 * DOCTRINE_VERSION: 1.0.0
 *
 * The intelligence network is intentionally non-comparative. Any payload that
 * carries ranking semantics (percentile, leaderboard, peer score) must be
 * refused. This is a doctrine boundary, not a feature gap.
 */

import { describe, expect, it } from 'vitest';

import { checkAgainstRanking } from '../ethics/intelligenceEthicsValidators';

const FORBIDDEN_KEYS = [
  'rank',
  'ranking',
  'leaderboard',
  'percentile',
  'peerScore',
  'reputationScore',
  'prestige',
  'topPerformers',
  'bestInClass',
  'worstInClass',
];

describe('Ranking prevention invariant', () => {
  it('refuses every doctrine-forbidden ranking key individually', () => {
    for (const key of FORBIDDEN_KEYS) {
      const verdict = checkAgainstRanking({ [key]: 1 });
      expect(verdict.readable, `expected refusal for key "${key}"`).toBe(false);
      expect(verdict.reasons).toContain('ranking_payload_detected');
    }
  });

  it('refuses payloads that mix a legitimate key with a forbidden one', () => {
    const verdict = checkAgainstRanking({ readable: true, percentile: 90 });
    expect(verdict.readable).toBe(false);
  });

  it('accepts payloads with no ranking semantics', () => {
    const verdict = checkAgainstRanking({ readable: true, contributingInstitutions: 5 });
    expect(verdict.readable).toBe(true);
  });

  it('treats non-objects as out-of-scope (no false refusal)', () => {
    expect(checkAgainstRanking('string').readable).toBe(true);
    expect(checkAgainstRanking(42).readable).toBe(true);
    expect(checkAgainstRanking(null).readable).toBe(true);
  });
});
