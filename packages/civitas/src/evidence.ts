/**
 * Evidence hierarchy over the existing decision-engine evidence reference.
 * CIVITAS does not create an evidence store. A material conclusion keeps
 * the provenance of the references that support it.
 *
 * Tier 4 is discovery only. It cannot independently establish a material
 * legal proposition. Current law and law-on-a-date stay distinct.
 */
import type { EvidenceRef } from '@nzila/platform-decision-engine/types'

export type EvidenceTier = 1 | 2 | 3 | 4

export type Currentness = 'CURRENTLY_VERIFIED' | 'LAW_ON_DATE' | 'UNVERIFIED'

export type EpistemicLabel =
  | 'FACT'
  | 'INFERENCE'
  | 'ASSUMPTION'
  | 'UNRESOLVED'
  | 'PROFESSIONAL_DETERMINATION_REQUIRED'

export interface TemporalValidity {
  readonly lawAsOf: string
  readonly verifiedAsOf: string | null
  readonly currentness: Currentness
}

export interface CivitasEvidence {
  readonly ref: EvidenceRef
  readonly tier: EvidenceTier
  readonly propositionId: string
  readonly temporal: TemporalValidity
}

export const EVIDENCE_TIER_RULES = [
  {
    tier: 1 as const,
    name: 'Primary and binding',
    examples: [
      'Constitution',
      'statutes',
      'regulations',
      'codes',
      'official legislative publications',
      'Supreme Court of Canada',
      'applicable appellate courts',
      'applicable superior courts',
    ],
    canSupportMaterialProposition: true,
  },
  {
    tier: 2 as const,
    name: 'Official interpretation',
    examples: [
      'Justice Canada',
      'Canada Revenue Agency',
      'Revenu Québec',
      'Corporations Canada',
      'Registraire des entreprises',
      'Office of the Privacy Commissioner of Canada',
      'Commission d\'accès à l\'information',
      'other regulators',
    ],
    canSupportMaterialProposition: true,
  },
  {
    tier: 3 as const,
    name: 'Persuasive professional',
    examples: ['professional commentary', 'treatise', 'professional opinion offered as persuasion'],
    canSupportMaterialProposition: true,
  },
  {
    tier: 4 as const,
    name: 'Discovery only',
    examples: ['blogs', 'forums', 'social media', 'video'],
    canSupportMaterialProposition: false,
  },
] as const

export interface PropositionSupport {
  readonly established: boolean
  readonly reason:
    | 'SUPPORTED'
    | 'TIER_4_CANNOT_ESTABLISH'
    | 'NO_PROVENANCE'
    | 'UNVERIFIED'
    | 'CURRENTNESS_UNPROVEN'
    | 'NO_SUPPORTING_EVIDENCE'
  readonly epistemicLabel: EpistemicLabel
  readonly provenance: readonly EvidenceRef[]
  readonly advisoryOnly: true
  readonly lawAsOf: string | null
  readonly currentlyVerified: boolean
}

function hasProvenance(item: CivitasEvidence): boolean {
  return item.ref.ref_id.trim().length > 0
}

function temporalAllowsSupport(item: CivitasEvidence): PropositionSupport['reason'] | 'OK' {
  if (item.temporal.currentness === 'UNVERIFIED') return 'UNVERIFIED'
  if (!item.temporal.lawAsOf.trim()) return 'UNVERIFIED'
  if (item.temporal.currentness === 'CURRENTLY_VERIFIED' && !item.temporal.verifiedAsOf) {
    return 'CURRENTNESS_UNPROVEN'
  }
  return 'OK'
}

/**
 * A material proposition is supported only by tier 1–3 evidence with provenance
 * and an explicit temporal claim. Tier 4 is ignored for establishment.
 * Support is still advisory: the agent does not issue a binding determination.
 */
export function supportForProposition(
  evidence: readonly CivitasEvidence[],
  propositionId: string,
): PropositionSupport {
  const related = evidence.filter((item) => item.propositionId === propositionId)
  const independent = related.filter((item) => item.tier < 4)
  const provenance = independent.filter(hasProvenance).map((item) => item.ref)

  if (related.length > 0 && independent.length === 0) {
    return {
      established: false,
      reason: 'TIER_4_CANNOT_ESTABLISH',
      epistemicLabel: 'UNRESOLVED',
      provenance: [],
      advisoryOnly: true,
      lawAsOf: null,
      currentlyVerified: false,
    }
  }

  if (independent.length === 0) {
    return {
      established: false,
      reason: 'NO_SUPPORTING_EVIDENCE',
      epistemicLabel: 'UNRESOLVED',
      provenance: [],
      advisoryOnly: true,
      lawAsOf: null,
      currentlyVerified: false,
    }
  }

  if (independent.some((item) => !hasProvenance(item))) {
    return {
      established: false,
      reason: 'NO_PROVENANCE',
      epistemicLabel: 'UNRESOLVED',
      provenance: [],
      advisoryOnly: true,
      lawAsOf: null,
      currentlyVerified: false,
    }
  }

  for (const item of independent) {
    const temporal = temporalAllowsSupport(item)
    if (temporal !== 'OK') {
      return {
        established: false,
        reason: temporal,
        epistemicLabel: 'UNRESOLVED',
        provenance: [],
        advisoryOnly: true,
        lawAsOf: null,
        currentlyVerified: false,
      }
    }
  }

  const currentlyVerified = independent.every(
    (item) => item.temporal.currentness === 'CURRENTLY_VERIFIED' && Boolean(item.temporal.verifiedAsOf),
  )
  const lawAsOf = independent[0]?.temporal.lawAsOf ?? null

  return {
    established: true,
    reason: 'SUPPORTED',
    epistemicLabel: 'INFERENCE',
    provenance,
    advisoryOnly: true,
    lawAsOf,
    currentlyVerified,
  }
}
