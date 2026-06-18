/**
 * ARTIFACT TYPE: Vitest Suite — Routing Explainability Snapshot
 * MODULE: OCRA Adaptive — Audit-safe routing snapshot
 * DOCTRINE_VERSION: 1.0.0
 *
 * The snapshot is the canonical projection of a routed bank that is safe to
 * persist on the assessment, ship to the PDF report, and display on the
 * result page. These tests lock down: shape stability, low-cardinality,
 * absence of any free-text or raw answer leakage, and core preservation.
 */

import { describe, expect, it } from 'vitest';

import {
  buildRoutingExplainabilitySnapshot,
  classifyOrgContext,
  routeQuestionBank,
  ROUTING_ENGINE_VERSION,
  type RoutableQuestion,
} from '../adaptation';
import { ALL_QUESTIONS } from '../questions';

const SMALL_LOCAL_UNION = {
  ctx_org_type: 'local_union',
  ctx_sector: 'public_sector',
  ctx_membership_size: 'under_100',
};

describe('buildRoutingExplainabilitySnapshot', () => {
  const profile = classifyOrgContext({ rawForm: SMALL_LOCAL_UNION });
  const bank = routeQuestionBank(
    ALL_QUESTIONS as any as RoutableQuestion[],
    profile,
  );
  const snap = buildRoutingExplainabilitySnapshot(profile, bank);

  it('pins doctrineVersion and routeVersion', () => {
    expect(snap.doctrineVersion).toBe('1.0.0');
    expect(snap.routeVersion).toBe(ROUTING_ENGINE_VERSION);
  });

  it('exposes only enum-valued profile bands (no PII)', () => {
    const values = Object.values(snap.profileBands);
    for (const v of values) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeLessThanOrEqual(40);
      expect(v).not.toMatch(/[@\s]/); // no emails, no free text whitespace
    }
  });

  it('reports a non-negative count triad consistent with the routed bank', () => {
    expect(snap.includedCount).toBe(bank.includedQuestions.length);
    expect(snap.deferredCount).toBe(bank.deferredQuestions.length);
    expect(snap.requiredCount).toBe(bank.requiredQuestions.length);
  });

  it('preserves core questions for the default static bank (no adaptive metadata)', () => {
    // Static bank has no per-question adaptive metadata → core set equals
    // included set → corePreserved must be true.
    expect(snap.corePreserved).toBe(true);
  });

  it('flags fallbackUsed when the bank used safe-default routing', () => {
    expect(snap.fallbackUsed).toBe(bank.usedSafeDefault);
  });

  it('rationaleCategories is a low-cardinality enum slice (max 8)', () => {
    expect(snap.rationaleCategories.length).toBeLessThanOrEqual(8);
    for (const c of snap.rationaleCategories) {
      expect(c).toMatch(
        /^(include_core|include_required|include_recommended|include_contextual|defer_suppressed|defer_out_of_scope|defer_complexity_floor|defer_complexity_ceiling)$/,
      );
    }
  });

  it('selectionFingerprint is a short stable string (≤256 chars)', () => {
    expect(snap.selectionFingerprint).toBe(bank.selectionFingerprint);
    expect(snap.selectionFingerprint.length).toBeLessThanOrEqual(256);
  });

  it('serializes to JSON without containing raw answer text or org names', () => {
    const json = JSON.stringify(snap);
    // Defensive: snapshot must never contain known PII markers.
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/local 1234/i);
    expect(json).not.toMatch(/free.text/i);
  });

  it('is deterministic across calls for the same profile + bank', () => {
    const again = buildRoutingExplainabilitySnapshot(profile, bank);
    expect(again).toEqual(snap);
  });
});
