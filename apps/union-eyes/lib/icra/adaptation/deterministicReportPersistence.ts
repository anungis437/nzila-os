import type { InstitutionalContinuityProfile } from '../types';

import { type SupportedLocale } from './adaptivePassageLibrary';
import { adaptScoring } from './adaptiveScoringModel';
import type { AdaptiveReportAISlot } from './deterministicReportContracts';
import { composeAdaptiveReportAISlot, buildDeterministicReportContext } from './deterministicReportEngine';
import { validateAdaptiveReportAISlot } from './deterministicReportValidator';
import { classifyOrgContext } from './orgContextClassifier';
import { stripPersistedAdaptiveContext } from './persistedAdaptiveContext';
import { routeQuestionBank } from './questionRoutingEngine';
import type { RoutableQuestion } from './routingTypes';
import { recordReviewDecision } from './deterministicReportEngine';
import type { ReviewerRole, ReviewStatus } from './deterministicReportContracts';

export const PERSISTED_ADAPTIVE_REPORT_AI_KEY = '_adaptiveReportAI' as const;

export function embedPersistedAdaptiveReportAISlot(
  organizationContext: Record<string, unknown> | null | undefined,
  slot: AdaptiveReportAISlot,
): Record<string, unknown> {
  return {
    ...(organizationContext ?? {}),
    [PERSISTED_ADAPTIVE_REPORT_AI_KEY]: slot,
  };
}

export function extractPersistedAdaptiveReportAISlot(
  organizationContext: unknown,
): AdaptiveReportAISlot | null {
  if (!organizationContext || typeof organizationContext !== 'object') {
    return null;
  }

  const raw = (organizationContext as Record<string, unknown>)[PERSISTED_ADAPTIVE_REPORT_AI_KEY];
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const slot = raw as AdaptiveReportAISlot;
  return validateAdaptiveReportAISlot(slot).length === 0 ? slot : null;
}

export function resolveAdaptiveReportAISlot(input: {
  rawProfile: InstitutionalContinuityProfile;
  organizationContext: unknown;
  questionBank: readonly RoutableQuestion[];
  locale: SupportedLocale;
  generatedAt?: string;
}): AdaptiveReportAISlot | null {
  const persisted = extractPersistedAdaptiveReportAISlot(input.organizationContext);
  if (persisted) {
    return persisted;
  }

  try {
    const institutionalProfile = classifyOrgContext({
      rawForm: stripPersistedAdaptiveContext(
        input.organizationContext as Record<string, unknown> | null | undefined,
      ),
    });
    const routed = routeQuestionBank(input.questionBank, institutionalProfile);
    const contextual = adaptScoring(input.rawProfile, institutionalProfile);
    const context = buildDeterministicReportContext({
      result: contextual,
      routed,
      locale: input.locale,
      generatedAt: input.generatedAt,
    });

    return composeAdaptiveReportAISlot({ context });
  } catch {
    return null;
  }
}

export function applyAdaptiveReportReviewDecision(
  slot: AdaptiveReportAISlot,
  input: {
    reviewerRole: ReviewerRole;
    status: Exclude<ReviewStatus, 'pending_review'>;
    summary: string;
    reviewedAt?: string;
  },
): AdaptiveReportAISlot {
  const reviewWorkflow = recordReviewDecision(slot.reviewWorkflow, input);
  const updated = {
    ...slot,
    reviewWorkflow,
  } satisfies AdaptiveReportAISlot;

  const issues = validateAdaptiveReportAISlot(updated);
  if (issues.length > 0) {
    throw new Error(`Invalid adaptive report slot after review: ${issues.join('; ')}`);
  }

  return updated;
}