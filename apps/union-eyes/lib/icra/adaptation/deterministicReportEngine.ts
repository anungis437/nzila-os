import { generateExecutiveSummary } from '@/lib/icra-pdf/reportNarrativeEngine';

import type { SupportedLocale } from './adaptivePassageLibrary';
import { buildAdaptiveNarrative } from './adaptiveNarrativeEngine';
import type { ContextualAssessmentResult } from './adaptiveScoringModel';
import type {
  AdaptiveReportAISlot,
  DeterministicReportContext,
  DisclosurePacket,
  ExecutiveSummaryPacket,
  FacilitatorPacket,
  NarrativeSynthesisPacket,
  ReviewRecord,
  ReviewWorkflowState,
  ReviewerRole,
  ReviewStatus,
  TranslationPacket,
} from './deterministicReportContracts';
import { DETERMINISTIC_REPORT_AI_VERSION } from './deterministicReportContracts';
import {
  assertSafeDeterministicText,
  assertSupportedLocale,
  stableDeterministicId,
} from './deterministicReportGuardrails';
import { validateAdaptiveReportAISlot, validateDeterministicReportContext } from './deterministicReportValidator';
import { buildFacilitatorGuide } from './facilitatorAdaptationGuide';
import type { RoutedQuestionBank } from './routingTypes';

function localeText(locale: SupportedLocale): TranslationPacket['labels'] {
  if (locale === 'fr-CA') {
    return {
      executiveSummary: 'Synthese executive de continuite',
      facilitatorGuide: 'Guide du facilitateur',
      disclosure: 'Divulgation IA deterministe',
      reviewRequired: 'Revision humaine obligatoire avant publication',
    };
  }
  return {
    executiveSummary: 'Executive continuity synthesis',
    facilitatorGuide: 'Facilitator guide',
    disclosure: 'Deterministic AI disclosure',
    reviewRequired: 'Human review required before release',
  };
}

export function buildDeterministicReportContext(input: {
  result: ContextualAssessmentResult;
  routed: RoutedQuestionBank | null;
  locale: SupportedLocale;
  generatedAt?: string;
}): DeterministicReportContext {
  assertSupportedLocale(input.locale);

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const context: DeterministicReportContext = Object.freeze({
    doctrineVersion: DETERMINISTIC_REPORT_AI_VERSION,
    generatedAt,
    locale: input.locale,
    contextualResult: input.result,
    adaptiveNarrative: buildAdaptiveNarrative(input.result, input.locale),
    facilitatorGuide: buildFacilitatorGuide(input.result, input.routed),
  });

  const issues = validateDeterministicReportContext(context);
  if (issues.length > 0) {
    throw new Error(`Invalid deterministic report context: ${issues.join('; ')}`);
  }

  return context;
}

export function synthesizeNarrativePacket(
  context: DeterministicReportContext,
): NarrativeSynthesisPacket {
  const continuityContext = [
    context.adaptiveNarrative.scaleOpener,
    context.adaptiveNarrative.governanceFraming,
    context.adaptiveNarrative.exposureFraming,
  ];

  if (context.adaptiveNarrative.respondentCaveat) {
    continuityContext.push(context.adaptiveNarrative.respondentCaveat);
  }

  continuityContext.forEach((line, idx) =>
    assertSafeDeterministicText(line, `narrative.continuityContext[${idx}]`),
  );

  return Object.freeze({
    packetId: stableDeterministicId('icra-narrative', [
      context.adaptiveNarrative.bundleFingerprint,
      context.generatedAt,
    ]),
    locale: context.locale,
    headerStatement: context.adaptiveNarrative.headerStatement,
    continuityContext,
    emphasisOrder: context.adaptiveNarrative.emphasisOrder,
  });
}

export function generateExecutiveSummaryPacket(
  context: DeterministicReportContext,
): ExecutiveSummaryPacket {
  const raw = context.contextualResult.rawProfile;
  const paragraphs = generateExecutiveSummary(
    raw.maturityBand,
    raw.composite,
    raw.dimensions,
    raw.insights ?? [],
    raw.burdenIndex,
  );

  paragraphs.forEach((line, idx) =>
    assertSafeDeterministicText(line, `executive.paragraphs[${idx}]`),
  );

  return Object.freeze({
    packetId: stableDeterministicId('icra-executive', [
      raw.assessmentId,
      String(raw.composite),
      context.locale,
    ]),
    title: localeText(context.locale).executiveSummary,
    maturityBand: raw.maturityBand.ociBandName,
    compositeScore: raw.composite,
    paragraphs,
  });
}

export function generateFacilitatorPacket(
  context: DeterministicReportContext,
): FacilitatorPacket {
  return Object.freeze({
    packetId: stableDeterministicId('icra-facilitator', [
      context.facilitatorGuide.profileBand,
      context.generatedAt,
    ]),
    profileBand: context.facilitatorGuide.profileBand,
    interpretationCautions: context.facilitatorGuide.interpretationCautions,
    adaptationDecisions: context.facilitatorGuide.adaptationDecisions,
  });
}

