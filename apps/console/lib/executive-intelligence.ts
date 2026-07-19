import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import { getFinanceSpineSnapshot } from './finance-spine'
import { platformDb } from '@nzila/db/platform'
import {
  approvals,
  auditEvents,
  commerceInvoices,
  commerceOrders,
  commerceProducts,
  commerceQuoteLines,
  commerceQuotes,
  executionInitiatives,
  founderTimeLogs,
  orgs,
  pilotDefinitions,
  platformCostBudgetBreaches,
  platformCostRollups,
  runwayAssumptions,
  treasurySnapshots,
  weeklyFocusTargets,
  zongaRevenueEvents,
} from '@nzila/db/schema'
import { and, desc, eq, gte, sql } from 'drizzle-orm'

interface CatalogProduct {
  id: string
  name: string
  status?: string
  category: string
  deployment_status: string
  monetization_status: string
  value_prop?: string
  commercial_priority?: number
  code_presence?: string
  evidence_status?: string
  readiness_tier?: string
  priority?: string
  deployment?: string
  proof_level?: string
  gtm_posture?: string
  runway_priority?: number
  pilots?: number
  customers?: number
  monthly_revenue?: number
  annual_recurring_revenue?: number
  pipeline_value?: number
}

interface ProductCatalog {
  schema_version: string
  products: CatalogProduct[]
}

interface FocusAlert {
  level: 'critical' | 'warning' | 'info'
  message: string
}

interface VentureFocusRow {
  ventureId: string
  ventureName: string
  priority: number
  hours7: number
  hours30: number
  targetHours: number
  activePilots: number
  prospectPilots: number
  cost30Usd: number
  revenue30Usd: number
  revenuePerHour: number
  focusGapHours: number
}

export interface FounderFocusData {
  totalHours7: number
  totalHours30: number
  hoursByCategory30: Record<string, number>
  adminDragPct: number
  contextSwitchTaxPct: number
  deepWorkScore: number
  revenuePerHour: number
  pipelinePerHour: number
  focusedVentures7: number
  alerts: FocusAlert[]
  recommendations: string[]
  ventureRows: VentureFocusRow[]
  currentWeekTargets: Array<{ ventureId: string; targetHours: number; rationale: string | null }>
  executiveOrgId: string | null
  coveragePct: number
}

export interface RunwayScenario {
  mode: string
  runwayMonths: number
  netBurnUsd: number
}

export interface RunwayDecision {
  level: 'critical' | 'warning' | 'info'
  message: string
}

export interface RunwayData {
  executiveOrgId: string | null
  snapshotDate: Date | null
  cashNowUsd: number
  restrictedCashUsd: number
  receivablesUsd: number
  liabilitiesDue30dUsd: number
  netWorkingCapitalUsd: number
  monthlyBurnUsd: number
  platformBurnUsd: number
  fixedPeopleBurnUsd: number
  safeSpendThresholdUsd: number
  hiringAffordability: number
  scenarioRows: RunwayScenario[]
  receivablesAging: Array<{ bucket: string; amountUsd: number }>
  upcomingObligationsUsd: number
  decisions: RunwayDecision[]
  dataQuality: 'live' | 'mixed' | 'manual-required'
}

export interface CapitalPriorityRow {
  ventureId: string
  ventureName: string
  priority: number
  revenueTraction: number
  pipelineMomentum: number
  founderEfficiency: number
  strategicValue: number
  deliveryConfidence: number
  riskBurden: number
  capitalIntensity: number
  score: number
  action: 'Double down' | 'Maintain' | 'Hold' | 'Cut review'
  rationale: string
}

export interface AttributionDiagnostics {
  quoteAttributionRate: number
  invoiceAttributionRate: number
  unattributedPipelineUsd: number
  unattributedPaidRevenueUsd: number
  unattributedQuoteCount: number
  unattributedPaidInvoiceCount: number
  sampleUnattributedQuotes: Array<{ ref: string; totalUsd: number; status: string }>
  sampleUnattributedInvoices: Array<{ ref: string; totalUsd: number; status: string }>
}

export interface WeeklyBriefingData {
  executiveOrgId: string | null
  improved: string[]
  worsened: string[]
  cashPositionChange: string
  topVenture: CapitalPriorityRow | null
  lowestVenture: CapitalPriorityRow | null
  topDecisions: string[]
  decisionCandidates: Array<{
    title: string
    rationale: string
    ventureId: string | null
    category: 'sales' | 'capital' | 'hiring' | 'product' | 'risk'
    priority: 'p0' | 'p1' | 'p2' | 'p3'
    owner: string
    dueDays: number
  }>
  dealsNeedingFounderAction: Array<{ ref: string; status: string; ageDays: number; valueUsd: number }>
  risksRising: string[]
  suggestedTimeAllocation: Array<{ ventureId: string; ventureName: string; hours: number; note: string }>
  suggestedSpendAllocation: Array<{ ventureId: string; ventureName: string; action: string; note: string }>
  summarySentence: string
}

export interface TodayExecutiveSummary {
  runway: { months: number; level: 'critical' | 'warning' | 'healthy' }
  focusWarning: string | null
  weeklyDecisions: string[]
  rankingShifts: string[]
  summarySentence: string
}

interface FounderLogRow {
  date: Date
  ventureId: string
  category: string
  hours: number
}

interface FocusTargetRow {
  ventureId: string
  targetHours: number
  rationale: string | null
}

interface PilotRow {
  appScope: string
  status: string
}

interface CostRow {
  appId: string
  totalUsd: number
}

interface QuoteRow {
  id: string
  ref: string
  status: string
  total: number
  createdAt: Date | null
  metadata: unknown
  ventureId: string | null
}

interface InvoiceRow {
  id: string
  ref: string
  status: string
  amountDue: number
  total: number
  dueDate: Date | null
  paidAt: Date | null
  metadata: unknown
  ventureId: string | null
}

const ATTRIBUTABLE_QUOTE_STATUSES = ['draft', 'pricing', 'ready', 'sent', 'reviewing', 'accepted']

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/[_\s]+/g, '-').trim()
}

function compactToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function buildVentureAliasMap(ventures: Set<string>): Map<string, string> {
  const aliasMap = new Map<string, string>()
  for (const venture of ventures) {
    aliasMap.set(normalizeValue(venture), venture)
    aliasMap.set(normalizeValue(venture.replace(/-/g, ' ')), venture)
  }

  const defaults: Record<string, string> = {
    unioneyes: 'union-eyes',
    'union-eyes': 'union-eyes',
    ue: 'union-eyes',
    unioneyesapp: 'union-eyes',
    flowapp: 'flow',
    controlplane: 'control-plane',
    platformadmin: 'platform-admin',
    mobilityclientportal: 'mobility-client-portal',
  }

  for (const [alias, venture] of Object.entries(defaults)) {
    if (ventures.has(venture)) aliasMap.set(normalizeValue(alias), venture)
  }

  return aliasMap
}

