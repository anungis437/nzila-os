/**
 * ARTIFACT TYPE: Persisted Adaptive Context
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE_VERSION: 1.0.0
 *
 * Defines the LOW-RISK, AUDIT-SAFE shape of adaptive context persisted on
 * the assessment row alongside `organization_context` jsonb.
 *
 * STRICTLY persisted: low-cardinality bands + question-id sets + the
 * deterministic explainability snapshot. NEVER persisted: raw answers,
 * routing rationale prose, org names, free text, telemetry artifacts,
 * hidden scoring state, high-cardinality metadata.
 *
 * Lives under `organizationContext._adaptive` (reserved namespace) so we
 * avoid a schema migration. Forward-compatible: a future migration can
 * promote this blob to a first-class column without changing its shape.
 */

import type { InstitutionalAssessmentProfile } from './types';
import type { RoutedQuestionBank } from './routingTypes';
import {
  buildRoutingExplainabilitySnapshot,
  type RoutingExplainabilitySnapshot,
} from './routingExplainabilitySnapshot';

/** Reserved key inside `organizationContext` jsonb for the adaptive blob. */
export const PERSISTED_ADAPTIVE_KEY = '_adaptive' as const;

/** Doctrine version for the persisted shape itself (NOT the routing engine). */
export const PERSISTED_ADAPTIVE_SHAPE_VERSION = '1.0.0' as const;

export interface PersistedAdaptiveContext {
  readonly shapeVersion: '1.0.0';
  readonly routeVersion: string;
  readonly questionBankVersion: number;
  readonly profileBands: {
    readonly institutionalScale: string;
    readonly continuityComplexity: string;
    readonly governanceComplexity: string;
    readonly continuityExposure: string;
    readonly respondentLens: string;
  };
  /** Stable, sorted, deduped question ids in the routed (included) bank. */
  readonly includedQuestionIds: readonly string[];
  /** Stable, sorted, deduped question ids that were deferred. */
  readonly deferredQuestionIds: readonly string[];
  readonly fallbackUsed: boolean;
  readonly explainabilitySnapshot: RoutingExplainabilitySnapshot;
}

function sortedUniqueIds(ids: readonly { id: string }[]): readonly string[] {
  const seen = new Set<string>();
  for (const q of ids) seen.add(q.id);
  return Array.from(seen).sort();
}

/**
 * Build the persisted adaptive blob from a profile + routed bank. Pure,
 * deterministic, and side-effect-free.
 */
export function buildPersistedAdaptiveContext(
  profile: InstitutionalAssessmentProfile,
  bank: RoutedQuestionBank,
  questionBankVersion: number,
): PersistedAdaptiveContext {
  return {
    shapeVersion: PERSISTED_ADAPTIVE_SHAPE_VERSION,
    routeVersion: bank.routeVersion,
    questionBankVersion,
    profileBands: {
      institutionalScale: profile.institutionalScale,
      continuityComplexity: profile.continuityComplexity,
      governanceComplexity: profile.governanceComplexity,
      continuityExposure: profile.continuityExposure,
      respondentLens: profile.respondentLens,
    },
    includedQuestionIds: sortedUniqueIds(bank.includedQuestions),
    deferredQuestionIds: sortedUniqueIds(bank.deferredQuestions),
    fallbackUsed: bank.usedSafeDefault,
    explainabilitySnapshot: buildRoutingExplainabilitySnapshot(profile, bank),
  };
}

/**
 * Embed the adaptive blob into an organizationContext jsonb-shaped record
 * under the reserved `_adaptive` namespace. Returns a new object; never
 * mutates the input.
 */
export function embedPersistedAdaptiveContext(
  organizationContext: Record<string, unknown> | null | undefined,
  adaptive: PersistedAdaptiveContext,
): Record<string, unknown> {
  return {
    ...(organizationContext ?? {}),
    [PERSISTED_ADAPTIVE_KEY]: adaptive,
  };
}

/**
 * Extract the persisted adaptive blob from organizationContext jsonb, or
 * null if missing/malformed. Validates the shape minimally — anything that
 * fails validation returns null so callers fall through to reconstruction.
 */
export function extractPersistedAdaptiveContext(
  organizationContext: any,
): PersistedAdaptiveContext | null {
  if (!organizationContext || typeof organizationContext !== 'object') return null;
  const raw = (organizationContext as Record<string, unknown>)[PERSISTED_ADAPTIVE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<PersistedAdaptiveContext>;
  if (
    a.shapeVersion !== PERSISTED_ADAPTIVE_SHAPE_VERSION ||
    typeof a.routeVersion !== 'string' ||
    typeof a.questionBankVersion !== 'number' ||
    !a.profileBands ||
    typeof a.profileBands !== 'object' ||
    !Array.isArray(a.includedQuestionIds) ||
    !Array.isArray(a.deferredQuestionIds) ||
    typeof a.fallbackUsed !== 'boolean' ||
    !a.explainabilitySnapshot ||
    typeof a.explainabilitySnapshot !== 'object'
  ) {
    return null;
  }
  return a as PersistedAdaptiveContext;
}

/**
 * Return organizationContext with the `_adaptive` namespace stripped. Used
 * by callers (e.g. the classifier) that should only see declared form
 * inputs, never the derived adaptive blob.
 */
export function stripPersistedAdaptiveContext(
  organizationContext: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!organizationContext) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(organizationContext)) {
    if (k === PERSISTED_ADAPTIVE_KEY) continue;
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}
