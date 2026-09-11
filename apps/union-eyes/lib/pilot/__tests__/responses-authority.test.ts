import { describe, it, expect } from 'vitest';
import {
  RESERVED_RESPONSES_KEYS,
  sanitizeResponsesForPublicCreate,
  stripReservedResponsesKeysForPatch,
} from '../responses-authority';

const ORG_A = 'org-aaaa-1111';
const ORG_B = 'org-bbbb-2222';

describe('sanitizeResponsesForPublicCreate (PR #752 round 24)', () => {
  it('strips every reserved key except organizationId from an applicant-supplied responses blob', () => {
    const result = sanitizeResponsesForPublicCreate({
      organizationId: ORG_A,
      commercialState: 'subscription_active',
      subscriptionPlanId: 'attacker-chosen-plan',
      commercialTransitionHistory: [{ at: '2020-01-01', from: 'lead', to: 'qualified' }],
      pilotIntelligence: { forged: true },
      pilotFitScore: 100,
      pilotQualificationScores: { pilotFitScore: 100 },
      opportunityTier: 'A',
      pilotArtifactVersions: [{ versionId: 'v1' }],
      latestPilotArtifactVersionId: 'v1',
      pilotReferenceVersions: [{ versionId: 'r1' }],
      latestPilotReferenceVersionId: 'r1',
      commercialMonetization: { lastState: 'subscription_active' },
      // genuinely applicant-owned intake data must survive
      readinessNotes: 'we use spreadsheets today',
    });

    expect(result).toEqual({
      organizationId: ORG_A,
      readinessNotes: 'we use spreadsheets today',
    });
  });

  it('handles a missing/null responses blob without crashing', () => {
    expect(sanitizeResponsesForPublicCreate(null)).toEqual({});
    expect(sanitizeResponsesForPublicCreate(undefined)).toEqual({});
  });

  it('does not mutate the input object', () => {
    const input = { organizationId: ORG_A, commercialState: 'subscription_active' };
    const result = sanitizeResponsesForPublicCreate(input);
    expect(input.commercialState).toBe('subscription_active');
    expect(result.commercialState).toBeUndefined();
  });

  it('every key in RESERVED_RESPONSES_KEYS except organizationId is stripped', () => {
    const seeded: Record<string, unknown> = {};
    for (const key of RESERVED_RESPONSES_KEYS) {
      seeded[key] = 'attacker-value';
    }
    const result = sanitizeResponsesForPublicCreate(seeded);
    expect(result).toEqual({ organizationId: 'attacker-value' });
  });
});

describe('stripReservedResponsesKeysForPatch (PR #752 round 24)', () => {
  it('strips organizationId (the claim) along with every other reserved key', () => {
    const result = stripReservedResponsesKeysForPatch({
      organizationId: ORG_B,
      commercialState: 'subscription_active',
      subscriptionPlanId: 'attacker-chosen-plan',
      readinessNotes: 'updated by steward',
    });
    expect(result).toEqual({ readinessNotes: 'updated by steward' });
  });

  it('leaves genuinely applicant/steward-owned keys untouched', () => {
    const result = stripReservedResponsesKeysForPatch({
      readinessNotes: 'updated',
      referenceTestimonialQuote: 'Great tool!',
      someNewFollowUpNote: 'called applicant back',
    });
    expect(result).toEqual({
      readinessNotes: 'updated',
      referenceTestimonialQuote: 'Great tool!',
      someNewFollowUpNote: 'called applicant back',
    });
  });

  it('does not mutate the input object', () => {
    const input = { commercialState: 'subscription_active', notes: 'ok' };
    const result = stripReservedResponsesKeysForPatch(input);
    expect(input.commercialState).toBe('subscription_active');
    expect(result.commercialState).toBeUndefined();
  });

  it('every key in RESERVED_RESPONSES_KEYS is stripped, including organizationId', () => {
    const seeded: Record<string, unknown> = {};
    for (const key of RESERVED_RESPONSES_KEYS) {
      seeded[key] = 'attacker-value';
    }
    expect(stripReservedResponsesKeysForPatch(seeded)).toEqual({});
  });

  it('round 24: reference-profile version keys are reserved (round 23 missed these)', () => {
    const result = stripReservedResponsesKeysForPatch({
      pilotReferenceVersions: [{ versionId: 'attacker' }],
      latestPilotReferenceVersionId: 'attacker',
      latestPilotReferenceChecksum: 'attacker',
      latestPilotReferenceUpdatedAt: '2020-01-01',
    });
    expect(result).toEqual({});
  });

  it('round 24: championScore/activityScore remain deliberately unreserved (documented decision, not an oversight)', () => {
    const result = stripReservedResponsesKeysForPatch({
      championScore: 42,
      activityScore: 77,
    });
    expect(result).toEqual({ championScore: 42, activityScore: 77 });
  });
});