function extractMetadataCandidates(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return []

  const keys = [
    'ventureId',
    'venture_id',
    'venture',
    'ventureSlug',
    'appId',
    'app_id',
    'appScope',
    'app_scope',
    'productApp',
    'product_app',
    'productCategory',
    'product_category',
    'productKey',
    'product_key',
    'productId',
    'product_id',
    'product',
    'category',
  ]

  const queue: unknown[] = [metadata]
  const candidates: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    if (Array.isArray(current)) {
      for (const value of current) queue.push(value)
      continue
    }

    if (typeof current !== 'object') continue
    const record = current as Record<string, unknown>

    for (const key of keys) {
      const value = record[key]
      if (typeof value === 'string' && value.trim().length > 0) candidates.push(value)
    }

    for (const value of Object.values(record)) {
      if (typeof value === 'object' && value !== null) queue.push(value)
    }
  }

  return candidates
}

function inferVentureId(params: {
  knownVentures: Set<string>
  aliasMap: Map<string, string>
  metadata?: unknown
  ref?: string | null
  category?: string | null
  productName?: string | null
  productId?: string | null
}): string | null {
  const knownVenturesByCompact = new Map<string, string>()
  for (const venture of params.knownVentures) {
    knownVenturesByCompact.set(compactToken(venture), venture)
  }

  const aliasesByCompact = new Map<string, string>()
  for (const [alias, venture] of params.aliasMap.entries()) {
    aliasesByCompact.set(compactToken(alias), venture)
  }

  const probes = [
    ...extractMetadataCandidates(params.metadata),
    params.ref ?? '',
    params.category ?? '',
    params.productName ?? '',
    params.productId ?? '',
  ]

  for (const probe of probes) {
    const normalized = normalizeValue(probe)
    if (!normalized) continue
    if (params.knownVentures.has(normalized)) return normalized
    const directAlias = params.aliasMap.get(normalized)
    if (directAlias) return directAlias

    const compact = compactToken(normalized)
    const compactVenture = knownVenturesByCompact.get(compact)
    if (compactVenture) return compactVenture
    const compactAlias = aliasesByCompact.get(compact)
    if (compactAlias) return compactAlias

    for (const token of normalized.split(/[^a-z0-9-]+/).filter(Boolean)) {
      const directTokenAlias = params.aliasMap.get(token)
      if (directTokenAlias) return directTokenAlias
      const compactTokenAlias = aliasesByCompact.get(compactToken(token))
      if (compactTokenAlias) return compactTokenAlias
    }

    for (const [alias, venture] of params.aliasMap.entries()) {
      if (alias.length >= 4 && normalized.includes(alias)) return venture
    }
  }

  return null
}

function addToBucket(bucket: Record<string, number>, ventureId: string | null, amount: number) {
  if (!ventureId || amount <= 0) return
  bucket[ventureId] = (bucket[ventureId] ?? 0) + amount
}

function safeNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resolveCommercialPriority(product: CatalogProduct): number {
  if (typeof product.commercial_priority === 'number' && Number.isFinite(product.commercial_priority)) {
    return product.commercial_priority
  }

  const mappedPriority: Record<string, number> = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  }
  const fromPriority = product.priority ? mappedPriority[product.priority.toLowerCase()] : undefined
  if (fromPriority) return fromPriority

  if (typeof product.runway_priority === 'number' && Number.isFinite(product.runway_priority)) {
    // New schema uses 1..10 (10 = highest urgency). Convert to 1..5 where 1 is highest priority.
    return clamp(Math.round((11 - product.runway_priority) / 2), 1, 5)
  }

  return 99
}

function resolveDeploymentStatus(product: CatalogProduct): string {
  return (product.deployment_status || product.deployment || '').toLowerCase()
}

function resolveCodePresence(product: CatalogProduct): string {
  if (product.code_presence) return product.code_presence.toLowerCase()

  const proof = (product.proof_level || '').toLowerCase()
  if (proof.includes('production')) return 'full'
  if (proof.includes('pilot') || proof.includes('internal') || proof.includes('customer')) return 'partial'

  const status = (product.status || '').toLowerCase()
  if (status === 'live' || status === 'ga') return 'full'
  if (status === 'pilot') return 'partial'
  if (status === 'incubating') return 'scaffold'

  return 'scaffold'
}

function resolveEvidenceStatus(product: CatalogProduct): string {
  if (product.evidence_status) return product.evidence_status.toLowerCase()

  const proof = (product.proof_level || '').toLowerCase()
  if (proof.includes('production') || proof.includes('customer')) return 'complete'
  if (proof.includes('pilot') || proof.includes('internal') || proof.includes('demo')) return 'partial'

  return 'none'
}

function resolveGtmPosture(product: CatalogProduct): string {
  return (product.gtm_posture || '').toLowerCase()
}

function gtmMomentumScore(posture: string): number {
  if (posture === 'sell-now') return 90
  if (posture === 'maintain') return 65
  if (posture === 'internal-only') return 45
  if (posture === 'hold') return 30
  if (posture === 'sunset') return 10
  return 35
}

function proofReadinessScore(proofLevel?: string): number {
  const proof = (proofLevel || '').toLowerCase()
  if (proof.includes('pilot')) return 80
  if (proof.includes('internal')) return 55
  if (proof.includes('customer') || proof.includes('production')) return 90
  return 20
}

function startOfWeek(date = new Date()): Date {
  const value = new Date(date)
  const day = value.getDay()
  const diff = day === 0 ? -6 : 1 - day
  value.setDate(value.getDate() + diff)
  value.setHours(0, 0, 0, 0)
  return value
}

function dayStringOffset(daysAgo: number): string {
  const value = new Date()
  value.setDate(value.getDate() - daysAgo)
  return value.toISOString().slice(0, 10)
}

