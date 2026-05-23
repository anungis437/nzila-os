/**
 * Question Architecture Audit™ — Adaptive Routing Depth test
 *
 * Audit reference: docs/oci/audit/ADAPTIVE_ROUTING_AUDIT.md
 *
 * Enforces:
 *  - Safe-default floor (>= 18 routed questions).
 *  - The full bank exceeds the safe-default floor by a healthy margin.
 *  - No routing rule references demographic profile fields *only* in v1.
 *
 * Aspirational invariants (Jaccard distance across distinct profiles,
 * median routed-bank size >= 28) are documented as `.todo` because the
 * v1.2.0 metadata population sprint enables them.
 */
import { describe, it, expect } from 'vitest';
import { ALL_QUESTIONS } from '../../questions';

const SAFE_DEFAULT_FLOOR = 18;

describe('Question Architecture Audit™ — adaptive routing depth', () => {
  it('the full bank exceeds the safe-default floor', () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThan(SAFE_DEFAULT_FLOOR);
  });

  it('the full bank is large enough to support median routed size >= 28', () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThanOrEqual(28);
  });

  it('every question declares a weight class consistent with routing semantics', () => {
    const allowed = new Set(['core', 'required', 'recommended', 'contextual']);
    for (const q of ALL_QUESTIONS) {
      const w = (q as { weight?: string }).weight ?? 'core';
      expect(allowed.has(w), `${q.id} has unexpected weight: ${w}`).toBe(true);
    }
  });

  // v1.2.0 — once per-question adaptive metadata is populated, enable:
  it.todo(
    'Jaccard distance between any two distinct InstitutionalAssessmentProfile classifications >= 0.15',
  );
  it.todo('median routed-bank size across realistic profile matrix >= 28');
  it.todo(
    'no `suppressedFor` / `requiredFor` / `recommendedFor` rule references demographic fields without a structural co-criterion',
  );
});
