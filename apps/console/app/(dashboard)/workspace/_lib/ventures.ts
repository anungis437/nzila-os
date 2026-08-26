/**
 * Console workspace — venture/portfolio data loader.
 *
 * The workspace starts clean: no demo portfolio rows are projected into the
 * console surface until a real venture source is wired in.
 *
 * Shared by the Overview, Portfolio, and Ventures workspaces so directive logic
 * and maturity signals stay consistent across the surface.
 */

export interface CatalogProduct {
  id: string
  name: string
  status: string
  tier?: number
  type?: string
  description?: string
  strategic_role?: string
  value_prop?: string
  gtm_posture?: string
  revenue_status?: string
  priority?: string
  commercial_priority?: number
  code_presence?: string
  evidence_status?: string
  docs_entrypoint?: string
  customers?: number
  pilots?: number
  monthly_revenue?: number
  annual_recurring_revenue?: number
  pipeline_value?: number
  market_pull_score?: number
}

export type Directive = 'SELL NOW' | 'BUILD NEXT' | 'MAINTAIN' | 'HOLD' | 'CUT'
export type Maturity = 'Live' | 'Pilot' | 'Building' | 'Incubating' | 'Frozen'

/** Statuses that count as a live/active venture (not frozen or cut). */
const ACTIVE_STATUSES = new Set(['pilot', 'stable', 'internal', 'incubating'])

export interface VentureRow extends CatalogProduct {
  directive: Directive
  maturity: Maturity
}

export function resolveDirective(p: CatalogProduct): Directive {
  const posture = p.gtm_posture ?? ''
  if (p.status === 'frozen') return 'CUT'
  if (posture === 'sell-now' || p.status === 'pilot') return 'SELL NOW'
  if (p.status === 'incubating') return 'BUILD NEXT'
  if (p.status === 'stable' || p.status === 'internal') return 'MAINTAIN'
  return 'HOLD'
}

export function resolveMaturity(p: CatalogProduct): Maturity {
  switch (p.status) {
    case 'stable':
      return 'Live'
    case 'pilot':
      return 'Pilot'
    case 'internal':
      return 'Building'
    case 'incubating':
      return 'Incubating'
    case 'frozen':
      return 'Frozen'
    default:
      return 'Incubating'
  }
}

export function directiveTone(d: Directive): 'green' | 'blue' | 'gray' | 'amber' | 'red' {
  switch (d) {
    case 'SELL NOW':
      return 'green'
    case 'BUILD NEXT':
      return 'blue'
    case 'MAINTAIN':
      return 'gray'
    case 'HOLD':
      return 'amber'
    case 'CUT':
      return 'red'
  }
}

/** Load all ventures for the console workspace. Never throws. */
export function loadVentures(): VentureRow[] {
  return []
}

export interface PortfolioHealth {
  totalVentures: number
  activeVentures: number
  livePilots: number
  totalArr: number
  totalPipeline: number
  totalCustomers: number
  directiveCounts: Record<Directive, number>
  maturityCounts: Record<Maturity, number>
}

export function summarizePortfolio(rows: VentureRow[]): PortfolioHealth {
  const directiveCounts: Record<Directive, number> = {
    'SELL NOW': 0,
    'BUILD NEXT': 0,
    MAINTAIN: 0,
    HOLD: 0,
    CUT: 0,
  }
  const maturityCounts: Record<Maturity, number> = {
    Live: 0,
    Pilot: 0,
    Building: 0,
    Incubating: 0,
    Frozen: 0,
  }
  let activeVentures = 0
  let livePilots = 0
  let totalArr = 0
  let totalPipeline = 0
  let totalCustomers = 0

  for (const r of rows) {
    directiveCounts[r.directive] += 1
    maturityCounts[r.maturity] += 1
    if (ACTIVE_STATUSES.has(r.status)) activeVentures += 1
    livePilots += r.pilots ?? 0
    totalArr += r.annual_recurring_revenue ?? 0
    totalPipeline += r.pipeline_value ?? 0
    totalCustomers += r.customers ?? 0
  }

  return {
    totalVentures: rows.length,
    activeVentures,
    livePilots,
    totalArr,
    totalPipeline,
    totalCustomers,
    directiveCounts,
    maturityCounts,
  }
}

/** Strategic venture domains surfaced in the Ventures workspace (see Workspace Map §3). */
export interface VentureDomain {
  key: string
  name: string
  tagline: string
  productIds: string[]
}

export const VENTURE_DOMAINS: VentureDomain[] = [
  { key: 'union-eyes', name: 'Union Eyes', tagline: 'Labourtech wedge — pension, grievances, member analytics', productIds: ['union-eyes'] },
  { key: 'trustcore', name: 'TrustCore', tagline: 'Trust operations & accountability architecture', productIds: ['trustcore', 'trustcore-trustops'] },
  { key: 'institutional-intelligence', name: 'Institutional Intelligence', tagline: 'Market-validation observatory & assessments', productIds: [] },
  { key: 'health', name: 'Health', tagline: 'Veridian — care, site, and admin surfaces', productIds: ['veridian-site', 'veridian-care', 'veridian-admin'] },
  { key: 'civic', name: 'Civic', tagline: 'Future civic-sector vertical', productIds: [] },
  { key: 'education', name: 'Education', tagline: 'DRC national education & examination infrastructure (NACP)', productIds: ['nacp-exams'] },
]

export interface VentureDomainView extends VentureDomain {
  products: VentureRow[]
  status: 'active' | 'planned'
  arr: number
  pipeline: number
  customers: number
  pilots: number
  directive: Directive | null
}

export function buildVentureDomains(rows: VentureRow[]): VentureDomainView[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return VENTURE_DOMAINS.map((domain) => {
    const products = domain.productIds
      .map((id) => byId.get(id))
      .filter((p): p is VentureRow => Boolean(p))
    const arr = products.reduce((s, p) => s + (p.annual_recurring_revenue ?? 0), 0)
    const pipeline = products.reduce((s, p) => s + (p.pipeline_value ?? 0), 0)
    const customers = products.reduce((s, p) => s + (p.customers ?? 0), 0)
    const pilots = products.reduce((s, p) => s + (p.pilots ?? 0), 0)
    return {
      ...domain,
      products,
      status: products.length > 0 ? 'active' : 'planned',
      arr,
      pipeline,
      customers,
      pilots,
      directive: products[0]?.directive ?? null,
    }
  })
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${value}`
}
