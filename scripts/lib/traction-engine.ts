import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

import { findRepoRoot } from './portfolio-governance'
import { loadCatalog } from './portfolio-governance'

export type CommercialMotion = 'founder_led' | 'direct_sales' | 'partner_channel' | 'self_serve' | 'enterprise_rfp' | 'grant_funded'
export type ProofStage = 'none' | 'interest' | 'demo' | 'pilot' | 'paid_pilot' | 'contracted' | 'expanding'
export type OpportunityStage = 'lead' | 'qualified' | 'meeting' | 'demo' | 'proposal' | 'legal' | 'close_won' | 'close_lost'
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface CommercialCatalogProduct {
  id: string
  name: string
  tier: 1 | 2 | 3 | 4 | 5
  commercial_motion: CommercialMotion
  avg_deal_size: number
  sales_cycle_days: number
  close_rate_pct: number
  renewal_rate_pct: number
  expansion_rate_pct: number
  gross_logo_target_12m: number
  primary_buyer: string
  proof_stage: ProofStage
  market_pull_score: number
}

export interface Opportunity {
  id: string
  account: string
  product: string
  stage: OpportunityStage
  value: number
  probability: number
  next_step: string
  owner: string
  days_open: number
  risk: string
  commercial_motion: CommercialMotion
  expected_close_date: string
  source: string
  confidence: Confidence
}

export interface Pilot {
  id: string
  account: string
  product: string
  start_date: string
  sponsor_strength: number
  users_active: number
  weekly_engagement: number
  business_pain_solved: number
  paid_likelihood_pct: number
  expansion_value: number
  procurement_path_defined: boolean
  source: string
  confidence: Confidence
}

export interface FounderActivity {
  id: string
  lane: string
  activity: string
  hours: number
  pipeline_created: number
  revenue_closed: number
  owner: string
  source: string
  confidence: Confidence
}

export interface RetentionAccount {
  account: string
  product: string
  arr: number
  usage_score: number
  sponsor_silence_days: number
  unpaid_invoices: number
  support_burden: number
  exec_engagement: boolean
  source: string
  confidence: Confidence
}

export interface ConnectorStatus {
  connector: string
  enabled: boolean
  status: 'disabled' | 'unavailable' | 'available'
  note: string
}

export interface ForecastBucket {
  horizon_days: 30 | 60 | 90
  expected_closes: number
  weighted_pipeline: number
  likely_bookings: number
  by_product: Array<{ product: string; weighted: number; likely: number }>
  by_motion: Array<{ motion: CommercialMotion; weighted: number; likely: number }>
}

export interface PilotConversionView extends Pilot {
  conversion_score: number
  classification: 'likely to convert' | 'at risk' | 'dead pilot walking'
}

export interface FounderRoiView extends FounderActivity {
  roi: number
}

export interface MarketPullView {
  product: string
  pull_score: number
  classification: 'strong pull' | 'emerging pull' | 'founder-pushed' | 'no pull yet'
  drivers: string[]
}

export interface RetentionRiskView extends RetentionAccount {
  risk_score: number
  risk_level: 'high' | 'medium' | 'low'
  saves: string[]
}

export interface CommercialAlert {
  severity: 'critical' | 'high' | 'medium'
  message: string
}

export interface TractionOutputs {
  asOfDate: string
  products: CommercialCatalogProduct[]
  opportunities: Opportunity[]
  pilots: PilotConversionView[]
  founderActivities: FounderRoiView[]
  marketPull: MarketPullView[]
  retentionRisk: RetentionRiskView[]
  forecast: ForecastBucket[]
  alerts: CommercialAlert[]
  topDealsToWinNow: Opportunity[]
  weakestFunnelLeak: string
  productSalesFocusNow: string
  connectorStatus: ConnectorStatus[]
}

const COMMERCIAL_OPPORTUNITIES_PATH = 'governance/commercial/opportunities.json'
const COMMERCIAL_PILOTS_PATH = 'governance/commercial/pilots.json'
const COMMERCIAL_FOUNDER_ACTIVITIES_PATH = 'governance/commercial/founder-activities.json'
const COMMERCIAL_RETENTION_PATH = 'governance/commercial/retention-accounts.json'

