import type { SeedRng, SeedTime } from '../core/types'

const ORG_PREFIXES = [
  'Nzila', 'Sankofa', 'Baobab', 'Harambee', 'Ubuntu', 'Indaba', 'Ujamaa',
  'Kilima', 'Sahel', 'Atlas',
] as const

const ORG_SUFFIXES = [
  'Group', 'Holdings', 'Co-op', 'Union', 'Collective', 'Partners',
  'Industries', 'Logistics', 'Trading', 'Studio',
] as const

const SECTORS = [
  'public-sector', 'manufacturing', 'agriculture', 'retail', 'healthcare',
  'education', 'transport', 'finance', 'media', 'technology',
] as const

const REGIONS = [
  'eastus', 'westeurope', 'canadacentral', 'southafrica-north',
  'westafrica-cdo', 'northeurope',
] as const

export interface SyntheticOrganization {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly sector: string
  readonly region: string
  readonly memberCount: number
  readonly tier: 'starter' | 'growth' | 'enterprise'
  readonly createdAt: string
}

export function fakeOrganization(
  rng: SeedRng,
  time: SeedTime,
): SyntheticOrganization {
  const name = `${rng.pick(ORG_PREFIXES)} ${rng.pick(ORG_SUFFIXES)}`
  const id = rng.id('org')
  const slug = name.toLowerCase().replace(/\s+/g, '-') + '-' + id.slice(-4)
  const window = time.historyWindow()
  const ageDays = rng.intBetween(
    30,
    Math.max(60, Math.floor((window.end.getTime() - window.start.getTime()) / 86_400_000)),
  )
  const memberCount = rng.intBetween(25, 25_000)
  const tier: SyntheticOrganization['tier'] =
    memberCount > 5_000 ? 'enterprise' : memberCount > 500 ? 'growth' : 'starter'
  return {
    id,
    name,
    slug,
    sector: rng.pick(SECTORS),
    region: rng.pick(REGIONS),
    memberCount,
    tier,
    createdAt: time.daysAgo(ageDays).toISOString(),
  }
}

export function fakeOrganizations(
  rng: SeedRng,
  time: SeedTime,
  count: number,
): SyntheticOrganization[] {
  return Array.from({ length: count }, () => fakeOrganization(rng, time))
}
