/**
 * @nzila/governance-operations — Role model
 *
 * Stakeholder-scoped visibility map. Determines which surfaces are
 * visible to a stakeholder kind. Restrictions are doctrine-bound.
 *
 * @module @nzila/governance-operations/role-model
 */

export const STAKEHOLDER_KINDS = [
  'executive',
  'governance-officer',
  'pilot-operator',
  'continuity-reviewer',
  'deployment-reviewer',
  'auditor',
  'procurement-observer',
] as const
export type StakeholderKind = (typeof STAKEHOLDER_KINDS)[number]

export const SURFACES = [
  'posture-cards',
  'continuity-band',
  'attestation-summary',
  'attestation-viewer',
  'evidence-explorer',
  'evidence-explorer-full',
  'deployment-legitimacy-summary',
  'deployment-legitimacy-panels',
  'release-lineage',
  'environment-integrity',
  'governance-timeline',
  'pilot-posture',
  'pilot-attestations',
  'production-posture',
  'continuity-evidence',
  'stabilization-signals',
  'executive-review-workflows',
  'governance-review-workflows',
  'pilot-review-workflows',
  'modernization-pacing',
  'external-attestation-bundle',
] as const
export type GovernanceSurface = (typeof SURFACES)[number]

const VISIBILITY: Readonly<Record<StakeholderKind, ReadonlySet<GovernanceSurface>>> = {
  executive: new Set<GovernanceSurface>([
    'posture-cards',
    'continuity-band',
    'attestation-summary',
    'deployment-legitimacy-summary',
    'modernization-pacing',
    'executive-review-workflows',
  ]),
  'governance-officer': new Set<GovernanceSurface>([
    'posture-cards',
    'continuity-band',
    'attestation-summary',
    'attestation-viewer',
    'evidence-explorer',
    'deployment-legitimacy-summary',
    'deployment-legitimacy-panels',
    'release-lineage',
    'environment-integrity',
    'governance-timeline',
    'continuity-evidence',
    'stabilization-signals',
    'governance-review-workflows',
    'pilot-review-workflows',
    'modernization-pacing',
  ]),
  'pilot-operator': new Set<GovernanceSurface>([
    'pilot-posture',
    'pilot-attestations',
    'deployment-legitimacy-summary',
    'governance-timeline',
    'pilot-review-workflows',
  ]),
  'continuity-reviewer': new Set<GovernanceSurface>([
    'continuity-band',
    'continuity-evidence',
    'stabilization-signals',
    'modernization-pacing',
  ]),
  'deployment-reviewer': new Set<GovernanceSurface>([
    'deployment-legitimacy-summary',
    'deployment-legitimacy-panels',
    'release-lineage',
    'environment-integrity',
    'attestation-viewer',
  ]),
  auditor: new Set<GovernanceSurface>([
    'evidence-explorer-full',
    'attestation-viewer',
    'release-lineage',
    'environment-integrity',
    'governance-timeline',
  ]),
  'procurement-observer': new Set<GovernanceSurface>([
    'external-attestation-bundle',
  ]),
}

export function isSurfaceVisible(
  stakeholder: StakeholderKind,
  surface: GovernanceSurface,
): boolean {
  return VISIBILITY[stakeholder].has(surface)
}

export function visibleSurfaces(
  stakeholder: StakeholderKind,
): readonly GovernanceSurface[] {
  return [...VISIBILITY[stakeholder]]
}
