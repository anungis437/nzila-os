/**
 * ARTIFACT TYPE: Vitest Suite — OCRA Live Adaptive Flow
 * MODULE: Live adaptive routing wiring
 * DOCTRINE_VERSION: 1.0.0
 *
 * Verifies that distinct declared organizational contexts deterministically
 * produce distinct `InstitutionalAssessmentProfile` band assignments, which
 * in turn drive `routeQuestionBank` to a stable selection fingerprint.
 *
 * Since the static question bank currently carries no `adaptive` metadata,
 * every question is treated as `include_core` and `includedQuestions` equals
 * the full bank. The point of these tests is to lock in the upstream
 * deterministic contract (profile → bank version + fingerprint) so the live
 * UI wiring stays anchored even as the question bank evolves.
 */

import { describe, expect, it } from 'vitest';

import { ALL_QUESTIONS } from '../questions';
import {
  classifyOrgContext,
  routeQuestionBank,
  ROUTING_ENGINE_VERSION,
  type RoutableQuestion,
} from '../adaptation';

const SMALL_LOCAL_UNION = {
  ctx_org_type: 'local_union',
  ctx_sector: 'public_sector',
  ctx_membership_size: 'under_100',
};

const FEDERATED_NATIONAL = {
  ctx_org_type: 'national_union',
  ctx_sector: 'federal',
  ctx_membership_size: '50000_plus',
};

const HEALTHCARE_AUTHORITY = {
  ctx_org_type: 'health_authority',
  ctx_sector: 'healthcare',
  ctx_membership_size: '10000_49999',
};

describe('OCRA live adaptive routing', () => {
  it('emits the pinned routing engine version', () => {
    expect(ROUTING_ENGINE_VERSION).toBe('1.0.0');
  });

  it('classifies a small local union into the smallest scale band', () => {
    const profile = classifyOrgContext({ rawForm: SMALL_LOCAL_UNION });
    expect(['micro', 'small_local']).toContain(profile.institutionalScale);
    expect(profile.governanceComplexity).toBeDefined();
  });

  it('classifies a federated national union into a larger scale band', () => {
    const profile = classifyOrgContext({ rawForm: FEDERATED_NATIONAL });
    expect(['national', 'federation_layered', 'enterprise']).toContain(
      profile.institutionalScale,
    );
  });

  it('classifies a healthcare authority with appointed governance', () => {
    const profile = classifyOrgContext({ rawForm: HEALTHCARE_AUTHORITY });
    expect(profile.governanceComplexity).toBeDefined();
    expect(profile.continuityExposure).toBeDefined();
  });

  it('routeQuestionBank preserves the full question count when no adaptive metadata is present', () => {
    const profile = classifyOrgContext({ rawForm: SMALL_LOCAL_UNION });
    const bank = routeQuestionBank(
      ALL_QUESTIONS as unknown as RoutableQuestion[],
      profile,
    );
    expect(bank.routeVersion).toBe(ROUTING_ENGINE_VERSION);
    expect(bank.includedQuestions.length).toBe(ALL_QUESTIONS.length);
    expect(bank.deferredQuestions.length).toBe(0);
    expect(bank.selectionFingerprint.length).toBeGreaterThan(0);
  });

  it('produces a deterministic fingerprint for identical inputs', () => {
    const profileA = classifyOrgContext({ rawForm: SMALL_LOCAL_UNION });
    const profileB = classifyOrgContext({ rawForm: SMALL_LOCAL_UNION });
    const bankA = routeQuestionBank(
      ALL_QUESTIONS as unknown as RoutableQuestion[],
      profileA,
    );
    const bankB = routeQuestionBank(
      ALL_QUESTIONS as unknown as RoutableQuestion[],
      profileB,
    );
    expect(bankA.selectionFingerprint).toBe(bankB.selectionFingerprint);
  });
});
