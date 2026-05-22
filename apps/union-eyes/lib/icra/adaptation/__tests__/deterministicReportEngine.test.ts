import { describe, expect, it } from 'vitest';

import { MATURITY_BANDS } from '@/lib/icra/maturity';
import type { InstitutionalContinuityProfile } from '@/lib/icra/types';

import { adaptScoring } from '../adaptiveScoringModel';
import type { InstitutionalAssessmentProfile } from '../types';
import {
  buildDeterministicReportContext,
  composeAdaptiveReportAISlot,
  initializeReviewWorkflow,
  recordReviewDecision,
} from '../deterministicReportEngine';

function buildRawProfile(): InstitutionalContinuityProfile {
  return {
    assessmentId: 'a6a2774f-4d35-4f32-bab3-fefce4194b0a',
    generatedAt: '2026-05-22T00:00:00.000Z',
    maturityBand: MATURITY_BANDS.structured_governance,
    composite: 67,
    dimensions: [
      {
        dimension: 'institutional_continuity',
        score: 71,
        contributingQuestions: 5,
        weightTotal: 1,
      },
      {
        dimension: 'governance_fragility',
        score: 62,
        contributingQuestions: 5,
        weightTotal: 1,
      },
      {
        dimension: 'trust_debt',
        score: 58,
        contributingQuestions: 5,
        weightTotal: 1,
      },
      {
        dimension: 'operational_memory',
        score: 64,
        contributingQuestions: 5,
        weightTotal: 1,
      },
      {
        dimension: 'transition_readiness',
        score: 63,
        contributingQuestions: 5,
        weightTotal: 1,
      },
    ],
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

describe('deterministic report engine', () => {
  it('composes identical slot for identical deterministic inputs', () => {
    const contextual = adaptScoring(buildRawProfile(), buildInstitutionalProfile());
    const contextA = buildDeterministicReportContext({
      result: contextual,
      routed: null,
      locale: 'en-CA',
      generatedAt: '2026-05-22T12:00:00.000Z',
    });
    const contextB = buildDeterministicReportContext({
      result: contextual,
      routed: null,
      locale: 'en-CA',
      generatedAt: '2026-05-22T12:00:00.000Z',
    });

    expect(composeAdaptiveReportAISlot({ context: contextA })).toEqual(
      composeAdaptiveReportAISlot({ context: contextB }),
    );
  });

  it('enforces review guardrails for unsafe reviewer summary content', () => {
    const contextual = adaptScoring(buildRawProfile(), buildInstitutionalProfile());
    const context = buildDeterministicReportContext({
      result: contextual,
      routed: null,
      locale: 'en-CA',
      generatedAt: '2026-05-22T12:00:00.000Z',
    });

    const workflow = initializeReviewWorkflow(context);
    expect(() =>
      recordReviewDecision(workflow, {
        reviewerRole: 'facilitator',
        status: 'approved',
        summary: 'Approved by lead at reviewer@example.com',
        reviewedAt: '2026-05-22T13:00:00.000Z',
      }),
    ).toThrow('violates disclosure guardrails');
  });

  it('records review decision and appends audit entries', () => {
    const contextual = adaptScoring(buildRawProfile(), buildInstitutionalProfile());
    const context = buildDeterministicReportContext({
      result: contextual,
      routed: null,
      locale: 'fr-CA',
      generatedAt: '2026-05-22T12:00:00.000Z',
    });

    const workflow = initializeReviewWorkflow(context);
    const decided = recordReviewDecision(workflow, {
      reviewerRole: 'governance_reviewer',
      status: 'approved',
      summary: 'Approuve avec controles de doctrine confirms.',
      reviewedAt: '2026-05-22T13:00:00.000Z',
    });

    expect(decided.status).toBe('approved');
    expect(decided.reviews).toHaveLength(1);
    expect(decided.auditTrail.length).toBeGreaterThan(workflow.auditTrail.length);
  });
});
