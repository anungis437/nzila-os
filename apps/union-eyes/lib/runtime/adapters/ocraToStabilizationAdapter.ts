/**
 * ARTIFACT TYPE: OCRA → Stabilization Adapter (Product 3)
 * MODULE: runtime/adapters/ocraToStabilizationAdapter
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §7
 *
 * Translates a `ContextualAssessmentResult` into the smallest viable input
 * for the stabilization product (Product 3). The stabilization product
 * needs to know which continuity gaps are *operationally actionable* at
 * this institution's scale and exposure — not the full observation set.
 */

import type {
  ContextualAssessmentResult,
} from '@/lib/icra/adaptation';

export const STABILIZATION_HANDOFF_VERSION = '1.0.0' as const;
export type StabilizationHandoffVersion = typeof STABILIZATION_HANDOFF_VERSION;

export interface StabilizationActionable {
  readonly observationId: string;
  readonly category: string;
  readonly severity: string;
  readonly priority: 'immediate' | 'planned' | 'monitored';
}

export interface OcraStabilizationPayload {
  readonly handoffVersion: StabilizationHandoffVersion;
  readonly doctrineVersion: '1.0.0';
  readonly profileBand: string;
  readonly compositeSeverity: string;
  readonly actionables: readonly StabilizationActionable[];
  readonly stewardshipPostureHint:
    | 'rebuild_foundations'
    | 'stabilize_practice'
    | 'reinforce_resilience'
    | 'maintain_excellence';
}

function prioritizeByExposure(
  severity: string,
  exposure: string,
): StabilizationActionable['priority'] {
  if (severity === 'material') {
    if (exposure === 'mission_critical' || exposure === 'public_trust') {
      return 'immediate';
    }
    return 'planned';
  }
  if (severity === 'attention') {
    if (exposure === 'mission_critical') return 'planned';
    return 'monitored';
  }
  return 'monitored';
}

function postureHint(
  severity: string,
): OcraStabilizationPayload['stewardshipPostureHint'] {
  switch (severity) {
    case 'critical':
      return 'rebuild_foundations';
    case 'fragile':
      return 'stabilize_practice';
    case 'concerning':
      return 'stabilize_practice';
    case 'workable':
      return 'reinforce_resilience';
    case 'reassuring':
    default:
      return 'maintain_excellence';
  }
}

export function buildStabilizationPayload(
  result: ContextualAssessmentResult,
): OcraStabilizationPayload {
  const profile = result.institutionalProfile;
  const exposure = profile.continuityExposure;

  const actionables: StabilizationActionable[] = result.scaleAdjustedWarnings.map(
    (o) =>
      Object.freeze({
        observationId: o.id,
        category: o.category,
        severity: o.severity,
        priority: prioritizeByExposure(o.severity, exposure),
      }),
  );

  return Object.freeze({
    handoffVersion: STABILIZATION_HANDOFF_VERSION,
    doctrineVersion: '1.0.0' as const,
    profileBand: [
      profile.institutionalScale,
      profile.continuityComplexity,
      profile.governanceComplexity,
      profile.continuityExposure,
    ].join('|'),
    compositeSeverity: result.normalizedInterpretation.severity,
    actionables: Object.freeze(actionables),
    stewardshipPostureHint: postureHint(result.normalizedInterpretation.severity),
  });
}
