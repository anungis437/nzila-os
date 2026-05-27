import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import { platformDb } from '@nzila/db/platform'
import { createLogger } from '@nzila/os-core/telemetry'
import {
  commerceInvoices,
  commerceQuotes,
  platformCostRollups,
  stripeSubscriptions,
  treasurySnapshots,
  zongaRevenueEvents,
} from '@nzila/db/schema'
import { desc, eq, gte } from 'drizzle-orm'

const logger = createLogger('console.finance-spine')

interface CatalogProduct {
  id: string
  name: string
}

export interface FinanceSpineSnapshot {
  generatedAt: Date
  cashPositionUsd: number
  mrrUsd: number
  arrUsd: number
  monthlyBurnUsd: number
  platformBurn30dUsd: number
  fixedBurnUsd: number
  grossMarginEstimatePct: number
  receivablesOutstandingUsd: number
  receivablesAging: Array<{ bucket: string; amountUsd: number }>
  obligationsDue30dUsd: number
  collectionsPriority: Array<{ ref: string; dueDays: number; amountUsd: number; ventureId: string | null }>
  productPnLEstimates: Array<{ ventureId: string; revenueUsd: number; estimatedCostUsd: number; estimatedPnlUsd: number }>
  runwayScenarios: Array<{ mode: 'base' | 'conservative' | 'growth'; runwayMonths: number }>
  liveSpineScore: number
}

function safeNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/[_\s]+/g, '-').trim()
}

function daysAgo(date: Date | null): number {
  if (!date) return 0
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

function isMissingRelationError(error: unknown, relationName: string): boolean {
  if (!error || typeof error !== 'object') return false
  const maybePg = error as { code?: string; message?: string }
  if (maybePg.code === '42P01') return true
  return typeof maybePg.message === 'string' && maybePg.message.includes(`relation \"${relationName}\" does not exist`)
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== 'object') return false
  const maybePg = error as { code?: string; message?: string }
  if (maybePg.code === '42703') return true
  return typeof maybePg.message === 'string' && maybePg.message.includes(`column \"${columnName}\" does not exist`)
}

function loadCatalogProducts(): CatalogProduct[] {
  try {
    const catalogPath = path.join(process.cwd(), '../../governance/portfolio/product-catalog.json')
    const raw = fs.readFileSync(catalogPath, 'utf-8')
    const parsed = JSON.parse(raw) as { products: CatalogProduct[] }
    return parsed.products
  } catch {
    return []
  }
}

function extractVentureFromMetadata(metadata: unknown, knownVentures: Set<string>): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const record = metadata as Record<string, unknown>
  const candidates = [record.ventureId, record.venture, record.appId, record.appScope, record.category]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const normalized = normalizeValue(candidate)
    if (knownVentures.has(normalized)) return normalized
  }
  return null
}

