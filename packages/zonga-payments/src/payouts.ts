/**
 * @nzila/zonga-payments — Payout Engine
 *
 * Batch payout scheduling, provider routing, and
 * reconciliation with the economic engine.
 */
import type { PayoutInstruction, PaymentProvider } from './types'
import { PaymentMethod, PayoutStatus } from './types'

// ── Provider Routing ──────────────────────────────────────────────────────

export interface ProviderRoute {
  readonly provider: PaymentProvider
  readonly method: PaymentMethod
  readonly supportedCurrencies: readonly string[]
  readonly supportedCountries: readonly string[]
  readonly minAmount: number
  readonly maxAmount: number
}

/**
 * Default provider routing for African markets + global.
 */
export const DEFAULT_PROVIDER_ROUTES: readonly ProviderRoute[] = [
  {
    provider: 'mpesa',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['KES', 'TZS', 'UGX'],
    supportedCountries: ['KE', 'TZ', 'UG'],
    minAmount: 1,
    maxAmount: 150000,
  },
  {
    provider: 'vodacom_mpesa',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['TZS', 'MWK', 'LSL'],
    supportedCountries: ['TZ', 'MW', 'LS', 'MZ'],
    minAmount: 1,
    maxAmount: 150000,
  },
  {
    provider: 'mtn_momo',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['UGX', 'GHS', 'XOF', 'XAF', 'RWF', 'ZMW', 'SZL'],
    supportedCountries: ['UG', 'GH', 'CI', 'CM', 'RW', 'BJ', 'SN', 'ZM', 'SZ'],
    minAmount: 1,
    maxAmount: 500000,
  },
  {
    provider: 'airtel_money',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['KES', 'TZS', 'UGX', 'MWK', 'ZMW'],
    supportedCountries: ['KE', 'TZ', 'UG', 'MW', 'ZM'],
    minAmount: 1,
    maxAmount: 200000,
  },
  {
    provider: 'orange_money',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['XOF', 'XAF', 'MAD'],
    supportedCountries: ['SN', 'CI', 'ML', 'CM', 'MA', 'BF', 'GN'],
    minAmount: 1,
    maxAmount: 300000,
  },
  {
    provider: 'moov_money',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['XOF'],
    supportedCountries: ['BJ', 'CI', 'TG', 'NE'],
    minAmount: 1,
    maxAmount: 300000,
  },
  {
    provider: 'wave',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['XOF'],
    supportedCountries: ['SN', 'CI', 'ML', 'BF'],
    minAmount: 1,
    maxAmount: 500000,
  },
  {
    provider: 'ecocash',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['BWP'],
    supportedCountries: ['ZW', 'BW'],
    minAmount: 1,
    maxAmount: 200000,
  },
  {
    provider: 'chipper_cash',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['NGN', 'GHS', 'KES', 'UGX', 'TZS', 'ZAR', 'RWF'],
    supportedCountries: ['NG', 'GH', 'KE', 'UG', 'TZ', 'ZA', 'RW'],
    minAmount: 1,
    maxAmount: 500000,
  },
  {
    provider: 'paga',
    method: PaymentMethod.MOBILE_MONEY,
    supportedCurrencies: ['NGN'],
    supportedCountries: ['NG'],
    minAmount: 1,
    maxAmount: 500000,
  },
  {
    provider: 'flutterwave',
    method: PaymentMethod.BANK_TRANSFER,
    supportedCurrencies: ['NGN', 'GHS', 'KES', 'ZAR', 'TZS', 'UGX', 'USD', 'GBP', 'EUR', 'ZMW', 'RWF', 'ETB', 'XOF', 'XAF'],
    supportedCountries: ['NG', 'GH', 'KE', 'ZA', 'TZ', 'UG', 'US', 'GB', 'ZM', 'RW', 'ET', 'SN', 'CM'],
    minAmount: 1,
    maxAmount: 1000000,
  },
  {
    provider: 'paystack',
    method: PaymentMethod.BANK_TRANSFER,
    supportedCurrencies: ['NGN', 'GHS', 'ZAR', 'KES'],
    supportedCountries: ['NG', 'GH', 'ZA', 'KE'],
    minAmount: 1,
    maxAmount: 500000,
  },
  {
    provider: 'stripe',
    method: PaymentMethod.CARD,
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'KES', 'CAD'],
    supportedCountries: ['US', 'GB', 'EU', 'ZA', 'NG', 'KE', 'CA'],
    minAmount: 0.5,
    maxAmount: 999999,
  },
] as const

