import { describe, expect, it } from 'vitest';

import { scoreAssessment } from '@/lib/icra/scoring';
import { adaptScoring, buildDeterministicReportContext, composeAdaptiveReportAISlot, recordReviewDecision } from '@/lib/icra/adaptation';
import type { InstitutionalAssessmentProfile } from '@/lib/icra/adaptation';
import { buildUniformAnswers } from '@/lib/integration/__fixtures__/ociFixtures';

import { mapToPdfReportData } from '../reportDataMapper';

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

describe('reportDataMapper adaptive report slot integration', () => {
  it('does not expose ai narrative while review is still pending', () => {
    const profile = scoreAssessment('pdf-pending', buildUniformAnswers(2)).profile;
    const contextual = adaptScoring(profile, buildInstitutionalProfile());
    const context = buildDeterministicReportContext({
      result: contextual,
      routed: null,
      locale: 'en-CA',
      generatedAt: '2026-05-22T14:00:00.000Z',
    });

    const slot = composeAdaptiveReportAISlot({ context });
    const pdf = mapToPdfReportData(profile, null, null, {
      adaptiveReportAISlot: slot,
      locale: 'en-CA',
    });

    expect(pdf.aiAssistedNarrative).toBeUndefined();
  });

  it('maps approved deterministic slot into ai-assisted narrative page payload', () => {
    const profile = scoreAssessment('pdf-approved', buildUniformAnswers(3)).profile;
    const contextual = adaptScoring(profile, buildInstitutionalProfile());
    const context = buildDeterministicReportContext({
      result: contextual,
      routed: null,
      locale: 'en-CA',
      generatedAt: '2026-05-22T14:00:00.000Z',
    });

    const pendingSlot = composeAdaptiveReportAISlot({ context });
    const approvedWorkflow = recordReviewDecision(pendingSlot.reviewWorkflow, {
      reviewerRole: 'facilitator',
      status: 'approved',
      summary: 'Approved after deterministic continuity and disclosure review.',
      reviewedAt: '2026-05-22T14:05:00.000Z',
    });
    const approvedSlot = composeAdaptiveReportAISlot({
      context,
      reviewState: approvedWorkflow,
    });

    const pdf = mapToPdfReportData(profile, null, null, {
      adaptiveReportAISlot: approvedSlot,
      locale: 'en-CA',
    });

    expect(pdf.aiAssistedNarrative).toBeDefined();
    expect(pdf.aiAssistedNarrative?.reviewStatus).toBe('approved');
    expect(pdf.aiAssistedNarrative?.auditRecordRef).toMatch(/^audit-/);
    expect(pdf.aiAssistedNarrative?.narrative).toContain(approvedSlot.narrative.headerStatement);
    expect(pdf.aiAssistedNarrative?.narrative).toContain(approvedSlot.executive.paragraphs[0]);
  });
});