const STAGE_WEIGHTS: Record<OpportunityStage, number> = {
  lead: 0.08,
  qualified: 0.2,
  meeting: 0.3,
  demo: 0.4,
  proposal: 0.55,
  legal: 0.8,
  close_won: 1,
  close_lost: 0,
}

function safeJoinWithinRoot(root: string, ...segments: string[]): string | null {
  const resolvedRoot = resolve(root)
  const candidate = resolve(resolvedRoot, ...segments)
  if (candidate === resolvedRoot || candidate.startsWith(`${resolvedRoot}${sep}`)) {
    return candidate
  }
  return null
}

function readJsonFromSafePath<T>(safePath: string | null, fallback: T): T {
  if (!safePath || !existsSync(safePath)) return fallback
  return JSON.parse(readFileSync(safePath, 'utf8')) as T
}

function readCsvFromSafePath(safePath: string | null): Record<string, string>[] {
  if (!safePath || !existsSync(safePath)) return []
  return parseCsv(readFileSync(safePath, 'utf8'))
}

function envEnabled(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase())
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []
  const headers = lines[0].split(',').map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? '').trim()
    })
    return record
  })
}

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toBool(value: string | boolean | undefined, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
  return fallback
}

function parseConfidence(value: string | undefined, fallback: Confidence): Confidence {
  const normalized = String(value ?? '').toUpperCase()
  if (normalized === 'HIGH' || normalized === 'MEDIUM' || normalized === 'LOW') return normalized
  return fallback
}

function parseMotion(value: string | undefined, fallback: CommercialMotion): CommercialMotion {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'founder_led' || normalized === 'direct_sales' || normalized === 'partner_channel' || normalized === 'self_serve' || normalized === 'enterprise_rfp' || normalized === 'grant_funded') {
    return normalized
  }
  return fallback
}

function parseStage(value: string | undefined, fallback: OpportunityStage): OpportunityStage {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'lead' || normalized === 'qualified' || normalized === 'meeting' || normalized === 'demo' || normalized === 'proposal' || normalized === 'legal' || normalized === 'close_won' || normalized === 'close_lost') {
    return normalized
  }
  return fallback
}

