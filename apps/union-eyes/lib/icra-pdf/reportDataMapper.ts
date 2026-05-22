/**
 * ARTIFACT TYPE: Data Mapper
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Commercial
 *
 * Executive Continuity Brief — Report Data Mapper
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
import type { AdaptiveReportAISlot, PersistedAdaptiveContext } from '../icra/adaptation';

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

  // Optional adaptive interpretation context. When supplied, the template
  // renders an "Adaptive Interpretation Context" page so report readers can
  // see the calibration applied to interpretation.
  adaptiveContext?: PersistedAdaptiveContext;

  // Optional AI-assisted narrative slot (doctrine: docs/oci/ai/).
  // Rendered as a clearly separated, disclosure-stamped section. Only
  // populated when an approved AI-assisted narrative exists. Renders as
  // null when absent. See docs/oci/ai/OCI_AI_AUGMENTATION_DOCTRINE.md.
  aiAssistedNarrative?: {
    readonly narrative: string;
    readonly auditRecordRef: string;
    readonly reviewStatus: 'approved';
    readonly locale: 'en-CA' | 'fr-CA';
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapper
// ─────────────────────────────────────────────────────────────────────────────

export interface MapToPdfReportDataOptions {
  readonly adaptiveContext?: PersistedAdaptiveContext | null;
  readonly adaptiveReportAISlot?: AdaptiveReportAISlot | null;
  readonly locale?: string;
}

function mapApprovedAdaptiveReportSlot(
  slot: AdaptiveReportAISlot | null | undefined,
): PdfReportData['aiAssistedNarrative'] {
  if (!slot || slot.reviewWorkflow.status !== 'approved') {
    return undefined;
  }

  const auditRef =
    slot.reviewWorkflow.auditTrail[slot.reviewWorkflow.auditTrail.length - 1]?.auditId
    ?? slot.reviewWorkflow.workflowId;

  const sections = [
    slot.narrative.headerStatement,
    ...slot.narrative.continuityContext,
    ...slot.executive.paragraphs,
  ].filter((section) => section.trim().length > 0);

  return {
    narrative: sections.join('\n\n'),
    auditRecordRef: auditRef,
    reviewStatus: 'approved',
    locale: slot.locale,
  };
}

export function mapToPdfReportData(
  profile: InstitutionalContinuityProfile,
  orgContext?: OrganizationContext | null,
  executiveStabilization?: ExecutiveStabilizationResult | null,
  options?: MapToPdfReportDataOptions,
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

    adaptiveContext: options?.adaptiveContext ?? undefined,
    aiAssistedNarrative: mapApprovedAdaptiveReportSlot(
      options?.adaptiveReportAISlot,
    ),
  };
}
