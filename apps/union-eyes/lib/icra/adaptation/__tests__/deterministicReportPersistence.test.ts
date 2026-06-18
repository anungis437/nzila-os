import { describe, expect, it } from 'vitest';

import { MATURITY_BANDS } from '@/lib/icra/maturity';
import type { InstitutionalContinuityProfile } from '@/lib/icra/types';

import { adaptScoring } from '../adaptiveScoringModel';
import {
  buildDeterministicReportContext,
  composeAdaptiveReportAISlot,
} from '../deterministicReportEngine';
import {
  buildPersistedAdaptiveContext,
  embedPersistedAdaptiveContext,
} from '../persistedAdaptiveContext';
import {
  embedPersistedAdaptiveReportAISlot,
  extractPersistedAdaptiveReportAISlot,
  applyAdaptiveReportReviewDecision,
  resolveAdaptiveReportAISlot,
} from '../deterministicReportPersistence';
import { routeQuestionBank } from '../questionRoutingEngine';
import { classifyOrgContext } from '../orgContextClassifier';
import { ALL_QUESTIONS, QUESTION_BANK_VERSION } from '../../questions';
import type { InstitutionalAssessmentProfile } from '../types';

function buildRawProfile(): InstitutionalContinuityProfile {
  return {
    assessmentId: 'a6a2774f-4d35-4f32-bab3-fefce4194b0a',
    generatedAt: '2026-05-22T00:00:00.000Z',
    maturityBand: MATURITY_BANDS.structured_governance,
    composite: 67,
    dimensions: [],
    sections: [],
    observations: [],
    recommendations: [],
    answeredQuestionCount: 25,
    questionBankVersion: 3,
    insights: [],
    continuitySignals: [],
    stewardshipSignals: [],
    burdenIndex: {
      score: 44,
      interpretation: 'Continuity burden is present but not concentrated.',
      humanCompensationIndicators: ['handover quality varies by function'],
    },
  };
}

function buildInstitutionalProfile(): InstitutionalAssessmentProfile {
  return {
    doctrineVersion: '1.0.0',
    institutionalScale: 'mid_sized',
    continuityComplexity: 'moderate',
    governanceComplexity: 'structured',
    continuityExposure: 'cross_functional',
    respondentLens: 'senior_decision_maker',
    declaredInputs: {
      sector: 'labour_union',
      workforceBand: '250_999',
      governanceModel: 'elected_board',
      hasFederationAffiliation: false,
    },
    rationale: [],
    isComplete: true,
    usedConservativeDefault: false,
  };
}

describe('deterministic report persistence', () => {
  it('embeds and extracts a persisted report slot deterministically', () => {
    const contextual = adaptScoring(buildRawProfile(), buildInstitutionalProfile());
    const context = buildDeterministicReportContext({
      result: contextual,
      routed: null,
      locale: 'en-CA',
      generatedAt: '2026-05-22T12:00:00.000Z',
    });
    const slot = composeAdaptiveReportAISlot({ context });

    const orgContext = embedPersistedAdaptiveReportAISlot({}, slot);

    expect(extractPersistedAdaptiveReportAISlot(orgContext)).toEqual(slot);
  });

  it('resolves a report slot from assessment context without persistence', () => {
    const rawProfile = buildRawProfile();
    adaptScoring(rawProfile, buildInstitutionalProfile());
    const orgContext = embedPersistedAdaptiveContext(
      {
        ctx_org_type: 'federation',
        ctx_sector: 'labour_union',
        ctx_membership_size: '50000_plus',
        ctx_years_operating: '30_plus_years',
        ctx_respondent_role: 'self_board_member',
      },
      buildPersistedAdaptiveContext(
        classifyOrgContext({
          rawForm: {
            ctx_org_type: 'federation',
            ctx_sector: 'labour_union',
            ctx_membership_size: '50000_plus',
            ctx_years_operating: '30_plus_years',
            ctx_respondent_role: 'self_board_member',
          },
        }),
        routeQuestionBank(
          ALL_QUESTIONS as any as Parameters<typeof routeQuestionBank>[0],
          classifyOrgContext({
            rawForm: {
              ctx_org_type: 'federation',
              ctx_sector: 'labour_union',
              ctx_membership_size: '50000_plus',
              ctx_years_operating: '30_plus_years',
              ctx_respondent_role: 'self_board_member',
            },
          }),
        ),
        QUESTION_BANK_VERSION,
      ),
    );

    const resolved = resolveAdaptiveReportAISlot({
      rawProfile,
      organizationContext: orgContext,
      questionBank: ALL_QUESTIONS as any as Parameters<typeof routeQuestionBank>[0],
      locale: 'en-CA',
      generatedAt: '2026-05-22T12:00:00.000Z',
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.narrative.headerStatement).toContain('continuity');
    expect(resolved?.executive.paragraphs.length).toBeGreaterThan(0);
    expect(resolved?.reviewWorkflow.status).toBe('pending_review');
  });

  it('applies an approval decision to a persisted report slot', () => {
    const contextual = adaptScoring(buildRawProfile(), buildInstitutionalProfile());
    const context = buildDeterministicReportContext({
      result: contextual,
      routed: null,
      locale: 'en-CA',
      generatedAt: '2026-05-22T12:00:00.000Z',
    });
    const slot = composeAdaptiveReportAISlot({ context });

    const approved = applyAdaptiveReportReviewDecision(slot, {
      reviewerRole: 'governance_reviewer',
      status: 'approved',
      summary: 'Approved for controlled PDF rendering.',
      reviewedAt: '2026-05-22T12:05:00.000Z',
    });

    expect(approved.reviewWorkflow.status).toBe('approved');
    expect(approved.reviewWorkflow.reviews).toHaveLength(1);
    expect(approved.reviewWorkflow.auditTrail.at(-1)?.action).toBe('report_approved');
  });
});
