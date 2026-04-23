/**
 * @nzila/platform-growth-os — ICP seed segments
 *
 * Canonical Union Eyes ICP segments for the Canadian union market.
 * Tier A = highest conversion probability, Tier C = longer cycle / lower fit.
 *
 * These are bootstrapped at startup via `bootstrapIcpSegments()` if not yet stored.
 * Operator can override via enrichTargetOrg / createSegment.
 */
import { createSegment, listSegments } from './icp'
import type { IcpSegment } from './types'

const PLATFORM_SCOPE: IcpSegment['scope'] = {
  tenantId: 'nzila-os',
  orgId: 'platform',
  product: 'union-eyes',
}

const SEED_SEGMENTS: Omit<IcpSegment, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    scope: PLATFORM_SCOPE,
    label: 'Large Municipal — Tier A',
    description:
      'Large municipal unions (500–10,000 members) with complex grievance/arbitration workflows. ' +
      'Highest UE design fit; budget authority typically with elected executive board.',
    sectors: ['municipal'],
    minMembers: 500,
    maxMembers: null,
    minGovernanceComplexity: 0.6,
    tier: 'A',
    tierRationale:
      'Municipal unions have the highest grievance volume, steward networks, and documented case management needs. ' +
      'CUPE Local 416 (Toronto), CUPE Local 79 (Toronto) are prototypical.',
  },
  {
    scope: PLATFORM_SCOPE,
    label: 'Healthcare Union — Tier A',
    description:
      'Healthcare-sector unions with credential tracking, shift scheduling grievances, and high arbitration rates.',
    sectors: ['healthcare'],
    minMembers: 300,
    maxMembers: null,
    minGovernanceComplexity: 0.55,
    tier: 'A',
    tierRationale:
      'Healthcare unions face highest grievance complexity (patient care + labour rights). ' +
      'ONA, CUPE health locals, and SEIU Healthcare are prototypical.',
  },
  {
    scope: PLATFORM_SCOPE,
    label: 'Federal / Provincial Public Service — Tier A',
    description:
      'Federal or provincial public service unions with formal grievance adjudication, legislative compliance, and ' +
      'complex collective agreement structures.',
    sectors: ['federal', 'provincial'],
    minMembers: 200,
    maxMembers: null,
    minGovernanceComplexity: 0.6,
    tier: 'A',
    tierRationale:
      'CAPE-ACEP, PSAC locals, OPSEU operate in highly regulated environments with strong documentation need. ' +
      'Procurement cycles are longer but deal sizes are larger.',
  },
  {
    scope: PLATFORM_SCOPE,
    label: 'Education — Tier B',
    description:
      'Education sector unions (elementary, secondary, post-secondary). Seasonal governance cycles; moderate tech maturity.',
    sectors: ['education'],
    minMembers: 150,
    maxMembers: null,
    minGovernanceComplexity: 0.4,
    tier: 'B',
    tierRationale:
      'Good member engagement use case (teacher associations + faculty unions). ' +
      'Tech maturity is often low (spreadsheets). Budget cycles tied to school year.',
  },
  {
    scope: PLATFORM_SCOPE,
    label: 'Transit / Utilities — Tier B',
    description:
      'Transit and utilities unions with safety-critical grievances and shift-based member communication needs.',
    sectors: ['transit', 'utilities'],
    minMembers: 200,
    maxMembers: null,
    minGovernanceComplexity: 0.45,
    tier: 'B',
    tierRationale:
      'ATU locals, IBEW locals in utilities. Strong operations case but procurement takes longer. ' +
      'Often require IT security review before adoption.',
  },
  {
    scope: PLATFORM_SCOPE,
    label: 'Small Local — Tier C',
    description:
      'Smaller locals (<500 members, any sector) without dedicated staff rep infrastructure. ' +
      'Long sales cycle; lower pilot value. Include only with strong warm path.',
    sectors: ['municipal', 'healthcare', 'education', 'federal', 'provincial', 'transit', 'utilities', 'trades', 'hospitality', 'legal_professional', 'other'],
    minMembers: 0,
    maxMembers: 499,
    minGovernanceComplexity: 0,
    tier: 'C',
    tierRationale:
      'Smaller locals often lack budget authority and IT infrastructure for onboarding. ' +
      'Only pursue with a strong warm introduction or conference relationship.',
  },
]

/**
 * Idempotent bootstrap — writes seed segments if none exist yet.
 * Call at app startup or in a seed script.
 */
export function bootstrapIcpSegments(): IcpSegment[] {
  const existing = listSegments()
  if (existing.length > 0) return existing
  return SEED_SEGMENTS.map((s) => createSegment(s))
}
