/**
 * ARTIFACT TYPE: Vitest Suite — OCRA Live Adaptive Flow
 * MODULE: Persistence + recovery semantics
 * DOCTRINE_VERSION: 1.0.0
 *
 * Validates the recovery contract used by `ICRAAssessmentFlow`'s hydrate
 * path: a previously stored `InstitutionalAssessmentProfile` must always be
 * safely reroutable into a fresh `RoutedQuestionBank` — and that re-routing
 * is deterministic, so a refresh never silently shifts the user's
 * assessment surface.
 *
 * This test verifies pure helpers — no React, no DOM. The live hydration
 * effect inside `ICRAAssessmentFlow.tsx` is wired to use exactly this
 * `routeQuestionBank(ALL_QUESTIONS, profile)` invocation when the stored
 * `routedBankVersion` mismatches the current `ROUTING_ENGINE_VERSION`.
 */

import { describe, expect, it } from 'vitest';

import { ALL_QUESTIONS } from '../questions';
import {
  classifyOrgContext,
  routeQuestionBank,
  ROUTING_ENGINE_VERSION,
  type RoutableQuestion,
} from '../adaptation';

const PROFILE_INPUTS = {
  ctx_org_type: 'national_union',
  ctx_sector: 'public_sector',
  ctx_membership_size: '10000_49999',
};

describe('OCRA live adaptive flow — recovery', () => {
  it('re-routing a restored profile yields the same fingerprint as the original route', () => {
    const profile = classifyOrgContext({ rawForm: PROFILE_INPUTS });
    const original = routeQuestionBank(
      ALL_QUESTIONS as unknown as RoutableQuestion[],
      profile,
    );
    const restored = routeQuestionBank(
      ALL_QUESTIONS as unknown as RoutableQuestion[],
      profile,
    );
    expect(restored.routeVersion).toBe(original.routeVersion);
    expect(restored.routeVersion).toBe(ROUTING_ENGINE_VERSION);
    expect(restored.selectionFingerprint).toBe(original.selectionFingerprint);
    expect(restored.includedQuestions.map((q) => q.id)).toEqual(
      original.includedQuestions.map((q) => q.id),
    );
  });

  it('reroute path produces a non-empty included set for any well-formed profile', () => {
    const profile = classifyOrgContext({ rawForm: PROFILE_INPUTS });
    const bank = routeQuestionBank(
      ALL_QUESTIONS as unknown as RoutableQuestion[],
      profile,
    );
    expect(bank.includedQuestions.length).toBeGreaterThan(0);
  });

  it('reroute path tolerates an empty raw form (safe default profile)', () => {
    const profile = classifyOrgContext({ rawForm: {} });
    const bank = routeQuestionBank(
      ALL_QUESTIONS as unknown as RoutableQuestion[],
      profile,
    );
    // Safe default must never strand the respondent with zero questions.
    expect(bank.includedQuestions.length).toBeGreaterThan(0);
    expect(bank.routeVersion).toBe(ROUTING_ENGINE_VERSION);
  });
});
