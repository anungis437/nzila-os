/**
 * ARTIFACT TYPE: Adaptive Context Reconstruction Engine
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE_VERSION: 1.0.0
 *
 * Canonical resolver for the adaptive context attached to an assessment.
 *
 * Resolution order (fail-closed to deterministic rerouting):
 *
 *   1. `persisted`        — `organizationContext._adaptive` present, shape
 *                           valid, route + question-bank versions match
 *                           current code → use as-is.
 *
 *   2. `reconstructed`    — persisted blob present and shape valid, BUT
 *                           current routeVersion or questionBankVersion has
 *                           drifted → re-run the classifier + router under
 *                           current versions, emit compatibility warnings,
 *                           keep persisted bands for audit trail.
 *
 *   3. `rerouted`         — no persisted blob, but declared
 *                           organizationContext is available → run the
 *                           classifier + router from scratch.
 *
 *   4. `safe_default`     — no persisted blob and no useful
 *                           organizationContext → produce a deterministic
 *                           safe-default routed bank so the surface remains
 *                           renderable. `fallbackUsed: true`.
 *
 * Pure & deterministic. No I/O. No PII pathway.
 */

import { classifyOrgContext } from './orgContextClassifier';
import { routeQuestionBank } from './questionRoutingEngine';
import { ROUTING_ENGINE_VERSION, type RoutableQuestion, type RoutedQuestionBank } from './routingTypes';
import {
  buildPersistedAdaptiveContext,
  extractPersistedAdaptiveContext,
  stripPersistedAdaptiveContext,
  type PersistedAdaptiveContext,
} from './persistedAdaptiveContext';

export type AdaptiveContextResolutionSource =
  | 'persisted'
  | 'reconstructed'
  | 'rerouted'
  | 'safe_default';

export interface AdaptiveContextResolution {
  readonly source: AdaptiveContextResolutionSource;
  readonly adaptiveContext: PersistedAdaptiveContext;
  readonly fallbackUsed: boolean;
  readonly compatibilityWarnings: readonly string[];
}

export interface ResolveAdaptiveContextInputs {
  /** The raw `organization_context` jsonb from the assessment row. */
  readonly organizationContext: unknown;
  /** The static OCRA question bank to route against. */
  readonly questionBank: readonly RoutableQuestion[];
  /** The current QUESTION_BANK_VERSION constant. */
  readonly currentQuestionBankVersion: number;
}

export function resolveAdaptiveContext(
  inputs: ResolveAdaptiveContextInputs,
): AdaptiveContextResolution {
  const { organizationContext, questionBank, currentQuestionBankVersion } = inputs;

  const persisted = extractPersistedAdaptiveContext(organizationContext);
  const declaredForm = stripPersistedAdaptiveContext(
    organizationContext as Record<string, unknown> | null,
  );
  const hasDeclaredForm = Object.keys(declaredForm).length > 0;

  // Path 1: persisted, shape valid, versions match → use as-is.
  if (persisted) {
    const routeMatches = persisted.routeVersion === ROUTING_ENGINE_VERSION;
    const bankMatches = persisted.questionBankVersion === currentQuestionBankVersion;
    if (routeMatches && bankMatches) {
      return {
        source: 'persisted',
        adaptiveContext: persisted,
        fallbackUsed: persisted.fallbackUsed,
        compatibilityWarnings: [],
      };
    }

    // Path 2: persisted but stale → reconstruct under current versions.
    if (hasDeclaredForm) {
      const profile = classifyOrgContext({ rawForm: declaredForm });
      const bank = routeQuestionBank(questionBank, profile);
      const adaptive = buildPersistedAdaptiveContext(
        profile,
        bank,
        currentQuestionBankVersion,
      );
      const warnings: string[] = [];
      if (!routeMatches) {
        warnings.push(
          `routeVersion drift: persisted=${persisted.routeVersion} current=${ROUTING_ENGINE_VERSION}`,
        );
      }
      if (!bankMatches) {
        warnings.push(
          `questionBankVersion drift: persisted=${persisted.questionBankVersion} current=${currentQuestionBankVersion}`,
        );
      }
      return {
        source: 'reconstructed',
        adaptiveContext: adaptive,
        fallbackUsed: adaptive.fallbackUsed,
        compatibilityWarnings: warnings,
      };
    }
    // Persisted is stale and no declared form → keep persisted as safest
    // available record and flag warnings.
    return {
      source: 'persisted',
      adaptiveContext: persisted,
      fallbackUsed: persisted.fallbackUsed,
      compatibilityWarnings: [
        !routeMatches
          ? `routeVersion drift: persisted=${persisted.routeVersion} current=${ROUTING_ENGINE_VERSION}`
          : '',
        !bankMatches
          ? `questionBankVersion drift: persisted=${persisted.questionBankVersion} current=${currentQuestionBankVersion}`
          : '',
      ].filter((s): s is string => s.length > 0),
    };
  }

  // Path 3: no persisted blob, but declared form exists → reroute.
  if (hasDeclaredForm) {
    const profile = classifyOrgContext({ rawForm: declaredForm });
    const bank = routeQuestionBank(questionBank, profile);
    const adaptive = buildPersistedAdaptiveContext(
      profile,
      bank,
      currentQuestionBankVersion,
    );
    return {
      source: 'rerouted',
      adaptiveContext: adaptive,
      fallbackUsed: adaptive.fallbackUsed,
      compatibilityWarnings: [],
    };
  }

  // Path 4: nothing available → safe default.
  const profile = classifyOrgContext({ rawForm: {} });
  const bank: RoutedQuestionBank = routeQuestionBank(questionBank, profile);
  const adaptive = buildPersistedAdaptiveContext(
    profile,
    bank,
    currentQuestionBankVersion,
  );
  return {
    source: 'safe_default',
    adaptiveContext: { ...adaptive, fallbackUsed: true },
    fallbackUsed: true,
    compatibilityWarnings: ['no_persisted_adaptive_context_and_no_declared_form'],
  };
}
