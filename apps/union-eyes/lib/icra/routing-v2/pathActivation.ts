/**
 * Routing-v2 path activation evaluator.
 *
 * Closes audit Finding R-1 (the v1 routing engine was functionally
 * inert) by making the descriptive `activatedWhen` fields on
 * `ROUTING_PATHS` executable. Each path gets a deterministic predicate
 * that consumes a `PathActivationContext` (declared profile context +
 * accumulated v2 signals so far) and returns whether the path is live.
 *
 * Doctrine guarantees:
 *   - Activation is ADDITIVE: it only DEEPENS extraction by raising
 *     confidence floors / surfacing extra v2 modalities. It cannot
 *     suppress a question.
 *   - Predicates are deterministic and side-effect free.
 *   - When required signals are absent (refusal / not-yet-collected),
 *     the predicate returns `false` (conservative — never assume
 *     fragility without evidence).
 *   - This evaluator does NOT call into the v1 routing engine; it is
 *     a sibling layer consumed via `proposeBandDeepening()` by callers
 *     that already build a `RoutedQuestionBank`.
 */
import {
  ROUTING_PATHS,
  type RoutingPathDefinition,
  type RoutingPathId,
} from './pathTypes';

/**
 * Minimal, intentional surface of the inputs an activation predicate
 * can consume. Keep this narrow: every new field is a doctrinal
 * commitment that the routing layer relies on that signal.
 */
export interface PathActivationContext {
  /** Declared governance maturity (likert-style ordinal, 1..5). */
  readonly declaredGovernanceMaturity?: number;
  /** Interpretive-consistency aggregate (0..1) — from contradiction engine outputs. */
  readonly interpretiveConsistencySignal?: number;
  /** Lowest evidence ordinal observed across governance answers (0..5). */
  readonly governanceEvidenceOrdinal?: number;
  /** Whether any modernization-uncertainty marker is <= 2 on a 1..5 scale. */
  readonly modernizationUncertaintyTriggered?: boolean;
  /** Whether any confidence_marker was answered with an uncertainty marker. */
  readonly confidenceMarkerUncertaintyObserved?: boolean;
  /**
   * Continuity-distribution top-bin allocation percentage (0..100),
   * derived from continuity_distribution modality.
   */
  readonly continuityDistributionTopBinPct?: number;
  /** Whether topology extraction identified high-centrality clustering. */
  readonly topologyHighCentralityCluster?: boolean;
  /** Transition exposure tags collected so far. */
  readonly transitionExposureTags?: ReadonlyArray<
    'executive_leadership' | 'long_tenured_steward_role' | string
  >;
  /** Whether the organization declared a federation affiliation. */
  readonly federationAffiliationDeclared?: boolean;
  /** Governance model declared by the organization. */
  readonly governanceModel?: 'elected_board' | 'appointed_board' | 'hybrid' | 'other';
  /** Maximum contradiction-detection confidence observed across pairs (0..1). */
  readonly maxContradictionConfidence?: number;
}

export type RoutingPathPredicate = (ctx: PathActivationContext) => boolean;

/**
 * Per-path activation predicates. Each predicate mirrors the
 * `activatedWhen` clause on its `RoutingPathDefinition` exactly.
 *
 * Missing inputs always evaluate to `false` (conservative default).
 */
export const ROUTING_PATH_PREDICATES: Readonly<
  Record<RoutingPathId, RoutingPathPredicate>
