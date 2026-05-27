/**
 * ARTIFACT TYPE: Data Mapper
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * Leadership Briefing Report — Report Data Mapper
 *
 * Maps InstitutionalContinuityProfile + OrganizationContext to PdfReportData.
 * Calls the narrative engine for each section and assembles the full data
 * structure required by ExecutiveContinuityBriefTemplate.
 */

import type {
  ContinuityBurdenIndex,
  ContinuityInsight,
  ContinuityObservation,
  ContinuitySignal,
  DimensionScore,
  ExecutivePersonaId,
  FollowupRecommendation,
  InstitutionalContinuityProfile,
  MaturityBand,
  OrganizationContext,
  SectionScore,
  StewardshipSignal,
} from '../icra/types';
import { detectPersona } from '../icra/personas';
import {
  generateExecutiveSummary,
  generateGovernanceEntropyAnalysis,
  generateMemoryHoldersAnalysis,
  generateModernizationReview,
  generateRecommendations,
  generateExecutiveReflection,
  buildStabilizationMovementNarrative,
  buildContinuityDebtReductionNarrative,
  buildGovernanceRecoveryTrajectoryNarrative,
  buildOnboardingSurvivabilityNarrative,
  buildStewardshipRedistributionEvolutionNarrative,
  type PdfRecommendation,
  type StabilizationAppendixParagraph,
} from './reportNarrativeEngine';
import type { ExecutiveStabilizationResult } from '../workbook/engines/executive/executiveStabilizationModel';
import type { AdaptiveReportAISlot, SupportedLocale } from '../icra/adaptation';

// ─────────────────────────────────────────────────────────────────────────────
// PdfReportData — the fully-assembled data structure for the template
// ─────────────────────────────────────────────────────────────────────────────

export interface PdfReportData {
  // Metadata
  assessmentId: string;
  generatedAt: Date;
  locale: string;

  // Cover
  institutionName?: string;
  sector?: string;
  jurisdiction?: string;

  // Maturity
  maturityBand: MaturityBand;
  composite: number;

  // Score data
  dimensions: DimensionScore[];
  sections: SectionScore[];

  // Insight data
  insights: ContinuityInsight[];
  continuitySignals: ContinuitySignal[];
  stewardshipSignals: StewardshipSignal[];
  burdenIndex: ContinuityBurdenIndex;
  observations: ContinuityObservation[];
  platformRecommendations: FollowupRecommendation[];

  // Generated narratives
  narrative: {
    executiveSummary: string[];
    governanceEntropy: string[];
    memoryHolders: string[];
    modernizationReview: string[];
    recommendations: PdfRecommendation[];
    executiveReflection: string[];
  };

  // Persona (for subtle copy adaptation, not displayed)
  persona?: ExecutivePersonaId;

  // Stats
  answeredQuestionCount: number;
  questionBankVersion: number;

  // Optional Stabilization Movement appendix (facilitated edition only).
  // When supplied, the PDF template renders an appendix page after the
  // executive reflection composed from these paragraphs.
  stabilizationMovement?: {
    paragraphs: readonly StabilizationAppendixParagraph[];
  };

  // Optional deterministic AI-assisted narrative payload. Exposed only after
  // workflow approval.
  aiAssistedNarrative?: {
    reviewStatus: 'approved';
    auditRecordRef: string;
    narrative: string;
  };
}

interface ReportMapperOptions {
  locale?: SupportedLocale;
  adaptiveReportAISlot?: AdaptiveReportAISlot | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────────────────────

export function mapToPdfReportData(
  profile: InstitutionalContinuityProfile,
  orgContext?: OrganizationContext | null,
  executiveStabilization?: ExecutiveStabilizationResult | null,
  options?: ReportMapperOptions,
): PdfReportData {
  const persona = orgContext ? detectPersona(orgContext) : undefined;

  const insights = profile.insights ?? [];
  const continuitySignals = profile.continuitySignals ?? [];
  const stewardshipSignals = profile.stewardshipSignals ?? [];
  const burdenIndex: ContinuityBurdenIndex = profile.burdenIndex ?? {
    score: 50,
    interpretation: 'Continuity burden data unavailable for this assessment.',
    humanCompensationIndicators: [],
  };

  const narrative = {
    executiveSummary: generateExecutiveSummary(
      profile.maturityBand,
      profile.composite,
      profile.dimensions,
      insights,
      burdenIndex,
      persona,
    ),
    governanceEntropy: generateGovernanceEntropyAnalysis(
      profile.dimensions,
      insights,
      continuitySignals,
      persona,
    ),
    memoryHolders: generateMemoryHoldersAnalysis(
      profile.dimensions,
      continuitySignals,
      stewardshipSignals,
      burdenIndex,
      persona,
    ),
    modernizationReview: generateModernizationReview(
      profile.dimensions,
      insights,
      persona,
    ),
    recommendations: generateRecommendations(
      profile.maturityBand,
      profile.dimensions,
      burdenIndex,
      persona,
    ),
    executiveReflection: generateExecutiveReflection(
      profile.maturityBand,
      profile.composite,
      persona,
    ),
  };

  const adaptiveSlot = options?.adaptiveReportAISlot;
  const aiAssistedNarrative =
    adaptiveSlot?.reviewWorkflow.status === 'approved'
      ? {
          reviewStatus: 'approved' as const,
          auditRecordRef:
            adaptiveSlot.reviewWorkflow.auditTrail.at(-1)?.auditId ??
            adaptiveSlot.reviewWorkflow.workflowId,
          narrative: [
            adaptiveSlot.narrative.headerStatement,
            ...adaptiveSlot.narrative.continuityContext,
            ...adaptiveSlot.executive.paragraphs,
          ].join('\n\n'),
        }
      : undefined;

  return {
    assessmentId: profile.assessmentId,
    generatedAt: new Date(profile.generatedAt),
    locale: options?.locale ?? 'en-CA',

    institutionName: orgContext?.name,
    sector: orgContext?.sector,
    jurisdiction: orgContext?.jurisdiction,

    maturityBand: profile.maturityBand,
    composite: profile.composite,

    dimensions: profile.dimensions,
    sections: profile.sections,

    insights,
    continuitySignals,
    stewardshipSignals,
    burdenIndex,
    observations: profile.observations,
    platformRecommendations: profile.recommendations,

    narrative,

    persona,
    answeredQuestionCount: profile.answeredQuestionCount,
    questionBankVersion: profile.questionBankVersion,

    stabilizationMovement: executiveStabilization
      ? {
          paragraphs: [
            buildStabilizationMovementNarrative(executiveStabilization),
            buildContinuityDebtReductionNarrative(executiveStabilization),
            buildGovernanceRecoveryTrajectoryNarrative(executiveStabilization),
            buildOnboardingSurvivabilityNarrative(executiveStabilization),
            buildStewardshipRedistributionEvolutionNarrative(executiveStabilization),
          ],
        }
      : undefined,

    aiAssistedNarrative,
  };
}
