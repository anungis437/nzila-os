/**
 * ARTIFACT TYPE: Drift Signals
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity destabilisation signals.
 *
 * A small, named set of signals reviewers can attach to a destabilisation
 * reading so the narrative remains reviewer-led rather than inferred.
 *
 * The signals are intentionally non-quantitative — they describe what the
 * reviewer observed institutionally, not what an algorithm scored.
 */

export const CONTINUITY_DESTABILIZATION_SIGNALS_VERSION = '1.0.0' as const;

export const CONTINUITY_DESTABILIZATION_SIGNAL_KINDS = [
  'fragmentation_evolution',
  'governance_survivability_erosion',
  'interpretation_volatility',
  'continuity_concentration_drift',
  'onboarding_deterioration',
  'continuity_destabilisation_pattern',
] as const;

export type ContinuityDestabilizationSignalKind =
  (typeof CONTINUITY_DESTABILIZATION_SIGNAL_KINDS)[number];

export interface ContinuityDestabilizationSignal {
  readonly signalId: string;
  readonly kind: ContinuityDestabilizationSignalKind;
  readonly observedAt: string; // ISO-8601
  readonly reviewerRefId: string;
  readonly note: string;
}

export function isKnownDestabilizationSignal(
  value: string,
): value is ContinuityDestabilizationSignalKind {
  return (CONTINUITY_DESTABILIZATION_SIGNAL_KINDS as ReadonlyArray<string>).includes(
    value,
  );
}
