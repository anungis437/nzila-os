/**
 * ARTIFACT TYPE: OCRA → Runtime Signal Adapter (Product 4)
 * MODULE: runtime/adapters/ocraRuntimeSignalAdapter
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §7
 *
 * Emits a compact, low-cardinality runtime signal envelope for Product 4
 * (Runtime Observability). The runtime layer uses this to decide which
 * continuity invariants to watch more closely for this institution.
 *
 * Every emitted field is enum-bounded or numeric. No identifiers, no PII.
 */

import type { ContextualAssessmentResult } from '@/lib/icra/adaptation';

export const RUNTIME_SIGNAL_VERSION = '1.0.0' as const;
export type RuntimeSignalVersion = typeof RUNTIME_SIGNAL_VERSION;

export interface OcraRuntimeSignal {
  readonly signalVersion: RuntimeSignalVersion;
  readonly doctrineVersion: '1.0.0';
  readonly emittedAtIso: string;
  readonly profileBand: string;
  readonly compositeSeverity: string;
  readonly watchInvariants: readonly string[];
  readonly suppressedInvariants: readonly string[];
}

/**
 * Mapping from emphasis dimension → runtime invariant ids. Static.
 */
const DIMENSION_TO_INVARIANTS: Record<string, readonly string[]> = {
  trust_debt: ['stewardship.relief_signal', 'stewardship.single_point_of_continuity'],
  institutional_continuity: [
    'continuity.successor_designation',
    'continuity.handover_kit_freshness',
  ],
  governance_fragility: [
    'governance.committee_decision_quorum',
    'governance.cross_unit_alignment',
  ],
  operational_memory: [
    'memory.documentation_freshness',
    'memory.runbook_coverage',
  ],
  transition_readiness: ['transition.readiness_window'],
};

/**
 * Invariants that should NEVER be watched at small/micro scale because they
 * presuppose enterprise infrastructure. Suppressed list is part of the
 * adapter's emitted contract — runtime can audit it.
 */
const SMALL_SCALE_SUPPRESSED: readonly string[] = [
  'governance.cross_unit_alignment',
  'memory.runbook_coverage',
];

export function buildRuntimeSignal(
  result: ContextualAssessmentResult,
  nowIso: string = new Date().toISOString(),
): OcraRuntimeSignal {
  const profile = result.institutionalProfile;
  const emphasisOrder = [...result.contextualEmphasis]
    .sort((a, b) => b.weight - a.weight)
    .map((e) => e.dimension);

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const dim of emphasisOrder) {
    for (const inv of DIMENSION_TO_INVARIANTS[dim] ?? []) {
      if (!seen.has(inv)) {
        seen.add(inv);
        candidates.push(inv);
      }
    }
  }

  const isSmallScale =
    profile.institutionalScale === 'micro' || profile.institutionalScale === 'small';
  const watch = isSmallScale
    ? candidates.filter((i) => !SMALL_SCALE_SUPPRESSED.includes(i))
    : candidates;
  const suppressed = isSmallScale
    ? candidates.filter((i) => SMALL_SCALE_SUPPRESSED.includes(i))
    : [];

  return Object.freeze({
    signalVersion: RUNTIME_SIGNAL_VERSION,
    doctrineVersion: '1.0.0' as const,
    emittedAtIso: nowIso,
    profileBand: [
      profile.institutionalScale,
      profile.continuityComplexity,
      profile.governanceComplexity,
      profile.continuityExposure,
    ].join('|'),
    compositeSeverity: result.normalizedInterpretation.severity,
    watchInvariants: Object.freeze(watch),
    suppressedInvariants: Object.freeze(suppressed),
  });
}