function parseProof(value: string | undefined, fallback: ProofStage): ProofStage {
  const normalized = String(value ?? '').toLowerCase()
  if (normalized === 'none' || normalized === 'interest' || normalized === 'demo' || normalized === 'pilot' || normalized === 'paid_pilot' || normalized === 'contracted' || normalized === 'expanding') {
    return normalized
  }
  return fallback
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  const diffMs = to.getTime() - from.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function datePlusDays(base: string, days: number): string {
  const date = new Date(base)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function buildCommercialProducts(root: string): CommercialCatalogProduct[] {
  const catalog = loadCatalog(root) as { products: Array<Record<string, unknown>> }

  return catalog.products.map((product) => {
    const id = String(product.id)
    const defaultMotion: CommercialMotion = id === 'union-eyes'
      ? 'enterprise_rfp'
      : id === 'flow'
        ? 'direct_sales'
        : id === 'cfo'
          ? 'founder_led'
          : product.tier === 4 || product.tier === 5
            ? 'grant_funded'
            : 'direct_sales'

    const fallbackProof: ProofStage = id === 'union-eyes'
      ? 'pilot'
      : id === 'flow'
        ? 'demo'
        : id === 'cfo'
          ? 'interest'
          : product.tier === 5
            ? 'none'
            : 'interest'

    return {
      id,
      name: String(product.name),
      tier: Number(product.tier) as 1 | 2 | 3 | 4 | 5,
      commercial_motion: parseMotion(String(product.commercial_motion ?? ''), defaultMotion),
      avg_deal_size: toNumber(product.avg_deal_size, id === 'union-eyes' ? 65000 : id === 'flow' ? 32000 : 22000),
      sales_cycle_days: toNumber(product.sales_cycle_days, id === 'union-eyes' ? 90 : id === 'flow' ? 45 : 70),
      close_rate_pct: toNumber(product.close_rate_pct, id === 'flow' ? 28 : 22),
      renewal_rate_pct: toNumber(product.renewal_rate_pct, 82),
      expansion_rate_pct: toNumber(product.expansion_rate_pct, 24),
      gross_logo_target_12m: toNumber(product.gross_logo_target_12m, product.tier === 1 ? 8 : product.tier === 2 ? 5 : 2),
      primary_buyer: String(product.primary_buyer ?? (id === 'union-eyes' ? 'Executive Director' : id === 'flow' ? 'Operations Lead' : 'Finance Director')),
      proof_stage: parseProof(String(product.proof_stage ?? ''), fallbackProof),
      market_pull_score: toNumber(product.market_pull_score, id === 'union-eyes' ? 7 : id === 'flow' ? 6 : 4),
    }
  })
}

function loadConnectorRows(root: string): { opportunities: Opportunity[]; founderActivities: FounderActivity[]; retention: RetentionAccount[]; statuses: ConnectorStatus[] } {
  const statuses: ConnectorStatus[] = []

  const hubs: Opportunity[] = []
  const gmail: Opportunity[] = []
  const founder: FounderActivity[] = []
  const retention: RetentionAccount[] = []

  const connectorConfigs = [
    {
      connector: 'HubSpot',
      enableVar: 'COMMERCIAL_ENABLE_HUBSPOT',
      pathVar: 'COMMERCIAL_HUBSPOT_EXPORT_PATH',
      defaultPath: 'governance/commercial/exports/hubspot-opportunities.csv',
      consume: (rows: Record<string, string>[]) => {
        for (const row of rows) {
          hubs.push({
            id: row.opportunity_id || `hubspot-${row.account}-${row.product}`,
            account: row.account,
            product: row.product,
            stage: parseStage(row.stage, 'qualified'),
            value: toNumber(row.value),
            probability: toNumber(row.probability, 0) > 1 ? toNumber(row.probability, 0) / 100 : toNumber(row.probability, 0),
            next_step: row.next_step || 'follow up',
            owner: row.owner || 'unassigned',
            days_open: toNumber(row.days_open),
            risk: row.risk || 'unspecified',
            commercial_motion: parseMotion(row.commercial_motion, 'direct_sales'),
            expected_close_date: row.expected_close_date || datePlusDays(new Date().toISOString().slice(0, 10), 45),
            source: row.source || 'HubSpot export',
            confidence: parseConfidence(row.confidence, 'HIGH'),
          })
        }
      },
    },
    {
      connector: 'Gmail',
      enableVar: 'COMMERCIAL_ENABLE_GMAIL',
      pathVar: 'COMMERCIAL_GMAIL_EXPORT_PATH',
      defaultPath: 'governance/commercial/exports/gmail-opportunities.csv',
      consume: (rows: Record<string, string>[]) => {
        for (const row of rows) {
          gmail.push({
            id: row.opportunity_id || `gmail-${row.account}-${row.product}`,
            account: row.account,
            product: row.product,
            stage: parseStage(row.stage, 'lead'),
            value: toNumber(row.value),
            probability: toNumber(row.probability, 0) > 1 ? toNumber(row.probability, 0) / 100 : toNumber(row.probability, 0),
            next_step: row.next_step || 'follow up',
            owner: row.owner || 'Founder',
            days_open: toNumber(row.days_open),
            risk: row.risk || 'email-only signal',
            commercial_motion: parseMotion(row.commercial_motion, 'founder_led'),
            expected_close_date: row.expected_close_date || datePlusDays(new Date().toISOString().slice(0, 10), 60),
            source: row.source || 'Gmail export',
            confidence: parseConfidence(row.confidence, 'MEDIUM'),
          })
        }
      },
    },
    {
      connector: 'Google Calendar',
      enableVar: 'COMMERCIAL_ENABLE_CALENDAR',
      pathVar: 'COMMERCIAL_CALENDAR_EXPORT_PATH',
      defaultPath: 'governance/commercial/exports/calendar-founder-activities.csv',
      consume: (rows: Record<string, string>[]) => {
        for (const row of rows) {
          founder.push({
            id: row.id || `calendar-${row.activity}-${row.owner}`,
            lane: row.lane || 'unknown',
            activity: row.activity || 'meeting',
            hours: toNumber(row.hours),
            pipeline_created: toNumber(row.pipeline_created),
            revenue_closed: toNumber(row.revenue_closed),
            owner: row.owner || 'Founder',
            source: row.source || 'Google Calendar export',
            confidence: parseConfidence(row.confidence, 'MEDIUM'),
          })
        }
      },
    },
    {
      connector: 'Stripe',
      enableVar: 'COMMERCIAL_ENABLE_STRIPE',
      pathVar: 'COMMERCIAL_STRIPE_EXPORT_PATH',
      defaultPath: 'governance/commercial/exports/stripe-bookings.csv',
      consume: (rows: Record<string, string>[]) => {
        for (const row of rows) {
          retention.push({
            account: row.account,
            product: row.product,
            arr: toNumber(row.arr),
            usage_score: 75,
            sponsor_silence_days: 0,
            unpaid_invoices: 0,
            support_burden: 2,
            exec_engagement: true,
            source: row.source || 'Stripe export',
            confidence: parseConfidence(row.confidence, 'HIGH'),
          })
        }
      },
    },
    {
      connector: 'QuickBooks',
      enableVar: 'COMMERCIAL_ENABLE_QUICKBOOKS',
      pathVar: 'COMMERCIAL_QUICKBOOKS_EXPORT_PATH',
      defaultPath: 'governance/commercial/exports/quickbooks-retention.csv',
      consume: (rows: Record<string, string>[]) => {
        for (const row of rows) {
          retention.push({
            account: row.account,
            product: row.product,
            arr: toNumber(row.arr),
            usage_score: toNumber(row.usage_score, 50),
            sponsor_silence_days: toNumber(row.sponsor_silence_days, 0),
            unpaid_invoices: toNumber(row.unpaid_invoices, 0),
            support_burden: toNumber(row.support_burden, 3),
            exec_engagement: toBool(row.exec_engagement, true),
            source: row.source || 'QuickBooks export',
            confidence: parseConfidence(row.confidence, 'HIGH'),
          })
        }
      },
    },
  ]

  for (const config of connectorConfigs) {
    const enabled = envEnabled(config.enableVar)
    if (!enabled) {
      statuses.push({ connector: config.connector, enabled: false, status: 'disabled', note: `${config.enableVar} is off.` })
      continue
    }

    const path = process.env[config.pathVar] ?? config.defaultPath
    const safePath = safeJoinWithinRoot(root, path)
    if (!safePath || !safePath.includes(`${sep}governance${sep}commercial${sep}exports${sep}`)) {
      statuses.push({ connector: config.connector, enabled: true, status: 'unavailable', note: `${config.pathVar} outside allowed export path.` })
      continue
    }
    if (!safePath || !existsSync(safePath)) {
      statuses.push({ connector: config.connector, enabled: true, status: 'unavailable', note: `${config.pathVar} missing file.` })
      continue
    }

    const rows = readCsvFromSafePath(safePath)
    if (rows.length === 0) {
      statuses.push({ connector: config.connector, enabled: true, status: 'unavailable', note: 'Export found but contains no rows.' })
      continue
    }

    config.consume(rows)
    statuses.push({ connector: config.connector, enabled: true, status: 'available', note: `Imported ${rows.length} rows.` })
  }

  statuses.push({ connector: 'CSV fallback', enabled: true, status: 'available', note: 'governance/commercial/*.json baseline loaded.' })

  return {
    opportunities: [...hubs, ...gmail],
    founderActivities: founder,
    retention,
    statuses,
  }
}

export function computeWeightedValue(opportunity: Opportunity): number {
  const probability = Math.max(0, Math.min(1, opportunity.probability))
  const confidenceFactor = opportunity.confidence === 'HIGH' ? 1 : opportunity.confidence === 'MEDIUM' ? 0.8 : 0.6
  const stageFactor = STAGE_WEIGHTS[opportunity.stage]
  return opportunity.value * probability * stageFactor * confidenceFactor
}

export function buildForecast(opportunities: Opportunity[], asOfDate: string): ForecastBucket[] {
  const horizons: Array<30 | 60 | 90> = [30, 60, 90]

  return horizons.map((horizon) => {
    const upper = datePlusDays(asOfDate, horizon)
    const inWindow = opportunities.filter((opportunity) => opportunity.expected_close_date <= upper && opportunity.stage !== 'close_lost')

    const expectedCloses = inWindow
      .filter((opportunity) => opportunity.stage === 'proposal' || opportunity.stage === 'legal' || opportunity.stage === 'close_won')
      .reduce((acc, opportunity) => acc + computeWeightedValue(opportunity), 0)

    const weightedPipeline = inWindow
      .filter((opportunity) => opportunity.stage !== 'close_won')
      .reduce((acc, opportunity) => acc + computeWeightedValue(opportunity), 0)

    const likelyBookings = inWindow
      .filter((opportunity) => opportunity.probability >= 0.45 && opportunity.stage !== 'close_lost')
      .reduce((acc, opportunity) => acc + (opportunity.value * opportunity.probability), 0)

    const byProductMap = new Map<string, { weighted: number; likely: number }>()
    const byMotionMap = new Map<CommercialMotion, { weighted: number; likely: number }>()

    for (const opportunity of inWindow) {
      const weighted = computeWeightedValue(opportunity)
      const likely = opportunity.probability >= 0.45 ? opportunity.value * opportunity.probability : 0

      byProductMap.set(opportunity.product, {
        weighted: (byProductMap.get(opportunity.product)?.weighted ?? 0) + weighted,
        likely: (byProductMap.get(opportunity.product)?.likely ?? 0) + likely,
      })

      byMotionMap.set(opportunity.commercial_motion, {
        weighted: (byMotionMap.get(opportunity.commercial_motion)?.weighted ?? 0) + weighted,
        likely: (byMotionMap.get(opportunity.commercial_motion)?.likely ?? 0) + likely,
      })
    }

    return {
      horizon_days: horizon,
      expected_closes: Math.round(expectedCloses),
      weighted_pipeline: Math.round(weightedPipeline),
      likely_bookings: Math.round(likelyBookings),
      by_product: Array.from(byProductMap.entries())
        .map(([product, metrics]) => ({ product, weighted: Math.round(metrics.weighted), likely: Math.round(metrics.likely) }))
        .sort((a, b) => b.weighted - a.weighted),
      by_motion: Array.from(byMotionMap.entries())
        .map(([motion, metrics]) => ({ motion, weighted: Math.round(metrics.weighted), likely: Math.round(metrics.likely) }))
        .sort((a, b) => b.weighted - a.weighted),
    }
  })
}

export function scorePilotConversion(pilot: Pilot): PilotConversionView {
  const procurementBonus = pilot.procurement_path_defined ? 10 : -15
  const engagementScore = pilot.weekly_engagement * 100
  const conversionScore = Math.max(
    0,
    Math.min(
      100,
      (pilot.sponsor_strength * 5)
      + (Math.min(pilot.users_active, 100) * 0.25)
      + (engagementScore * 0.22)
      + (pilot.business_pain_solved * 5)
      + (pilot.paid_likelihood_pct * 0.25)
      + procurementBonus,
    ),
  )

  let classification: PilotConversionView['classification'] = 'at risk'
  if (conversionScore >= 70) classification = 'likely to convert'
  else if (conversionScore < 45) classification = 'dead pilot walking'

  return {
    ...pilot,
    conversion_score: Math.round(conversionScore),
    classification,
  }
}

export function rankFounderRoi(activities: FounderActivity[]): FounderRoiView[] {
  return activities
    .map((activity) => {
      const weightedReturn = activity.revenue_closed + (activity.pipeline_created * 0.35)
      const roi = activity.hours <= 0 ? 0 : weightedReturn / activity.hours
      return {
        ...activity,
        roi: Math.round(roi),
      }
    })
    .sort((a, b) => b.roi - a.roi)
}

function proofScore(stage: ProofStage): number {
  const map: Record<ProofStage, number> = {
    none: 0,
    interest: 15,
    demo: 35,
    pilot: 50,
    paid_pilot: 65,
    contracted: 85,
    expanding: 95,
  }
  return map[stage]
}

export function classifyMarketPull(products: CommercialCatalogProduct[], opportunities: Opportunity[], pilots: PilotConversionView[]): MarketPullView[] {
  return products.map((product) => {
    const productOpps = opportunities.filter((opportunity) => opportunity.product === product.id && opportunity.stage !== 'close_lost')
    const productPilots = pilots.filter((pilot) => pilot.product === product.id)

    const inboundRequests = productOpps.filter((opportunity) => opportunity.source.toLowerCase().includes('gmail')).length
    const repeatDemos = productOpps.filter((opportunity) => opportunity.stage === 'demo' || opportunity.stage === 'proposal').length
    const expansionAsks = productPilots.filter((pilot) => pilot.expansion_value > 0).length
    const urgencySignals = productOpps.filter((opportunity) => /urgent|quarter|budget|deadline/i.test(opportunity.risk) === false).length
    const referrals = productOpps.filter((opportunity) => /intro|referral|partner/i.test(opportunity.next_step)).length
    const avgCycle = productOpps.length === 0 ? product.sales_cycle_days : productOpps.reduce((acc, opportunity) => acc + opportunity.days_open, 0) / productOpps.length

    const score = Math.max(
      0,
      Math.min(
        100,
        (product.market_pull_score * 6)
        + (inboundRequests * 4)
        + (repeatDemos * 5)
        + (expansionAsks * 4)
        + (urgencySignals * 2)
        + (referrals * 3)
        + (proofScore(product.proof_stage) * 0.2)
        + Math.max(0, (100 - avgCycle) * 0.15),
      ),
    )

    let classification: MarketPullView['classification'] = 'no pull yet'
    if (score >= 75) classification = 'strong pull'
    else if (score >= 55) classification = 'emerging pull'
    else if (score >= 35) classification = 'founder-pushed'

    const drivers = [
      `inbound=${inboundRequests}`,
      `repeat_demos=${repeatDemos}`,
      `referrals=${referrals}`,
      `expansion_asks=${expansionAsks}`,
      `avg_cycle_days=${Math.round(avgCycle)}`,
    ]

    return {
      product: product.id,
      pull_score: Math.round(score),
      classification,
      drivers,
    }
  }).sort((a, b) => b.pull_score - a.pull_score)
}

export function scoreRetentionRisk(accounts: RetentionAccount[]): RetentionRiskView[] {
  return accounts.map((account) => {
    const riskScore = Math.max(
      0,
      Math.min(
        100,
        ((100 - account.usage_score) * 0.35)
        + (Math.min(account.sponsor_silence_days, 45) * 1.2)
        + (Math.min(account.unpaid_invoices, 5) * 12)
        + (account.support_burden * 4)
        + (account.exec_engagement ? 0 : 18),
      ),
    )

    const saves: string[] = []
    if (account.usage_score < 55) saves.push('Run adoption sprint and weekly enablement touchpoint.')
    if (account.sponsor_silence_days > 14) saves.push('Re-establish executive sponsor cadence this week.')
    if (account.unpaid_invoices > 0) saves.push('Resolve invoice blockers with finance and procurement.')
    if (!account.exec_engagement) saves.push('Schedule executive business review to secure renewal path.')

    const riskLevel: RetentionRiskView['risk_level'] = riskScore >= 65 ? 'high' : riskScore >= 40 ? 'medium' : 'low'

    return {
      ...account,
      risk_score: Math.round(riskScore),
      risk_level: riskLevel,
      saves,
    }
  }).sort((a, b) => b.risk_score - a.risk_score)
}

function inferWeakestFunnelLeak(opportunities: Opportunity[]): string {
  const open = opportunities.filter((opportunity) => opportunity.stage !== 'close_won' && opportunity.stage !== 'close_lost')
  const byStage = new Map<OpportunityStage, { count: number; avgDays: number }>()
  for (const opportunity of open) {
    const current = byStage.get(opportunity.stage) ?? { count: 0, avgDays: 0 }
    byStage.set(opportunity.stage, {
      count: current.count + 1,
      avgDays: current.avgDays + opportunity.days_open,
    })
  }

  let worstStage: OpportunityStage = 'lead'
  let worstScore = -1
  for (const [stage, metrics] of byStage.entries()) {
    const averageDays = metrics.avgDays / Math.max(metrics.count, 1)
    const stageScore = averageDays * metrics.count * (1 - STAGE_WEIGHTS[stage])
    if (stageScore > worstScore) {
      worstScore = stageScore
      worstStage = stage
    }
  }

  return worstScore < 0 ? 'No open funnel leak detected.' : `Largest leak is ${worstStage} stage friction (volume and dwell time).`
}

function chooseSalesAttention(products: CommercialCatalogProduct[], pull: MarketPullView[], opportunities: Opportunity[]): string {
  const weightedByProduct = new Map<string, number>()
  for (const opportunity of opportunities) {
    weightedByProduct.set(opportunity.product, (weightedByProduct.get(opportunity.product) ?? 0) + computeWeightedValue(opportunity))
  }

  const scored = products.map((product) => {
    const pipeline = weightedByProduct.get(product.id) ?? 0
    const pullScore = pull.find((item) => item.product === product.id)?.pull_score ?? 0
    const cycleBonus = Math.max(0, 120 - product.sales_cycle_days)
    const attention = (pipeline * 0.0008) + (pullScore * 0.5) + cycleBonus
    return { product: product.id, attention }
  }).sort((a, b) => b.attention - a.attention)

  return scored[0]?.product ?? 'none'
}

export function buildCommercialAlerts(
  opportunities: Opportunity[],
  founderActivities: FounderRoiView[],
  pilots: PilotConversionView[],
  retention: RetentionRiskView[],
  forecast: ForecastBucket[],
): CommercialAlert[] {
  const alerts: CommercialAlert[] = []

  const stalledTopDeal = opportunities
    .filter((opportunity) => opportunity.stage !== 'close_won' && opportunity.stage !== 'close_lost')
    .sort((a, b) => b.value - a.value)[0]
  if (stalledTopDeal && stalledTopDeal.days_open > 21) {
    alerts.push({ severity: 'high', message: `Top deal ${stalledTopDeal.account} stalled ${stalledTopDeal.days_open} days.` })
  }

  const recentPipeline = opportunities.filter((opportunity) => opportunity.days_open <= 14)
  if (recentPipeline.length === 0) {
    alerts.push({ severity: 'high', message: 'No pipeline created in the last 14 days.' })
  }

  const founderHours = founderActivities.reduce((acc, activity) => acc + activity.hours, 0)
  const lowRoiHours = founderActivities.filter((activity) => activity.roi < 5000).reduce((acc, activity) => acc + activity.hours, 0)
  if (founderHours > 0 && (lowRoiHours / founderHours) > 0.4) {
    alerts.push({ severity: 'medium', message: 'Founder overloaded with low ROI meeting lanes.' })
  }

  for (const pilot of pilots) {
    if (pilot.weekly_engagement >= 0.45 && !pilot.procurement_path_defined) {
      alerts.push({ severity: 'high', message: `Pilot ${pilot.account} active without procurement path.` })
    }
  }

  for (const account of retention) {
    if (account.risk_score >= 65) {
      alerts.push({ severity: 'critical', message: `High churn risk detected for ${account.account}.` })
    }
  }

  const weighted90 = forecast.find((bucket) => bucket.horizon_days === 90)?.by_product ?? []
  const totalWeighted90 = weighted90.reduce((acc, item) => acc + item.weighted, 0)
  const top = weighted90[0]
  if (top && totalWeighted90 > 0 && (top.weighted / totalWeighted90) > 0.6) {
    alerts.push({ severity: 'medium', message: `Pipeline concentration risk: ${top.product} represents ${Math.round((top.weighted / totalWeighted90) * 100)}% of 90-day weighted pipeline.` })
  }

  return alerts
}

function normalizeOpportunity(opportunity: Opportunity): Opportunity {
  return {
    ...opportunity,
    probability: Math.max(0, Math.min(1, opportunity.probability > 1 ? opportunity.probability / 100 : opportunity.probability)),
    value: Math.max(0, opportunity.value),
    days_open: Math.max(0, opportunity.days_open),
  }
}

function buildMustWin(opportunities: Opportunity[]): Opportunity[] {
  return opportunities
    .filter((opportunity) => opportunity.stage !== 'close_won' && opportunity.stage !== 'close_lost')
    .map((opportunity) => ({ opportunity, score: computeWeightedValue(opportunity) + (opportunity.value * 0.1) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => entry.opportunity)
}

export function buildTractionOutputs(): TractionOutputs {
  const root = findRepoRoot()
  const products = buildCommercialProducts(root)

  const opportunitiesPath = safeJoinWithinRoot(root, COMMERCIAL_OPPORTUNITIES_PATH)
  const opportunitiesInput = readJsonFromSafePath(opportunitiesPath, {
      as_of_date: new Date().toISOString().slice(0, 10),
      opportunities: [] as Opportunity[],
    }) as {
    as_of_date: string
    opportunities: Opportunity[]
  }

  const pilotsPath = safeJoinWithinRoot(root, COMMERCIAL_PILOTS_PATH)
  const pilotsInput = readJsonFromSafePath(pilotsPath, { pilots: [] as Pilot[] }) as {
    pilots: Pilot[]
  }

  const founderPath = safeJoinWithinRoot(root, COMMERCIAL_FOUNDER_ACTIVITIES_PATH)
  const founderInput = readJsonFromSafePath(founderPath, { activities: [] as FounderActivity[] }) as {
    activities: FounderActivity[]
  }

  const retentionPath = safeJoinWithinRoot(root, COMMERCIAL_RETENTION_PATH)
  const retentionInput = readJsonFromSafePath(retentionPath, { accounts: [] as RetentionAccount[] }) as {
    accounts: RetentionAccount[]
  }

  const connectorRows = loadConnectorRows(root)

  const opportunities = [...opportunitiesInput.opportunities, ...connectorRows.opportunities]
    .map(normalizeOpportunity)

  const pilots = pilotsInput.pilots.map(scorePilotConversion)
  const founderActivities = rankFounderRoi([...founderInput.activities, ...connectorRows.founderActivities])
  const retentionRisk = scoreRetentionRisk([...retentionInput.accounts, ...connectorRows.retention])
  const marketPull = classifyMarketPull(products, opportunities, pilots)
  const forecast = buildForecast(opportunities, opportunitiesInput.as_of_date)
  const topDealsToWinNow = buildMustWin(opportunities)
  const weakestFunnelLeak = inferWeakestFunnelLeak(opportunities)
  const productSalesFocusNow = chooseSalesAttention(products, marketPull, opportunities)
  const alerts = buildCommercialAlerts(opportunities, founderActivities, pilots, retentionRisk, forecast)

  return {
    asOfDate: opportunitiesInput.as_of_date,
    products,
    opportunities,
    pilots,
    founderActivities,
    marketPull,
    retentionRisk,
    forecast,
    alerts,
    topDealsToWinNow,
    weakestFunnelLeak,
    productSalesFocusNow,
    connectorStatus: connectorRows.statuses,
  }
}
