/**
 * ARTIFACT TYPE: Routing Types
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §5, OCRA_DYNAMIC_QUESTIONNAIRE_MODEL.md §4
 */

import type { AdaptationPurpose, AdaptiveRules, AdaptiveWeight } from './types';

export const ROUTING_ENGINE_VERSION = '1.0.0' as const;
export type RoutingEngineVersion = typeof ROUTING_ENGINE_VERSION;

/**
 * Optional adaptive metadata attached to a question. A question with NO
 * adaptive metadata is treated as `core` and always included — guaranteeing
 * back-compatibility while the question bank is incrementally annotated.
 */
export interface QuestionAdaptiveMetadata {
  readonly weight?: AdaptiveWeight;
  readonly purpose?: AdaptationPurpose;
  readonly rules?: AdaptiveRules;
}

/** Minimum shape the routing engine needs to operate on any question. */
export interface RoutableQuestion {
  readonly id: string;
  readonly section: string;
  readonly order: number;
  /** Optional adaptive metadata. Absence ⇒ core question. */
  readonly adaptive?: QuestionAdaptiveMetadata;
}

/**
 * Decision recorded per question. Audit-grade: explains every inclusion and
 * every deferral with the rule that fired.
 */
export interface RoutingRationale {
  readonly questionId: string;
  readonly decision: 'include_core' | 'include_required' | 'include_recommended'
    | 'include_contextual' | 'defer_suppressed' | 'defer_out_of_scope'
    | 'defer_complexity_floor' | 'defer_complexity_ceiling';
  readonly ruleId: string;
  readonly statement: string;
}

/**
 * The output of the routing engine. Order of `includedQuestions` is the
 * recommended presentation order (priority sort).
 */
export interface RoutedQuestionBank {
  readonly doctrineVersion: '1.0.0';
  readonly routeVersion: RoutingEngineVersion;
  readonly includedQuestions: readonly RoutableQuestion[];
  readonly deferredQuestions: readonly RoutableQuestion[];
  readonly requiredQuestions: readonly RoutableQuestion[];
  readonly optionalContextQuestions: readonly RoutableQuestion[];
  readonly routingRationale: readonly RoutingRationale[];
  /**
   * True iff routing refused to narrow the bank (safe-default fallback).
   * Downstream telemetry should record this prominently.
   */
  readonly usedSafeDefault: boolean;
  /**
   * Stable, low-cardinality fingerprint of the routed selection — useful for
   * cache keys and aggregate telemetry. Never contains PII.
   */
  readonly selectionFingerprint: string;
}

/** Configuration knobs (with conservative defaults). */
export interface RoutingOptions {
  /**
   * Minimum number of scored questions that must remain included; falling
   * below this threshold triggers the safe-default fallback (full bank).
   * Default: 18.
   */
  readonly minIncludedQuestions?: number;
}

export const DEFAULT_ROUTING_OPTIONS: Required<RoutingOptions> = {
  minIncludedQuestions: 18,
};
