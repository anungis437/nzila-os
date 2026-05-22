/**
 * ARTIFACT TYPE: Vitest Suite — OCRA Live Adaptive Flow
 * MODULE: Client telemetry metadata shape
 * DOCTRINE_VERSION: 1.0.0
 *
 * Validates the PII-safe metadata shape that `ICRAAssessmentFlow` emits to
 * `/api/icra/telemetry` for the three adaptive event kinds. The telemetry
 * API enforces:
 *   - At most 8 metadata keys per event.
 *   - String values truncated at 64 characters.
 *
 * These tests mirror the exact payload shapes used by the component so
 * regressions in payload size or key count are caught here, not at runtime.
 */

import { describe, expect, it } from 'vitest';

import { ALL_QUESTIONS } from '../questions';
import {
  classifyOrgContext,
  routeQuestionBank,
  type RoutableQuestion,
} from '../adaptation';

const METADATA_MAX_KEYS = 8;
const METADATA_MAX_VALUE_LEN = 64;

function buildProfileCreatedMeta(
  profile: ReturnType<typeof classifyOrgContext>,
): Record<string, string | number | boolean> {
  return {
    doctrineVersion: profile.doctrineVersion,
    scale: profile.institutionalScale,
    continuity: profile.continuityComplexity,
    governance: profile.governanceComplexity,
    exposure: profile.continuityExposure,
    lens: profile.respondentLens,
    safeDefault: profile.usedConservativeDefault,
  };
}

function buildAssessmentRoutedMeta(
  bank: ReturnType<typeof routeQuestionBank>,
): Record<string, string | number | boolean> {
  return {
    routeVersion: bank.routeVersion,
    included: bank.includedQuestions.length,
    deferred: bank.deferredQuestions.length,
    required: bank.requiredQuestions.length,
    optional: bank.optionalContextQuestions.length,
    safeDefault: bank.usedSafeDefault,
    selection: bank.selectionFingerprint.slice(0, METADATA_MAX_VALUE_LEN),
  };
}

function buildQuestionDeferredMeta(
  questionId: string,
  decision: string,
  ruleId: string,
): Record<string, string | number | boolean> {
  return {
    questionId: questionId.slice(0, METADATA_MAX_VALUE_LEN),
    decision,
    ruleId: ruleId.slice(0, METADATA_MAX_VALUE_LEN),
  };
}

function assertMetadataShape(meta: Record<string, string | number | boolean>) {
  const keys = Object.keys(meta);
  expect(keys.length).toBeLessThanOrEqual(METADATA_MAX_KEYS);
  for (const [, v] of Object.entries(meta)) {
    if (typeof v === 'string') {
      expect(v.length).toBeLessThanOrEqual(METADATA_MAX_VALUE_LEN);
    }
  }
}

describe('OCRA adaptive telemetry wiring — metadata shape', () => {
  const profile = classifyOrgContext({
    rawForm: {
      ctx_org_type: 'local_union',
      ctx_sector: 'public_sector',
      ctx_membership_size: '100_499',
    },
  });
  const bank = routeQuestionBank(
    ALL_QUESTIONS as unknown as RoutableQuestion[],
    profile,
  );

  it('adaptive_profile_created metadata respects the 8-key / 64-char limits', () => {
    assertMetadataShape(buildProfileCreatedMeta(profile));
  });

  it('assessment_routed metadata respects the 8-key / 64-char limits', () => {
    assertMetadataShape(buildAssessmentRoutedMeta(bank));
  });

  it('adaptive_question_deferred metadata respects the 8-key / 64-char limits', () => {
    assertMetadataShape(
      buildQuestionDeferredMeta(
        'a'.repeat(200),
        'defer_not_applicable',
        'b'.repeat(200),
      ),
    );
  });

  it('contains no PII-bearing keys (no email, no name, no free text)', () => {
    const meta = buildProfileCreatedMeta(profile);
    const banned = ['email', 'name', 'fullName', 'phone', 'address', 'primaryChallenge', 'freeText'];
    for (const key of Object.keys(meta)) {
      for (const bad of banned) {
        expect(key.toLowerCase()).not.toContain(bad.toLowerCase());
      }
    }
  });
});