export async function getFinanceSpineSnapshot(): Promise<FinanceSpineSnapshot> {
  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const since365 = new Date()
  since365.setDate(since365.getDate() - 365)

  const products = loadCatalogProducts()
  const knownVentures = new Set(products.map((product) => normalizeValue(product.id ?? product.name)))

  const treasuryPromise = platformDb
    .select({
      cashOnHand: treasurySnapshots.cashOnHand,
      restrictedCash: treasurySnapshots.restrictedCash,
      liabilitiesDue30d: treasurySnapshots.liabilitiesDue30d,
    })
    .from(treasurySnapshots)
    .orderBy(desc(treasurySnapshots.date))
    .limit(1)
    .catch((error) => {
      if (isMissingRelationError(error, 'treasury_snapshots')) {
        logger.warn('treasury_snapshots missing; falling back to environment treasury values')
        return []
      }
      throw error
    })

  const invoicePromise = platformDb
    .select({
      id: commerceInvoices.id,
      ref: commerceInvoices.ref,
      status: commerceInvoices.status,
      total: commerceInvoices.total,
      amountDue: commerceInvoices.amountDue,
      dueDate: commerceInvoices.dueDate,
      metadata: commerceInvoices.metadata,
    })
    .from(commerceInvoices)
    .where(gte(commerceInvoices.createdAt, since365))
    .catch((error) => {
      if (isMissingRelationError(error, 'commerce_invoices')) {
        logger.warn('commerce_invoices missing; using empty receivables')
        return []
      }
      throw error
    })

  const quotePromise = platformDb
    .select({
      ref: commerceQuotes.ref,
      status: commerceQuotes.status,
      total: commerceQuotes.total,
      metadata: commerceQuotes.metadata,
    })
    .from(commerceQuotes)
    .where(gte(commerceQuotes.createdAt, since30))
    .catch((error) => {
      if (isMissingRelationError(error, 'commerce_quotes')) {
        logger.warn('commerce_quotes missing; using empty pipeline snapshot')
        return []
      }
      throw error
    })

  const revenuePromise = platformDb
    .select({
      amount: zongaRevenueEvents.amount,
      occurredAt: zongaRevenueEvents.occurredAt,
    })
    .from(zongaRevenueEvents)
    .where(gte(zongaRevenueEvents.occurredAt, since365))
    .catch((error) => {
      if (isMissingRelationError(error, 'zonga_revenue_events')) {
        logger.warn('zonga_revenue_events missing; using zero external revenue events')
        return []
      }
      throw error
    })

  const burnPromise = platformDb
    .select({
      appId: platformCostRollups.appId,
      total: platformCostRollups.totalEstCostUsd,
    })
    .from(platformCostRollups)
    .where(gte(platformCostRollups.day, since30.toISOString().slice(0, 10)))
    .catch((error) => {
      if (isMissingRelationError(error, 'platform_cost_rollups')) {
        logger.warn('platform_cost_rollups missing; using zero platform burn rows')
        return []
      }
      if (isMissingColumnError(error, 'total_est_cost_usd') || isMissingColumnError(error, 'day') || isMissingColumnError(error, 'app_id')) {
        logger.warn('platform_cost_rollups schema is incomplete; using zero platform burn rows')
        return []
      }
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`platform_cost_rollups query failed; using zero platform burn rows (${message})`)
      return []
    })

  const subscriptionPromise = platformDb
    .select({
      status: stripeSubscriptions.status,
      amountCents: stripeSubscriptions.amountCents,
      interval: stripeSubscriptions.planInterval,
    })
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.cancelAtPeriodEnd, false))
    .catch((error) => {
      if (isMissingRelationError(error, 'stripe_subscriptions')) {
        logger.warn('stripe_subscriptions missing; using zero active subscriptions')
        return []
      }
      throw error
    })

  const [latestTreasury, invoiceRows, quoteRows, revenueRows, burnRows, subscriptionRows] = await Promise.all([
    treasuryPromise,
    invoicePromise,
    quotePromise,
    revenuePromise,
    burnPromise,
    subscriptionPromise,
  ])

  const fixedBurnUsd =
    safeNumber(process.env.MONTHLY_STAFF_BURN_USD) +
    safeNumber(process.env.MONTHLY_CONTRACTOR_BURN_USD) +
    safeNumber(process.env.MONTHLY_FOUNDER_BURN_USD) +
    safeNumber(process.env.MONTHLY_OTHER_FIXED_BURN_USD)

  const platformBurn30dUsd = burnRows.reduce((sum, row) => sum + safeNumber(row.total), 0)
  const monthlyBurnUsd = platformBurn30dUsd + fixedBurnUsd

  let mrrUsd = 0
  for (const subscription of subscriptionRows) {
    if (!['active', 'trialing', 'past_due'].includes(subscription.status)) continue
    const amount = safeNumber(subscription.amountCents) / 100
    if (subscription.interval === 'year') {
      mrrUsd += amount / 12
    } else {
      mrrUsd += amount
    }
  }

  const arrUsd = mrrUsd * 12

  const paidInvoices = invoiceRows.filter((invoice) => invoice.status === 'paid')
  const paidInvoiceRevenueUsd = paidInvoices.reduce((sum, invoice) => sum + safeNumber(invoice.total), 0)
  const zongaRevenueUsd = revenueRows.reduce((sum, row) => sum + safeNumber(row.amount), 0)
  const totalRevenueUsd = paidInvoiceRevenueUsd + zongaRevenueUsd

  const receivablesOutstandingUsd = invoiceRows.reduce((sum, invoice) => sum + safeNumber(invoice.amountDue), 0)

  const receivablesAging = [
    {
      bucket: 'Current',
      amountUsd: invoiceRows
        .filter((invoice) => safeNumber(invoice.amountDue) > 0 && invoice.dueDate && daysAgo(invoice.dueDate) <= 0)
        .reduce((sum, invoice) => sum + safeNumber(invoice.amountDue), 0),
    },
    {
      bucket: '1-30d overdue',
      amountUsd: invoiceRows
        .filter((invoice) => safeNumber(invoice.amountDue) > 0 && invoice.dueDate && daysAgo(invoice.dueDate) > 0 && daysAgo(invoice.dueDate) <= 30)
        .reduce((sum, invoice) => sum + safeNumber(invoice.amountDue), 0),
    },
    {
      bucket: '31-60d overdue',
      amountUsd: invoiceRows
        .filter((invoice) => safeNumber(invoice.amountDue) > 0 && invoice.dueDate && daysAgo(invoice.dueDate) > 30 && daysAgo(invoice.dueDate) <= 60)
        .reduce((sum, invoice) => sum + safeNumber(invoice.amountDue), 0),
    },
    {
      bucket: '61+d overdue',
      amountUsd: invoiceRows
        .filter((invoice) => safeNumber(invoice.amountDue) > 0 && invoice.dueDate && daysAgo(invoice.dueDate) > 60)
        .reduce((sum, invoice) => sum + safeNumber(invoice.amountDue), 0),
    },
  ]

  const collectionsPriority = invoiceRows
    .filter((invoice) => safeNumber(invoice.amountDue) > 0)
    .map((invoice) => ({
      ref: invoice.ref,
      dueDays: invoice.dueDate ? daysAgo(invoice.dueDate) : 0,
      amountUsd: safeNumber(invoice.amountDue),
      ventureId: extractVentureFromMetadata(invoice.metadata, knownVentures),
    }))
    .sort((left, right) => right.dueDays - left.dueDays || right.amountUsd - left.amountUsd)
    .slice(0, 10)

  const revenueByVenture: Record<string, number> = {}
  for (const invoice of paidInvoices) {
    const venture = extractVentureFromMetadata(invoice.metadata, knownVentures)
    if (!venture) continue
    revenueByVenture[venture] = (revenueByVenture[venture] ?? 0) + safeNumber(invoice.total)
  }
  revenueByVenture.zonga = (revenueByVenture.zonga ?? 0) + zongaRevenueUsd

  const costByVenture: Record<string, number> = {}
  for (const row of burnRows) {
    const app = normalizeValue(row.appId)
    if (!knownVentures.has(app)) continue
    costByVenture[app] = (costByVenture[app] ?? 0) + safeNumber(row.total)
  }

  const productPnLEstimates = Array.from(knownVentures)
    .map((ventureId) => {
      const revenueUsd = revenueByVenture[ventureId] ?? 0
      const estimatedCostUsd = costByVenture[ventureId] ?? 0
      return {
        ventureId,
        revenueUsd,
        estimatedCostUsd,
        estimatedPnlUsd: revenueUsd - estimatedCostUsd,
      }
    })
    .sort((left, right) => right.revenueUsd - left.revenueUsd)

  const treasury = latestTreasury[0]
  const cashPositionUsd = treasury
    ? safeNumber(treasury.cashOnHand) - safeNumber(treasury.restrictedCash)
    : safeNumber(process.env.CASH_BALANCE_USD)

  const obligationsDue30dUsd = treasury
    ? safeNumber(treasury.liabilitiesDue30d)
    : safeNumber(process.env.LIABILITIES_DUE_30D_USD)

  const grossMarginEstimatePct = totalRevenueUsd > 0
    ? Math.max(0, Math.min(100, ((totalRevenueUsd - platformBurn30dUsd) / totalRevenueUsd) * 100))
    : 0

  const baseNetBurn = Math.max(1, monthlyBurnUsd - mrrUsd)
  const conservativeNetBurn = Math.max(1, monthlyBurnUsd * 1.15 - mrrUsd * 0.85)
  const growthNetBurn = Math.max(1, monthlyBurnUsd * 1.25 - mrrUsd * 1.15)

  const runwayScenarios: FinanceSpineSnapshot['runwayScenarios'] = [
    { mode: 'base', runwayMonths: cashPositionUsd > 0 ? cashPositionUsd / baseNetBurn : 0 },
    { mode: 'conservative', runwayMonths: cashPositionUsd > 0 ? cashPositionUsd / conservativeNetBurn : 0 },
    { mode: 'growth', runwayMonths: cashPositionUsd > 0 ? cashPositionUsd / growthNetBurn : 0 },
  ]

  const liveSpineScore =
    Number(Boolean(treasury)) +
    Number(invoiceRows.length > 0) +
    Number(subscriptionRows.length > 0) +
    Number(burnRows.length > 0)

  // Quote rows are loaded so spine can surface pipeline volatility in future cadence jobs.
  void quoteRows

  return {
    generatedAt: new Date(),
    cashPositionUsd,
    mrrUsd,
    arrUsd,
    monthlyBurnUsd,
    platformBurn30dUsd,
    fixedBurnUsd,
    grossMarginEstimatePct,
    receivablesOutstandingUsd,
    receivablesAging,
    obligationsDue30dUsd,
    collectionsPriority,
    productPnLEstimates,
    runwayScenarios,
    liveSpineScore,
  }
}
