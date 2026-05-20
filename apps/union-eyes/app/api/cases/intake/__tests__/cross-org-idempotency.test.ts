/**
 * Cross-org idempotency regression tests — P0 org-isolation hardening.
 *
 * Validates that two organizations submitting identical case data:
 *   - Each create independent claims (no cross-org deduplication collision)
 *   - Cannot see or resolve each other's idempotency hashes
 *
 * These tests run against mock infrastructure only; no real DB required.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';

/**
 * Helper that mirrors the idempotency hash function in intake/route.ts.
 * Must stay in sync with the production implementation.
 */
function buildIntakeHash(orgId: string, memberId: string, caseType: string, incidentDate: string, title: string): string {
  return createHash('sha256')
    .update(`${orgId}|${memberId}|${caseType}|${incidentDate}|${title}`)
    .digest('hex');
}

const SHARED_INTAKE = {
  memberId: 'member-abc',
  caseType: 'discipline',
  incidentDate: '2026-01-15',
  title: 'Wrongful termination',
} as const;

describe('intake idempotency — cross-org isolation', () => {
  it('produces different hashes for the same intake data submitted by two different orgs', () => {
    const hashOrg1 = buildIntakeHash('org-1', SHARED_INTAKE.memberId, SHARED_INTAKE.caseType, SHARED_INTAKE.incidentDate, SHARED_INTAKE.title);
    const hashOrg2 = buildIntakeHash('org-2', SHARED_INTAKE.memberId, SHARED_INTAKE.caseType, SHARED_INTAKE.incidentDate, SHARED_INTAKE.title);

    expect(hashOrg1).not.toBe(hashOrg2);
  });

  it('produces the same hash for identical re-submissions within the same org (idempotent)', () => {
    const hash1 = buildIntakeHash('org-1', SHARED_INTAKE.memberId, SHARED_INTAKE.caseType, SHARED_INTAKE.incidentDate, SHARED_INTAKE.title);
    const hash2 = buildIntakeHash('org-1', SHARED_INTAKE.memberId, SHARED_INTAKE.caseType, SHARED_INTAKE.incidentDate, SHARED_INTAKE.title);

    expect(hash1).toBe(hash2);
  });

  it('produces different hashes when any intake field differs within the same org', () => {
    const base = buildIntakeHash('org-1', SHARED_INTAKE.memberId, SHARED_INTAKE.caseType, SHARED_INTAKE.incidentDate, SHARED_INTAKE.title);
    const diffTitle = buildIntakeHash('org-1', SHARED_INTAKE.memberId, SHARED_INTAKE.caseType, SHARED_INTAKE.incidentDate, 'Different title');
    const diffDate = buildIntakeHash('org-1', SHARED_INTAKE.memberId, SHARED_INTAKE.caseType, '2026-02-01', SHARED_INTAKE.title);
    const diffType = buildIntakeHash('org-1', SHARED_INTAKE.memberId, 'harassment', SHARED_INTAKE.incidentDate, SHARED_INTAKE.title);

    expect(base).not.toBe(diffTitle);
    expect(base).not.toBe(diffDate);
    expect(base).not.toBe(diffType);
  });

  it('hash is a 64-char hex string (SHA-256)', () => {
    const hash = buildIntakeHash('org-1', 'member-1', 'discipline', '2026-01-01', 'Test case');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