export function generateTranslationPacket(
  context: DeterministicReportContext,
): TranslationPacket {
  return Object.freeze({
    packetId: stableDeterministicId('icra-translation', [
      context.locale,
      context.adaptiveNarrative.bundleFingerprint,
    ]),
    locale: context.locale,
    labels: localeText(context.locale),
  });
}

export function generateDisclosurePacket(
  context: DeterministicReportContext,
): DisclosurePacket {
  const copy =
    context.locale === 'fr-CA'
      ? 'Ce rapport est genere par un moteur deterministe fonde sur des regles versionnees et un contexte institutionnel explicable. Aucune generation libre de texte n est utilisee; une validation humaine est obligatoire avant diffusion.'
      : 'This report is produced by a deterministic engine using versioned rules and explainable institutional context. No free-form generation is used; human validation is mandatory before distribution.';

  assertSafeDeterministicText(copy, 'disclosure.copy');

  return Object.freeze({
    packetId: stableDeterministicId('icra-disclosure', [
      context.contextualResult.rawProfile.assessmentId,
      context.locale,
    ]),
    isAIGenerated: true,
    generationMode: 'deterministic_template',
    doctrineVersion: context.doctrineVersion,
    confidenceClass: 'traceable',
    requiresHumanReview: true,
    disclosureCopy: copy,
  });
}

export function initializeReviewWorkflow(
  context: DeterministicReportContext,
): ReviewWorkflowState {
  const disclosure = generateDisclosurePacket(context);
  const workflowId = stableDeterministicId('icra-review', [
    context.contextualResult.rawProfile.assessmentId,
    context.generatedAt,
  ]);

  return Object.freeze({
    workflowId,
    status: 'pending_review' as const,
    disclosure,
    pendingChecklist: Object.freeze([
      'Verify adaptive profile rationale matches declared institutional inputs',
      'Verify executive summary uses doctrine-safe continuity language',
      'Verify no identifying details are present in generated packets',
      'Approve or reject with explicit governance rationale',
    ]),
    reviews: Object.freeze([]),
    auditTrail: Object.freeze([
      {
        auditId: stableDeterministicId('audit', [workflowId, 'init']),
        action: 'workflow_initialized' as const,
        at: context.generatedAt,
        actorRole: 'system' as const,
        details: {
          doctrineVersion: context.doctrineVersion,
          locale: context.locale,
        },
      },
    ]),
  });
}

export function recordReviewDecision(
  state: ReviewWorkflowState,
  input: {
    reviewerRole: ReviewerRole;
    status: Exclude<ReviewStatus, 'pending_review'>;
    summary: string;
    reviewedAt?: string;
  },
): ReviewWorkflowState {
  assertSafeDeterministicText(input.summary, 'review.summary');
  const reviewedAt = input.reviewedAt ?? new Date().toISOString();
  const review: ReviewRecord = {
    reviewId: stableDeterministicId('review', [state.workflowId, reviewedAt, input.status]),
    reviewerRole: input.reviewerRole,
    status: input.status,
    reviewedAt,
    summary: input.summary,
  };

  const action: 'report_approved' | 'report_rejected' =
    input.status === 'approved' ? 'report_approved' : 'report_rejected';

  return Object.freeze({
    ...state,
    status: input.status,
    reviews: Object.freeze([...state.reviews, review]),
    auditTrail: Object.freeze([
      ...state.auditTrail,
      {
        auditId: stableDeterministicId('audit', [state.workflowId, reviewedAt, action]),
        action: 'review_recorded' as const,
        at: reviewedAt,
        actorRole: input.reviewerRole,
        details: {
          reviewId: review.reviewId,
          status: input.status,
        },
      },
      {
        auditId: stableDeterministicId('audit', [state.workflowId, reviewedAt, 'final']),
        action,
        at: reviewedAt,
        actorRole: input.reviewerRole,
        details: {
          reviewId: review.reviewId,
        },
      },
    ]),
  });
}

export function composeAdaptiveReportAISlot(input: {
  context: DeterministicReportContext;
  reviewState?: ReviewWorkflowState;
}): AdaptiveReportAISlot {
  const narrative = synthesizeNarrativePacket(input.context);
  const executive = generateExecutiveSummaryPacket(input.context);
  const facilitator = generateFacilitatorPacket(input.context);
  const translation = generateTranslationPacket(input.context);
  const reviewWorkflow = input.reviewState ?? initializeReviewWorkflow(input.context);

  const slot: AdaptiveReportAISlot = Object.freeze({
    slotId: stableDeterministicId('icra-slot', [
      input.context.contextualResult.rawProfile.assessmentId,
      input.context.generatedAt,
    ]),
    enabled: true,
    doctrineVersion: input.context.doctrineVersion,
    integrationMode: 'deterministic_non_generative',
    locale: input.context.locale,
    narrative,
    executive,
    facilitator,
    translation,
    reviewWorkflow,
  });

  const issues = validateAdaptiveReportAISlot(slot);
  if (issues.length > 0) {
    throw new Error(`Invalid adaptive report AI slot: ${issues.join('; ')}`);
  }

  return slot;
}