> = {
  // declared governance maturity >= Structured (3)
  //   AND (interpretive_consistency_signal < 0.6
  //        OR evidence_strength_for_governance < OPERATIONAL (3))
  governance_fragility_path: (ctx) => {
    if ((ctx.declaredGovernanceMaturity ?? 0) < 3) return false;
    const consistencyLow =
      ctx.interpretiveConsistencySignal !== undefined &&
      ctx.interpretiveConsistencySignal < 0.6;
    const evidenceLow =
      ctx.governanceEvidenceOrdinal !== undefined &&
      ctx.governanceEvidenceOrdinal < 3;
    return consistencyLow || evidenceLow;
  },

  // transition_exposure includes long_tenured_steward_role
  //   OR modernization_uncertainty_marker <= 2
  modernization_fragility_path: (ctx) => {
    const stewardExposure =
      ctx.transitionExposureTags?.includes('long_tenured_steward_role') ?? false;
    return stewardExposure || ctx.modernizationUncertaintyTriggered === true;
  },

  // any confidence_marker answered with uncertainty marker
  confidence_escalation_path: (ctx) =>
    ctx.confidenceMarkerUncertaintyObserved === true,

  // continuity_distribution top-bin >= 50 OR topology high-centrality clustering
  continuity_dependency_path: (ctx) => {
    const concentrated =
      ctx.continuityDistributionTopBinPct !== undefined &&
      ctx.continuityDistributionTopBinPct >= 50;
    return concentrated || ctx.topologyHighCentralityCluster === true;
  },

  // federationAffiliation present OR governanceModel === hybrid
  federated_governance_path: (ctx) =>
    ctx.federationAffiliationDeclared === true ||
    ctx.governanceModel === 'hybrid',

  // transition_exposure includes executive_leadership OR long_tenured_steward_role
  onboarding_survivability_path: (ctx) => {
    const tags = ctx.transitionExposureTags;
    if (!tags || tags.length === 0) return false;
    return (
      tags.includes('executive_leadership') ||
      tags.includes('long_tenured_steward_role')
    );
  },

  // any contradiction_pair detected with confidence >= 0.5
  contradiction_resolution_path: (ctx) =>
    (ctx.maxContradictionConfidence ?? 0) >= 0.5,
};

/**
 * Evaluate all routing-v2 paths against the given context and return
 * the subset that are currently activated.
 */
export function evaluateRoutingPathActivations(
  ctx: PathActivationContext,
  paths: ReadonlyArray<RoutingPathDefinition> = ROUTING_PATHS,
): ReadonlyArray<RoutingPathId> {
  const out: RoutingPathId[] = [];
  for (const p of paths) {
    const predicate = ROUTING_PATH_PREDICATES[p.id];
    if (predicate(ctx)) out.push(p.id);
  }
  return out;
}

/**
 * Proposal returned by `proposeBandDeepening()`. The adaptive engine
 * MAY apply this proposal (always additively — never to demote a
 * question that was already included).
 */
export interface BandDeepeningProposal {
  questionId: string;
  reason: 'routing_v2_path_activation';
  /** Paths that triggered the deepening. */
  triggeringPaths: ReadonlyArray<RoutingPathId>;
  /**
   * Whether activation raises the question's confidence floor (i.e.
   * forces inclusion even if the band would normally defer it).
   */
  raisesConfidenceFloor: boolean;
}

/**
 * Decide whether a question carrying `pathDeepens` should be deepened
 * given the currently activated paths. Returns null when no overlap.
 *
 * ADDITIVE-ONLY contract: callers must treat the proposal as a hint to
 * INCLUDE-or-prioritize, never to suppress.
 */
export function proposeBandDeepening(
  questionId: string,
  pathDeepens: ReadonlyArray<RoutingPathId> | undefined,
  activatedPaths: ReadonlyArray<RoutingPathId>,
  paths: ReadonlyArray<RoutingPathDefinition> = ROUTING_PATHS,
): BandDeepeningProposal | null {
  if (!pathDeepens || pathDeepens.length === 0) return null;
  if (activatedPaths.length === 0) return null;
  const activatedSet = new Set(activatedPaths);
  const triggering: RoutingPathId[] = [];
  let raisesFloor = false;
  for (const id of pathDeepens) {
    if (!activatedSet.has(id)) continue;
    triggering.push(id);
    const def = paths.find((p) => p.id === id);
    if (def?.raisesConfidenceFloor) raisesFloor = true;
  }
  if (triggering.length === 0) return null;
  return {
    questionId,
    reason: 'routing_v2_path_activation',
    triggeringPaths: triggering,
    raisesConfidenceFloor: raisesFloor,
  };
}