// ── Routing Logic ─────────────────────────────────────────────────────────

export interface RouteResult {
  readonly matched: boolean
  readonly route: ProviderRoute | null
  readonly error: string | null
}

/**
 * Find the best provider route for a payout based on currency and country.
 */
export function resolvePayoutRoute(
  currency: string,
  country: string,
  preferredMethod?: PaymentMethod,
  routes?: readonly ProviderRoute[],
): RouteResult {
  const available = routes ?? DEFAULT_PROVIDER_ROUTES

  // Filter by currency and country
  let candidates = available.filter(
    (r) =>
      r.supportedCurrencies.includes(currency) &&
      r.supportedCountries.includes(country),
  )

  if (candidates.length === 0) {
    return { matched: false, route: null, error: `No provider supports ${currency} in ${country}` }
  }

  // Prefer mobile money in African markets
  if (preferredMethod) {
    const preferred = candidates.filter((r) => r.method === preferredMethod)
    if (preferred.length > 0) {
      candidates = preferred
    }
  }

  return { matched: true, route: candidates[0]!, error: null }
}

// ── Batch Scheduling ──────────────────────────────────────────────────────

export interface PayoutBatchPlan {
  readonly batchId: string
  readonly provider: PaymentProvider
  readonly instructions: readonly PayoutInstruction[]
  readonly totalAmount: number
  readonly currency: string
  readonly instructionCount: number
}

/**
 * Group payout instructions into provider-specific batches.
 */
export function planPayoutBatches(
  instructions: readonly PayoutInstruction[],
): PayoutBatchPlan[] {
  const pending = instructions.filter((i) => i.status === PayoutStatus.PENDING)

  // Group by provider + currency
  const groups = new Map<string, PayoutInstruction[]>()
  for (const inst of pending) {
    const key = `${inst.provider}:${inst.currency}`
    const existing = groups.get(key) ?? []
    existing.push(inst)
    groups.set(key, existing)
  }

  const batches: PayoutBatchPlan[] = []
  for (const [key, group] of groups) {
    const [provider, currency] = key.split(':') as [string, string]
    batches.push({
      batchId: `batch-${provider}-${currency}-${Date.now()}`,
      provider: provider as PaymentProvider,
      instructions: group,
      totalAmount: Math.round(group.reduce((sum, i) => sum + i.amount, 0) * 100) / 100,
      currency,
      instructionCount: group.length,
    })
  }

  return batches
}

// ── Reconciliation ────────────────────────────────────────────────────────

export interface PayoutReconciliation {
  readonly totalInstructions: number
  readonly completed: number
  readonly failed: number
  readonly pending: number
  readonly totalDisbursed: number
  readonly totalFailed: number
  readonly completionRate: number
}

/**
 * Reconcile payout batch results.
 */
export function reconcilePayouts(
  instructions: readonly PayoutInstruction[],
): PayoutReconciliation {
  const completed = instructions.filter((i) => i.status === PayoutStatus.COMPLETED)
  const failed = instructions.filter((i) => i.status === PayoutStatus.FAILED)
  const pending = instructions.filter(
    (i) => i.status === PayoutStatus.PENDING || i.status === PayoutStatus.PROCESSING,
  )

  const totalDisbursed = Math.round(completed.reduce((sum, i) => sum + i.amount, 0) * 100) / 100
  const totalFailed = Math.round(failed.reduce((sum, i) => sum + i.amount, 0) * 100) / 100
  const total = instructions.length

  return {
    totalInstructions: total,
    completed: completed.length,
    failed: failed.length,
    pending: pending.length,
    totalDisbursed,
    totalFailed,
    completionRate: total > 0 ? Math.round((completed.length / total) * 10000) / 100 : 0,
  }
}