function daysAgo(date: Date | null): number {
  if (!date) return 0
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

function loadCatalog(): CatalogProduct[] {
  try {
    const catalogPath = path.join(process.cwd(), '../../governance/portfolio/product-catalog.json')
    const raw = fs.readFileSync(catalogPath, 'utf-8')
    const parsed = JSON.parse(raw) as ProductCatalog
    return parsed.products
  } catch {
    return []
  }
}

async function getExecutiveOrgId(): Promise<string | null> {
  try {
    const rows = await platformDb
      .select({ id: orgs.id, legalName: orgs.legalName })
      .from(orgs)
      .orderBy(orgs.createdAt)

    const nzilaOrg = rows.find((row) => row.legalName.toLowerCase().includes('nzila'))
    return nzilaOrg?.id ?? rows[0]?.id ?? null
  } catch {
    return null
  }
}

async function loadRawSignals() {
  const catalog = loadCatalog()
  const knownVentures = new Set(catalog.map((product) => normalizeValue(product.id ?? product.name)))
  const ventureAliasMap = buildVentureAliasMap(knownVentures)
  const executiveOrgId = await getExecutiveOrgId()
  const since7 = new Date()
  since7.setDate(since7.getDate() - 7)
  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const currentWeekStart = startOfWeek()

  const [
    founderLogsResult,
    focusTargetsResult,
    pilotResult,
    costResult,
    quoteResult,
    quoteLineAttributionResult,
    invoiceResult,
    invoiceOrderLinkResult,
    zongaRevenueResult,
    treasuryResult,
    assumptionsResult,
    approvalsResult,
    budgetBreachesResult,
    auditResult,
  ] = await Promise.allSettled([
    executiveOrgId
      ? platformDb
          .select({
            date: founderTimeLogs.date,
            ventureId: founderTimeLogs.ventureId,
            category: founderTimeLogs.category,
            hours: founderTimeLogs.hours,
          })
          .from(founderTimeLogs)
          .where(and(eq(founderTimeLogs.orgId, executiveOrgId), gte(founderTimeLogs.date, since30)))
          .orderBy(desc(founderTimeLogs.date))
      : Promise.resolve([]),
    executiveOrgId
      ? platformDb
          .select({
            ventureId: weeklyFocusTargets.ventureId,
            targetHours: weeklyFocusTargets.targetHours,
            rationale: weeklyFocusTargets.rationale,
          })
          .from(weeklyFocusTargets)
          .where(and(eq(weeklyFocusTargets.orgId, executiveOrgId), gte(weeklyFocusTargets.weekStart, currentWeekStart)))
      : Promise.resolve([]),
    platformDb
      .select({ appScope: pilotDefinitions.appScope, status: pilotDefinitions.status })
      .from(pilotDefinitions),
    platformDb
      .select({
        appId: platformCostRollups.appId,
        totalUsd: sql<string>`COALESCE(SUM(${platformCostRollups.totalEstCostUsd}), 0)`,
      })
      .from(platformCostRollups)
      .where(gte(platformCostRollups.day, dayStringOffset(30)))
      .groupBy(platformCostRollups.appId),
    platformDb
      .select({
        id: commerceQuotes.id,
        ref: commerceQuotes.ref,
        status: commerceQuotes.status,
        total: commerceQuotes.total,
        createdAt: commerceQuotes.createdAt,
        metadata: commerceQuotes.metadata,
      })
      .from(commerceQuotes)
      .where(gte(commerceQuotes.createdAt, since30))
      .orderBy(desc(commerceQuotes.createdAt)),
    platformDb
      .select({
        quoteId: commerceQuoteLines.quoteId,
        productId: commerceQuoteLines.productId,
        quoteRef: commerceQuotes.ref,
        lineTotal: commerceQuoteLines.lineTotal,
        quoteMetadata: commerceQuotes.metadata,
        productCategory: commerceProducts.category,
        productName: commerceProducts.name,
        productMetadata: commerceProducts.metadata,
      })
      .from(commerceQuoteLines)
      .leftJoin(commerceQuotes, eq(commerceQuotes.id, commerceQuoteLines.quoteId))
      .leftJoin(commerceProducts, eq(commerceProducts.id, commerceQuoteLines.productId)),
    platformDb
      .select({
        id: commerceInvoices.id,
        ref: commerceInvoices.ref,
        status: commerceInvoices.status,
        amountDue: commerceInvoices.amountDue,
        total: commerceInvoices.total,
        dueDate: commerceInvoices.dueDate,
        paidAt: commerceInvoices.paidAt,
        metadata: commerceInvoices.metadata,
      })
      .from(commerceInvoices)
      .where(gte(commerceInvoices.createdAt, since30)),
    platformDb
      .select({
        invoiceId: commerceInvoices.id,
        quoteId: commerceQuotes.id,
        quoteRef: commerceQuotes.ref,
        orderMetadata: commerceOrders.metadata,
        quoteMetadata: commerceQuotes.metadata,
      })
      .from(commerceInvoices)
      .leftJoin(commerceOrders, eq(commerceOrders.id, commerceInvoices.orderId))
      .leftJoin(commerceQuotes, eq(commerceQuotes.id, commerceOrders.quoteId))
      .where(gte(commerceInvoices.createdAt, since30)),
    platformDb
      .select({ amount: zongaRevenueEvents.amount, occurredAt: zongaRevenueEvents.occurredAt })
      .from(zongaRevenueEvents)
      .where(gte(zongaRevenueEvents.occurredAt, since30)),
    executiveOrgId
      ? platformDb
          .select({
            date: treasurySnapshots.date,
            cashOnHand: treasurySnapshots.cashOnHand,
            restrictedCash: treasurySnapshots.restrictedCash,
            receivables: treasurySnapshots.receivables,
            liabilitiesDue30d: treasurySnapshots.liabilitiesDue30d,
            notes: treasurySnapshots.notes,
          })
          .from(treasurySnapshots)
          .where(eq(treasurySnapshots.orgId, executiveOrgId))
          .orderBy(desc(treasurySnapshots.date))
          .limit(1)
      : Promise.resolve([]),
    executiveOrgId
      ? platformDb
          .select({
            mode: runwayAssumptions.mode,
            expectedMonthlyRevenue: runwayAssumptions.expectedMonthlyRevenue,
            plannedHires: runwayAssumptions.plannedHires,
            discretionarySpend: runwayAssumptions.discretionarySpend,
          })
          .from(runwayAssumptions)
          .where(eq(runwayAssumptions.orgId, executiveOrgId))
      : Promise.resolve([]),
    platformDb
      .select({ status: approvals.status })
      .from(approvals)
      .where(eq(approvals.status, 'pending')),
    platformDb
      .select({ recordedAt: platformCostBudgetBreaches.recordedAt })
      .from(platformCostBudgetBreaches)
      .orderBy(desc(platformCostBudgetBreaches.recordedAt))
      .limit(10),
    platformDb
      .select({ createdAt: auditEvents.createdAt, action: auditEvents.action })
      .from(auditEvents)
      .orderBy(desc(auditEvents.createdAt))
      .limit(20),
  ])

  const quoteAttributionById = new Map<string, string>()
  if (quoteLineAttributionResult.status === 'fulfilled') {
    const weightedAttribution = new Map<string, Map<string, number>>()
    for (const row of quoteLineAttributionResult.value) {
      const ventureId = inferVentureId({
        knownVentures,
        aliasMap: ventureAliasMap,
        metadata: row.productMetadata ?? row.quoteMetadata,
        ref: row.quoteRef,
        category: row.productCategory,
        productName: row.productName,
        productId: row.productId,
      })
      if (!ventureId) continue
      const amount = safeNumber(row.lineTotal)
      const quoteId = row.quoteId
      if (!weightedAttribution.has(quoteId)) weightedAttribution.set(quoteId, new Map<string, number>())
      const quoteBucket = weightedAttribution.get(quoteId)!
      quoteBucket.set(ventureId, (quoteBucket.get(ventureId) ?? 0) + amount)
    }

    for (const [quoteId, bucket] of weightedAttribution.entries()) {
      const top = Array.from(bucket.entries()).sort((left, right) => right[1] - left[1])[0]
      if (top) quoteAttributionById.set(quoteId, top[0])
    }
  }

  const invoiceLinkById = new Map<string, {
    quoteId: string | null
    quoteRef: string | null
    orderMetadata: unknown
    quoteMetadata: unknown
  }>()
  if (invoiceOrderLinkResult.status === 'fulfilled') {
    for (const row of invoiceOrderLinkResult.value) {
      invoiceLinkById.set(row.invoiceId, {
        quoteId: row.quoteId,
        quoteRef: row.quoteRef,
        orderMetadata: row.orderMetadata,
        quoteMetadata: row.quoteMetadata,
      })
    }
  }

  const pipelineByVenture: Record<string, number> = {}
  const revenueByVenture: Record<string, number> = {}

  const quotes: QuoteRow[] = quoteResult.status === 'fulfilled' ? quoteResult.value.map((row) => {
    const inferred =
      quoteAttributionById.get(row.id) ??
      inferVentureId({
        knownVentures,
        aliasMap: ventureAliasMap,
        metadata: row.metadata,
        ref: row.ref,
      })

    const quote: QuoteRow = {
      id: row.id,
      ref: row.ref,
      status: row.status,
      total: safeNumber(row.total),
      createdAt: row.createdAt,
      metadata: row.metadata,
      ventureId: inferred,
    }

    if (ATTRIBUTABLE_QUOTE_STATUSES.includes(quote.status)) {
      addToBucket(pipelineByVenture, quote.ventureId, quote.total)
    }

    return quote
  }) : []

  const invoices: InvoiceRow[] = invoiceResult.status === 'fulfilled' ? invoiceResult.value.map((row) => {
    const link = invoiceLinkById.get(row.id)
    const inferred =
      (link?.quoteId ? quoteAttributionById.get(link.quoteId) : null) ??
      inferVentureId({
        knownVentures,
        aliasMap: ventureAliasMap,
        metadata: row.metadata ?? link?.orderMetadata ?? link?.quoteMetadata,
        ref: row.ref ?? link?.quoteRef,
      })

    const invoice: InvoiceRow = {
      id: row.id,
      ref: row.ref,
      status: row.status,
      amountDue: safeNumber(row.amountDue),
      total: safeNumber(row.total),
      dueDate: row.dueDate,
      paidAt: row.paidAt,
      metadata: row.metadata,
      ventureId: inferred,
    }

    if (invoice.status === 'paid') {
      addToBucket(revenueByVenture, invoice.ventureId, invoice.total)
    }

    return invoice
  }) : []

  return {
    catalog,
    executiveOrgId,
    since7,
    since30,
    currentWeekStart,
    founderLogs: founderLogsResult.status === 'fulfilled' ? founderLogsResult.value.map((row) => ({
      date: new Date(row.date),
      ventureId: row.ventureId,
      category: row.category,
      hours: safeNumber(row.hours),
    })) as FounderLogRow[] : [],
    focusTargets: focusTargetsResult.status === 'fulfilled' ? focusTargetsResult.value.map((row) => ({
      ventureId: row.ventureId,
      targetHours: safeNumber(row.targetHours),
      rationale: row.rationale,
    })) as FocusTargetRow[] : [],
    pilots: pilotResult.status === 'fulfilled' ? pilotResult.value as PilotRow[] : [],
    costs: costResult.status === 'fulfilled' ? costResult.value.map((row) => ({
      appId: row.appId,
      totalUsd: safeNumber(row.totalUsd),
    })) as CostRow[] : [],
    quotes,
    invoices,
    pipelineByVenture,
    revenueByVenture,
    zongaRevenue: zongaRevenueResult.status === 'fulfilled' ? zongaRevenueResult.value.map((row) => ({
      amount: safeNumber(row.amount),
      occurredAt: row.occurredAt,
    })) : [],
    treasurySnapshot: treasuryResult.status === 'fulfilled' ? treasuryResult.value[0] ?? null : null,
    runwayAssumptionRows: assumptionsResult.status === 'fulfilled' ? assumptionsResult.value : [],
    pendingApprovals: approvalsResult.status === 'fulfilled' ? approvalsResult.value.length : 0,
    budgetBreaches: budgetBreachesResult.status === 'fulfilled' ? budgetBreachesResult.value.length : 0,
    recentAuditEvents: auditResult.status === 'fulfilled' ? auditResult.value : [],
  }
}

function buildCapitalPriorityRowsFromSignals(signals: Awaited<ReturnType<typeof loadRawSignals>>): CapitalPriorityRow[] {
  const logHoursByVenture = new Map<string, number>()
  for (const log of signals.founderLogs) {
    logHoursByVenture.set(log.ventureId, (logHoursByVenture.get(log.ventureId) ?? 0) + log.hours)
  }

  const costByVenture = new Map(signals.costs.map((row) => [row.appId, row.totalUsd]))
  const activePilots = new Map<string, number>()
  const prospectPilots = new Map<string, number>()
  for (const pilot of signals.pilots) {
    if (pilot.status === 'active') {
      activePilots.set(pilot.appScope, (activePilots.get(pilot.appScope) ?? 0) + 1)
    }
    if (pilot.status === 'prospect') {
      prospectPilots.set(pilot.appScope, (prospectPilots.get(pilot.appScope) ?? 0) + 1)
    }
  }

  const totalCost = signals.costs.reduce((sum, row) => sum + row.totalUsd, 0)
  const zongaRevenue30 = signals.zongaRevenue.reduce((sum, row) => sum + row.amount, 0)

  return signals.catalog
    .map((product) => {
      const priority = resolveCommercialPriority(product)
      const ventureId = product.id ?? product.name
      const catalogPilots = safeNumber(product.pilots)
      const catalogMonthlyRevenue = safeNumber(product.monthly_revenue) || safeNumber(product.annual_recurring_revenue) / 12
      const catalogPipeline = safeNumber(product.pipeline_value)
      const ventureHours = logHoursByVenture.get(ventureId) ?? 0
      const ventureActivePilots = Math.max(activePilots.get(ventureId) ?? 0, catalogPilots)
      const ventureProspectPilots = prospectPilots.get(ventureId) ?? 0
      const ventureCost = costByVenture.get(ventureId) ?? 0
      const ventureRevenueLive = signals.revenueByVenture[ventureId] ?? 0
      const venturePipelineLive = signals.pipelineByVenture[ventureId] ?? 0
      const ventureRevenue = ventureRevenueLive > 0 ? ventureRevenueLive : catalogMonthlyRevenue
      const venturePipeline = venturePipelineLive > 0 ? venturePipelineLive : catalogPipeline
      const codePresence = resolveCodePresence(product)
      const evidenceStatus = resolveEvidenceStatus(product)
      const deploymentStatus = resolveDeploymentStatus(product)
      const gtmPosture = resolveGtmPosture(product)
      const commercialIntent = clamp(
        gtmMomentumScore(gtmPosture) * 0.6 + proofReadinessScore(product.proof_level) * 0.4,
        0,
        100,
      )
      const revenueTraction = clamp(
        ventureRevenue > 0
          ? (ventureRevenue / 5000) * 100 + ventureActivePilots * 10
          : venturePipeline > 0
            ? (venturePipeline / 10000) * 100 + ventureProspectPilots * 8 + ventureActivePilots * 10
            : ventureId === 'zonga'
              ? (zongaRevenue30 / 5000) * 100
              : ventureActivePilots > 0
                ? 55 + ventureActivePilots * 15
                : ventureProspectPilots > 0
                  ? 30 + ventureProspectPilots * 10
                  : 0,
        0,
        100,
      )
      const pipelineMomentum = clamp((venturePipeline / 15000) * 100 + ventureActivePilots * 20 + ventureProspectPilots * 10, 0, 100)
      const founderEfficiency = clamp(
        ventureHours === 0
          ? 50
          : ((ventureActivePilots * 30 + ventureProspectPilots * 12 + (priority <= 2 ? 25 : 0)) / ventureHours) * 10,
        0,
        100,
      )
      const strategicValue = clamp(110 - priority * 15, 10, 100)
      const deliveryConfidence = clamp(
        (codePresence === 'full' ? 45 : codePresence === 'partial' ? 28 : codePresence === 'scaffold' ? 10 : 0) +
          (evidenceStatus === 'complete' ? 35 : evidenceStatus === 'partial' ? 18 : 0) +
          (deploymentStatus === 'pilot' ? 20 : deploymentStatus === 'internal' ? 10 : 6),
        0,
        100,
      )
      const riskBurden = clamp(
        (evidenceStatus === 'none' ? 35 : evidenceStatus === 'partial' ? 18 : 5) +
          (codePresence === 'scaffold' ? 30 : codePresence === 'partial' ? 15 : 5) +
          (priority <= 2 && ventureActivePilots === 0 ? 25 : 0) +
          (signals.pendingApprovals >= 5 ? 10 : 0),
        0,
        100,
      )
      const costShare = totalCost > 0 ? ventureCost / totalCost : 0
      const capitalIntensity = clamp(100 - costShare * 140, 20, 100)
      const baselineScore =
        revenueTraction * 0.22 +
        pipelineMomentum * 0.18 +
        founderEfficiency * 0.16 +
        strategicValue * 0.16 +
        deliveryConfidence * 0.14 +
        (100 - riskBurden) * 0.08 +
        capitalIntensity * 0.06

      // Blend live telemetry with catalog-intent signals so ventures are not
      // uniformly penalized when pipeline/revenue attribution is sparse.
      const score = Math.round(baselineScore * 0.65 + commercialIntent * 0.35)
      const action: CapitalPriorityRow['action'] =
        score >= 75 ? 'Double down' : score >= 60 ? 'Maintain' : score >= 45 ? 'Hold' : 'Cut review'
      const rationale =
        action === 'Double down'
          ? 'Strong strategic priority with live traction and acceptable delivery risk.'
          : action === 'Maintain'
            ? 'Worth continued attention, but not yet strong enough for incremental capital.'
            : action === 'Hold'
              ? 'Signal is mixed. Protect optionality without increasing burn.'
              : 'Low ROI or high drag relative to current traction.'

      return {
        ventureId,
        ventureName: product.name,
        priority,
        revenueTraction,
        pipelineMomentum,
        founderEfficiency,
        strategicValue,
        deliveryConfidence,
        riskBurden,
        capitalIntensity,
        score,
        action,
        rationale,
      }
    })
    .sort((left, right) => right.score - left.score)
}

export async function getCapitalPriorityRows(): Promise<CapitalPriorityRow[]> {
  const signals = await loadRawSignals()
  return buildCapitalPriorityRowsFromSignals(signals)
}

export async function getAttributionDiagnostics(): Promise<AttributionDiagnostics> {
  const signals = await loadRawSignals()

  const attributableQuotes = signals.quotes.filter((quote) => ATTRIBUTABLE_QUOTE_STATUSES.includes(quote.status))
  const paidInvoices = signals.invoices.filter((invoice) => invoice.status === 'paid')

  const attributedQuoteUsd = attributableQuotes
    .filter((quote) => Boolean(quote.ventureId))
    .reduce((sum, quote) => sum + quote.total, 0)
  const unattributedQuotes = attributableQuotes.filter((quote) => !quote.ventureId)
  const unattributedPipelineUsd = unattributedQuotes.reduce((sum, quote) => sum + quote.total, 0)
  const totalAttributableQuoteUsd = attributedQuoteUsd + unattributedPipelineUsd

  const attributedInvoiceUsd = paidInvoices
    .filter((invoice) => Boolean(invoice.ventureId))
    .reduce((sum, invoice) => sum + invoice.total, 0)
  const unattributedInvoices = paidInvoices.filter((invoice) => !invoice.ventureId)
  const unattributedPaidRevenueUsd = unattributedInvoices.reduce((sum, invoice) => sum + invoice.total, 0)
  const totalPaidInvoiceUsd = attributedInvoiceUsd + unattributedPaidRevenueUsd

  const quoteAttributionRate = totalAttributableQuoteUsd > 0 ? attributedQuoteUsd / totalAttributableQuoteUsd : 1
  const invoiceAttributionRate = totalPaidInvoiceUsd > 0 ? attributedInvoiceUsd / totalPaidInvoiceUsd : 1

  return {
    quoteAttributionRate,
    invoiceAttributionRate,
    unattributedPipelineUsd,
    unattributedPaidRevenueUsd,
    unattributedQuoteCount: unattributedQuotes.length,
    unattributedPaidInvoiceCount: unattributedInvoices.length,
    sampleUnattributedQuotes: unattributedQuotes.slice(0, 5).map((quote) => ({
      ref: quote.ref,
      totalUsd: quote.total,
      status: quote.status,
    })),
    sampleUnattributedInvoices: unattributedInvoices.slice(0, 5).map((invoice) => ({
      ref: invoice.ref,
      totalUsd: invoice.total,
      status: invoice.status,
    })),
  }
}

export async function getFounderFocusData(): Promise<FounderFocusData> {
  const signals = await loadRawSignals()
  const logs7 = signals.founderLogs.filter((row) => row.date >= signals.since7)
  const totalHours7 = logs7.reduce((sum, row) => sum + row.hours, 0)
  const totalHours30 = signals.founderLogs.reduce((sum, row) => sum + row.hours, 0)
  const hoursByCategory30: Record<string, number> = {}
  const hoursByVenture7 = new Map<string, number>()
  const hoursByVenture30 = new Map<string, number>()

  for (const row of signals.founderLogs) {
    hoursByCategory30[row.category] = (hoursByCategory30[row.category] ?? 0) + row.hours
    hoursByVenture30.set(row.ventureId, (hoursByVenture30.get(row.ventureId) ?? 0) + row.hours)
  }
  for (const row of logs7) {
    hoursByVenture7.set(row.ventureId, (hoursByVenture7.get(row.ventureId) ?? 0) + row.hours)
  }

  const salesHours = hoursByCategory30.sales ?? 0
  const revenueTrackedUsd =
    Object.values(signals.revenueByVenture).reduce((sum, value) => sum + value, 0) +
    signals.zongaRevenue.reduce((sum, row) => sum + row.amount, 0)
  const pipelineTrackedUsd = Object.values(signals.pipelineByVenture).reduce((sum, value) => sum + value, 0)
  const adminDragPct = totalHours30 > 0 ? ((hoursByCategory30.admin ?? 0) / totalHours30) * 100 : 0
  const contextSwitchTaxPct = totalHours30 > 0 ? ((hoursByCategory30['context-switch'] ?? 0) / totalHours30) * 100 : 0
  const deepWorkScore = clamp(
    totalHours30 === 0
      ? 0
      : (((hoursByCategory30.sales ?? 0) + (hoursByCategory30.build ?? 0) + (hoursByCategory30.strategy ?? 0)) /
          totalHours30) * 100 -
          contextSwitchTaxPct * 0.6,
    0,
    100,
  )

  const currentWeekTargets = signals.focusTargets
  const activePilotsByVenture = new Map<string, number>()
  const prospectPilotsByVenture = new Map<string, number>()
  for (const row of signals.pilots) {
    if (row.status === 'active') {
      activePilotsByVenture.set(row.appScope, (activePilotsByVenture.get(row.appScope) ?? 0) + 1)
    }
    if (row.status === 'prospect') {
      prospectPilotsByVenture.set(row.appScope, (prospectPilotsByVenture.get(row.appScope) ?? 0) + 1)
    }
  }
  const costsByVenture = new Map(signals.costs.map((row) => [row.appId, row.totalUsd]))
  const capitalRows = buildCapitalPriorityRowsFromSignals(signals)
  const capitalByVenture = new Map(capitalRows.map((row) => [row.ventureId, row]))
  const targetByVenture = new Map(currentWeekTargets.map((row) => [row.ventureId, row]))
  const ventureRows = signals.catalog
    .map((product) => {
      const ventureId = product.id ?? product.name
      const hours30 = hoursByVenture30.get(ventureId) ?? 0
      const hours7 = hoursByVenture7.get(ventureId) ?? 0
      const target = targetByVenture.get(ventureId)
      const revenue30Usd = (signals.revenueByVenture[ventureId] ?? 0) + (ventureId === 'zonga' ? signals.zongaRevenue.reduce((sum, row) => sum + row.amount, 0) : 0)
      return {
        ventureId,
        ventureName: product.name,
        priority: product.commercial_priority ?? 99,
        hours7,
        hours30,
        targetHours: target?.targetHours ?? 0,
        activePilots: activePilotsByVenture.get(ventureId) ?? 0,
        prospectPilots: prospectPilotsByVenture.get(ventureId) ?? 0,
        cost30Usd: costsByVenture.get(ventureId) ?? 0,
        revenue30Usd,
        revenuePerHour: hours30 > 0 ? revenue30Usd / hours30 : 0,
        focusGapHours: (target?.targetHours ?? 0) - hours7,
      }
    })
    .filter((row) => row.hours30 > 0 || row.targetHours > 0 || row.priority <= 4)
    .sort((left, right) => right.hours30 - left.hours30 || left.priority - right.priority)

  const alerts: FocusAlert[] = []
  const recommendations: string[] = []
  const focusedVentures7 = Array.from(hoursByVenture7.values()).filter((value) => value > 0).length
  const coveragePct = clamp((totalHours7 / 40) * 100, 0, 100)

  const lowTractionTime = ventureRows
    .filter((row) => row.priority >= 5 && row.activePilots === 0 && row.prospectPilots === 0)
    .reduce((sum, row) => sum + row.hours30, 0)

  if (totalHours30 > 0 && lowTractionTime / totalHours30 >= 0.4) {
    alerts.push({
      level: 'warning',
      message: `${Math.round((lowTractionTime / totalHours30) * 100)}% of logged time went to low-traction ventures.`,
    })
  }
  if (adminDragPct > 25) {
    alerts.push({
      level: 'warning',
      message: `Admin drag is ${adminDragPct.toFixed(0)}%. Delegate or automate recurring ops load.`,
    })
  }
  if (focusedVentures7 >= 5) {
    alerts.push({
      level: 'warning',
      message: `Founder attention is fragmented across ${focusedVentures7} ventures this week.`,
    })
  }
  if (salesHours === 0 && totalHours30 > 0) {
    alerts.push({
      level: 'critical',
      message: 'No sales hours logged in the last 30 days. Revenue risk is rising silently.',
    })
  }
  if (signals.founderLogs.length === 0) {
    alerts.push({
      level: 'info',
      message: 'No founder time logs yet. Log this week to unlock venture-level efficiency and leakage alerts.',
    })
  }

  const topRow = capitalRows[0] ?? null
  const worstTimeRow = ventureRows
    .filter((row) => row.hours30 > 0)
    .sort((left, right) => {
      const leftScore = capitalByVenture.get(left.ventureId)?.score ?? 0
      const rightScore = capitalByVenture.get(right.ventureId)?.score ?? 0
      return leftScore - rightScore || right.hours30 - left.hours30
    })[0] ?? null

  if (topRow && worstTimeRow && topRow.ventureId !== worstTimeRow.ventureId) {
    recommendations.push(`Move 8 hours from ${worstTimeRow.ventureName} to ${topRow.ventureName}.`)
  }
  if (adminDragPct > 25) {
    recommendations.push('Reduce founder admin load below 20% next week.')
  }
  if ((hoursByCategory30.build ?? 0) > (hoursByCategory30.sales ?? 0) * 2 && totalHours30 > 0) {
    recommendations.push('Pause low-return build work until sales motion catches up.')
  }
  if ((capitalByVenture.get('flow')?.score ?? 0) === Math.max(...capitalRows.map((row) => row.score), 0)) {
    recommendations.push('Flow is the strongest candidate for incremental founder time this week.')
  }

  return {
    totalHours7,
    totalHours30,
    hoursByCategory30,
    adminDragPct,
    contextSwitchTaxPct,
    deepWorkScore,
    revenuePerHour: totalHours30 > 0 ? revenueTrackedUsd / totalHours30 : 0,
    pipelinePerHour: salesHours > 0 ? pipelineTrackedUsd / salesHours : 0,
    focusedVentures7,
    alerts,
    recommendations,
    ventureRows,
    currentWeekTargets,
    executiveOrgId: signals.executiveOrgId,
    coveragePct,
  }
}

function defaultAssumptions() {
  return [
    { mode: 'base', expectedMonthlyRevenue: safeNumber(process.env.EXPECTED_MONTHLY_REVENUE_USD), plannedHires: 0, discretionarySpend: 0 },
    { mode: 'growth', expectedMonthlyRevenue: safeNumber(process.env.EXPECTED_MONTHLY_REVENUE_GROWTH_USD ?? process.env.EXPECTED_MONTHLY_REVENUE_USD), plannedHires: 1, discretionarySpend: safeNumber(process.env.DISCRETIONARY_SPEND_GROWTH_USD) },
    { mode: 'cut', expectedMonthlyRevenue: safeNumber(process.env.EXPECTED_MONTHLY_REVENUE_CUT_USD ?? process.env.EXPECTED_MONTHLY_REVENUE_USD), plannedHires: 0, discretionarySpend: 0 },
  ]
}

export async function getRunwayData(): Promise<RunwayData> {
  const [signals, financeSpine] = await Promise.all([loadRawSignals(), getFinanceSpineSnapshot()])
  const latestSnapshot = signals.treasurySnapshot
  const assumptions = (signals.runwayAssumptionRows.length > 0 ? signals.runwayAssumptionRows : defaultAssumptions()).map((row) => ({
    mode: row.mode,
    expectedMonthlyRevenue: safeNumber(row.expectedMonthlyRevenue),
    plannedHires: safeNumber(row.plannedHires),
    discretionarySpend: safeNumber(row.discretionarySpend),
  }))
  const platformBurnUsd = financeSpine.platformBurn30dUsd || signals.costs.reduce((sum, row) => sum + row.totalUsd, 0)
  const fixedPeopleBurnUsd = financeSpine.fixedBurnUsd
  const monthlyBurnUsd = financeSpine.monthlyBurnUsd
  const cashNowUsd = financeSpine.cashPositionUsd > 0
    ? financeSpine.cashPositionUsd
    : latestSnapshot
      ? safeNumber(latestSnapshot.cashOnHand)
      : safeNumber(process.env.CASH_BALANCE_USD)
  const restrictedCashUsd = latestSnapshot ? safeNumber(latestSnapshot.restrictedCash) : safeNumber(process.env.RESTRICTED_CASH_USD)
  const receivablesUsd = financeSpine.receivablesOutstandingUsd > 0
    ? financeSpine.receivablesOutstandingUsd
    : latestSnapshot
      ? safeNumber(latestSnapshot.receivables)
      : signals.invoices.reduce((sum, invoice) => sum + invoice.amountDue, 0)
  const liabilitiesDue30dUsd = financeSpine.obligationsDue30dUsd > 0
    ? financeSpine.obligationsDue30dUsd
    : latestSnapshot
      ? safeNumber(latestSnapshot.liabilitiesDue30d)
      : safeNumber(process.env.LIABILITIES_DUE_30D_USD)
  const netWorkingCapitalUsd = cashNowUsd - restrictedCashUsd + receivablesUsd - liabilitiesDue30dUsd
  const costPerHire = safeNumber(process.env.MONTHLY_COST_PER_HIRE_USD || 8000)
  const scenarioRows = assumptions.map((assumption) => {
    const netBurnUsd = Math.max(1, monthlyBurnUsd + assumption.plannedHires * costPerHire + assumption.discretionarySpend - assumption.expectedMonthlyRevenue)
    return {
      mode: assumption.mode,
      runwayMonths: netWorkingCapitalUsd > 0 ? netWorkingCapitalUsd / netBurnUsd : 0,
      netBurnUsd,
    }
  })

  const receivablesAging = financeSpine.receivablesAging

  const baseScenario = scenarioRows.find((row) => row.mode === 'base') ?? scenarioRows[0] ?? { runwayMonths: 0, netBurnUsd: 1, mode: 'base' }
  const expectedRevenueForMode = assumptions.find((row) => row.mode === baseScenario.mode)?.expectedMonthlyRevenue ?? 0
  const safeSpendThresholdUsd = Math.max(0, netWorkingCapitalUsd / 12 - (monthlyBurnUsd - expectedRevenueForMode))
  const hiringAffordability = Math.max(0, Math.floor((netWorkingCapitalUsd - monthlyBurnUsd * 6) / Math.max(costPerHire, 1)))
  const upcomingObligationsUsd = liabilitiesDue30dUsd + monthlyBurnUsd
  const decisions: RunwayDecision[] = []

  if (baseScenario.runwayMonths < 3) {
    decisions.push({ level: 'critical', message: 'Runway is under 3 months. Freeze non-core spend and push collections immediately.' })
  } else if (baseScenario.runwayMonths < 6) {
    decisions.push({ level: 'warning', message: 'Runway is under 6 months. Delay non-core hiring and review discretionary spend.' })
  }
  if ((receivablesAging.find((row) => row.bucket === '61+d overdue')?.amountUsd ?? 0) > 0) {
    decisions.push({ level: 'warning', message: 'Receivables over 60 days are rising. Collections needs founder attention this week.' })
  }
  if (assumptions.find((row) => row.mode === 'growth')?.discretionarySpend ?? 0 > monthlyBurnUsd * 0.2) {
    decisions.push({ level: 'info', message: 'Growth-mode discretionary spend is high relative to burn. Require proof before approving it.' })
  }
  if (hiringAffordability <= 0) {
    decisions.push({ level: 'warning', message: 'Current burn does not support additional hiring without new revenue or a cut scenario.' })
  }

  const liveInputs = Number(Boolean(latestSnapshot)) + Number(platformBurnUsd > 0) + Number(signals.invoices.length > 0) + Number(financeSpine.liveSpineScore >= 3)
  const dataQuality: RunwayData['dataQuality'] = liveInputs >= 3 ? 'live' : liveInputs >= 1 ? 'mixed' : 'manual-required'

  return {
    executiveOrgId: signals.executiveOrgId,
    snapshotDate: latestSnapshot?.date ? new Date(latestSnapshot.date) : null,
    cashNowUsd,
    restrictedCashUsd,
    receivablesUsd,
    liabilitiesDue30dUsd,
    netWorkingCapitalUsd,
    monthlyBurnUsd,
    platformBurnUsd,
    fixedPeopleBurnUsd,
    safeSpendThresholdUsd,
    hiringAffordability,
    scenarioRows,
    receivablesAging,
    upcomingObligationsUsd,
    decisions,
    dataQuality,
  }
}

export async function getWeeklyBriefingData(): Promise<WeeklyBriefingData> {
  const [signals, focus, runway] = await Promise.all([
    loadRawSignals(),
    getFounderFocusData(),
    getRunwayData(),
  ])
  const capitalRows = buildCapitalPriorityRowsFromSignals(signals)
  const topVenture = capitalRows[0] ?? null
  const lowestVenture = capitalRows[capitalRows.length - 1] ?? null
  const last7Quotes = signals.quotes.filter((row) => row.createdAt && row.createdAt >= signals.since7)
  const previous7Start = new Date(signals.since7)
  previous7Start.setDate(previous7Start.getDate() - 7)
  const prior7Quotes = signals.quotes.filter((row) => row.createdAt && row.createdAt >= previous7Start && row.createdAt < signals.since7)
  const last7Revenue = signals.zongaRevenue.filter((row) => row.occurredAt && row.occurredAt >= signals.since7).reduce((sum, row) => sum + row.amount, 0)
  const prior7Revenue = signals.zongaRevenue.filter((row) => row.occurredAt && row.occurredAt >= previous7Start && row.occurredAt < signals.since7).reduce((sum, row) => sum + row.amount, 0)
  const improved: string[] = []
  const worsened: string[] = []
  if (last7Revenue > prior7Revenue) improved.push(`Revenue increased week over week by $${(last7Revenue - prior7Revenue).toFixed(0)}.`)
  if (last7Quotes.length > prior7Quotes.length) improved.push(`Pipeline activity rose from ${prior7Quotes.length} to ${last7Quotes.length} recent quotes.`)
  if (focus.adminDragPct < 20 && focus.totalHours7 > 0) improved.push(`Admin drag is contained at ${focus.adminDragPct.toFixed(0)}% of logged founder time.`)
  if (last7Revenue < prior7Revenue) worsened.push(`Revenue slowed by $${(prior7Revenue - last7Revenue).toFixed(0)} week over week.`)
  if (focus.contextSwitchTaxPct > 15) worsened.push(`Context-switch tax is ${focus.contextSwitchTaxPct.toFixed(0)}%, which is diluting deep work.`)
  if ((runway.scenarioRows.find((row) => row.mode === 'base')?.runwayMonths ?? 0) < 6) worsened.push('Base-case runway is now inside the 6-month caution band.')
  if (signals.pendingApprovals >= 5) worsened.push(`${signals.pendingApprovals} approvals remain pending and are starting to block execution.`)

  const dealsNeedingFounderAction = signals.quotes
    .filter((quote) => ['sent', 'reviewing', 'accepted'].includes(quote.status) && quote.createdAt && daysAgo(quote.createdAt) >= 7)
    .slice(0, 5)
    .map((quote) => ({
      ref: quote.ref,
      status: quote.status,
      ageDays: quote.createdAt ? daysAgo(quote.createdAt) : 0,
      valueUsd: quote.total,
    }))

  const risksRising = [
    ...focus.alerts.filter((alert) => alert.level !== 'info').map((alert) => alert.message),
    ...runway.decisions.filter((decision) => decision.level !== 'info').map((decision) => decision.message),
  ].slice(0, 5)

  const suggestedTimeAllocation = capitalRows.slice(0, 3).map((row, index) => ({
    ventureId: row.ventureId,
    ventureName: row.ventureName,
    hours: index === 0 ? 18 : index === 1 ? 12 : 8,
    note: index === 0 ? 'Primary founder push' : index === 1 ? 'Maintain active motion' : 'Keep optionality alive',
  }))

  const suggestedSpendAllocation = capitalRows.slice(0, 5).map((row) => ({
    ventureId: row.ventureId,
    ventureName: row.ventureName,
    action: row.action,
    note: row.action === 'Double down'
      ? 'Can justify incremental capital if execution keeps pace.'
      : row.action === 'Cut review'
        ? 'Do not add spend until ROI improves.'
        : 'Protect current spend level only.',
  }))

  const topDecisions = [
    ...focus.recommendations,
    ...runway.decisions.map((decision) => decision.message),
    ...dealsNeedingFounderAction.map((deal) => `${deal.ref} needs founder follow-up this week.`),
  ].slice(0, 5)

  const decisionCandidates: WeeklyBriefingData['decisionCandidates'] = topDecisions.slice(0, 4).map((decision, index) => {
    const lowered = decision.toLowerCase()
    const category: WeeklyBriefingData['decisionCandidates'][number]['category'] =
      lowered.includes('runway') || lowered.includes('burn') || lowered.includes('cash')
        ? 'capital'
        : lowered.includes('hire')
          ? 'hiring'
          : lowered.includes('risk') || lowered.includes('approval')
            ? 'risk'
            : lowered.includes('deal') || lowered.includes('revenue') || lowered.includes('pipeline')
              ? 'sales'
              : 'product'

    const owner = category === 'sales' ? 'Founder' : category === 'capital' ? 'CFO' : category === 'risk' ? 'COO' : 'Ops'
    const priority: WeeklyBriefingData['decisionCandidates'][number]['priority'] = index === 0 ? 'p0' : index <= 2 ? 'p1' : 'p2'

    return {
      title: decision,
      rationale: decision,
      ventureId: topVenture?.ventureId ?? suggestedTimeAllocation[0]?.ventureId ?? null,
      category,
      priority,
      owner,
      dueDays: index === 0 ? 3 : 7,
    }
  })

  const baseRunwayMonths = runway.scenarioRows.find((row) => row.mode === 'base')?.runwayMonths ?? 0
  const summarySentence = topVenture
    ? `This week Nzila should focus on ${topVenture.ventureName.replace(/-/g, ' ')} execution and ${baseRunwayMonths < 6 ? 'collections discipline' : 'capital discipline'}.`
    : 'This week Nzila should focus on revenue motion and runway discipline.'

  return {
    executiveOrgId: signals.executiveOrgId,
    improved,
    worsened,
    cashPositionChange: `Net working capital is $${runway.netWorkingCapitalUsd.toFixed(0)} with base-case runway at ${baseRunwayMonths.toFixed(1)} months.`,
    topVenture,
    lowestVenture,
    topDecisions,
    decisionCandidates,
    dealsNeedingFounderAction,
    risksRising,
    suggestedTimeAllocation,
    suggestedSpendAllocation,
    summarySentence,
  }
}

export async function getTodayExecutiveSummary(): Promise<TodayExecutiveSummary> {
  const [focus, runway, briefing, capitalRows] = await Promise.all([
    getFounderFocusData(),
    getRunwayData(),
    getWeeklyBriefingData(),
    getCapitalPriorityRows(),
  ])
  const baseRunway = runway.scenarioRows.find((row) => row.mode === 'base') ?? runway.scenarioRows[0] ?? { runwayMonths: 0, netBurnUsd: 0, mode: 'base' }
  const rankingShifts = capitalRows.slice(0, 3).map((row, index) => `${index + 1}. ${row.ventureName.replace(/-/g, ' ')} — ${row.action}`)

  return {
    runway: {
      months: baseRunway.runwayMonths,
      level: baseRunway.runwayMonths < 3 ? 'critical' : baseRunway.runwayMonths < 6 ? 'warning' : 'healthy',
    },
    focusWarning: focus.alerts[0]?.message ?? null,
    weeklyDecisions: briefing.topDecisions.slice(0, 3),
    rankingShifts,
    summarySentence: briefing.summarySentence,
  }
}

export interface ExecutionAction {
  id: string
  action: string
  zone: string
  urgent: boolean
  dueDate: Date | null
}

export async function getTopExecutionActions(limit = 5): Promise<ExecutionAction[]> {
  const executiveOrgId = await getExecutiveOrgId()
  if (!executiveOrgId) return []

  const dueBy = new Date()
  dueBy.setDate(dueBy.getDate() + 7)

  try {
    const rows = await platformDb
      .select({
        id: executionInitiatives.id,
        action: executionInitiatives.title,
        zone: executionInitiatives.zone,
        urgent: executionInitiatives.urgent,
        dueDate: executionInitiatives.dueDate,
      })
      .from(executionInitiatives)
      .where(
        and(
          eq(executionInitiatives.orgId, executiveOrgId),
          sql`${executionInitiatives.status} != 'done'`,
          sql`(${executionInitiatives.urgent} = true OR ${executionInitiatives.dueDate} <= ${dueBy.toISOString().slice(0, 10)}::date)`,
        ),
      )
      .orderBy(desc(executionInitiatives.urgent), sql`${executionInitiatives.dueDate} ASC NULLS LAST`, desc(executionInitiatives.createdAt))
      .limit(limit)

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      zone: row.zone ?? 'EXECUTION',
      urgent: row.urgent,
      dueDate: row.dueDate ? new Date(row.dueDate) : null,
    }))
  } catch {
    return []
  }
}