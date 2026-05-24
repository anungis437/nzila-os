/**
 * ARTIFACT TYPE: Vitest Suite — Reliability Regression
 * MODULE: OCI Operational Truth Hardening — Part 6
 * DOCTRINE_VERSION: 1.0.0
 *
 * Institutional reliability: the runtime contract surface must enumerate the
 * same set of required keys release-over-release. Adding or removing a
 * required contract is an authorized doctrine amendment and should fail this
 * test until the snapshot is intentionally updated.
 */

import { describe, expect, it } from 'vitest';

import { assessRuntimeContracts } from '../fail-closed';

const REQUIRED_CONTRACT_KEYS = [
  'auth.next.secret',
  'auth.django.secret',
  'crypto.fallback',
  'data.database_url',
] as const;

describe('Institutional reliability — required runtime contracts', () => {
  it('the required contract set is exactly the doctrine-approved list', () => {
    const report = assessRuntimeContracts();
    const required = report.contracts.filter((c) => c.required).map((c) => c.key).sort();
    expect(required).toEqual([...REQUIRED_CONTRACT_KEYS].sort());
  });

  it('every required contract has a fail-closed-governance disposition', () => {
    const report = assessRuntimeContracts();
    for (const c of report.contracts) {
      if (c.required) {
        expect(c.disposition).toBe('fail-closed-governance');
      }
    }
  });

  it('every contract assessment carries a non-empty human message', () => {
    const report = assessRuntimeContracts();
    for (const c of report.contracts) {
      expect(c.message.length).toBeGreaterThan(0);
      expect(c.message).toContain(c.key);
    }
  });
});
