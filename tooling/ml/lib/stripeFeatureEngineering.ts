/**
 * tooling/ml/lib/stripeFeatureEngineering.ts
 *
 * Pure deterministic feature engineering for Stripe ML datasets.
 * No PII. Uses transaction/system metadata only.
 * All functions are synchronous and testable in isolation.
 */

// ── Daily metrics ─────────────────────────────────────────────────────────────

export interface DailyMetricsRow {
  date: string                 // YYYY-MM-DD
  gross_sales: number          // sum of positive payment amounts (major units)
  net_sales: number            // gross_sales - refunds_amount
  txn_count: number
  refunds_amount: number
  refunds_count: number
  disputes_count: number
  disputes_amount: number
  payout_count: number
  payout_amount: number
  currency: string
}

/** Compute per-date aggregate metrics from raw DB rows. */
export function buildDailyMetrics(
  payments: Array<{ occurredAt: Date; amountCents: bigint; currency: string }>,
  refunds: Array<{ occurredAt: Date; amountCents: bigint }>,
  disputes: Array<{ occurredAt: Date; amountCents: bigint }>,
  payouts: Array<{ occurredAt: Date; amountCents: bigint; currency: string }>,
  defaultCurrency = 'CAD',
): DailyMetricsRow[] {
  const byDate = new Map<string, DailyMetricsRow>()

  function getOrCreate(date: string): DailyMetricsRow {
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        gross_sales: 0,
        net_sales: 0,
        txn_count: 0,
        refunds_amount: 0,
        refunds_count: 0,
        disputes_count: 0,
        disputes_amount: 0,
        payout_count: 0,
        payout_amount: 0,
        currency: defaultCurrency,
      })
    }
    return byDate.get(date)!
  }

  for (const p of payments) {
    const date = p.occurredAt.toISOString().slice(0, 10)
    const row = getOrCreate(date)
    const amount = Number(p.amountCents) / 100
    row.gross_sales += amount
    row.txn_count += 1
    row.currency = p.currency.toUpperCase()
  }

  for (const r of refunds) {
    const date = r.occurredAt.toISOString().slice(0, 10)
    const row = getOrCreate(date)
    const amount = Number(r.amountCents) / 100
    row.refunds_amount += amount
    row.refunds_count += 1
  }

  for (const d of disputes) {
    const date = d.occurredAt.toISOString().slice(0, 10)
    const row = getOrCreate(date)
    row.disputes_amount += Number(d.amountCents) / 100
    row.disputes_count += 1
  }

  for (const po of payouts) {
    const date = po.occurredAt.toISOString().slice(0, 10)
    const row = getOrCreate(date)
    row.payout_amount += Number(po.amountCents) / 100
    row.payout_count += 1
  }

  // net_sales = gross - refunds
  for (const row of byDate.values()) {
    row.net_sales = Math.round((row.gross_sales - row.refunds_amount) * 100) / 100
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ── Transaction features ──────────────────────────────────────────────────────

export interface TxnFeatureRow {
  occurred_at: string           // ISO timestamp
  amount: number                // major currency units, signed
  amount_abs: number            // absolute value
  amount_log1p: number          // log1p(|amount|)
  currency: string
  payment_method_type: string   // card, bank_transfer, etc. (label-encoded by caller)
  is_refund: 0 | 1
  is_dispute: 0 | 1
  hour_of_day: number           // 0-23
  day_of_week: number           // 0=Mon 6=Sun
  // Rolling baselines (computed by buildRollingBaselines)
  median_amount_30d: number
  mad_amount_30d: number        // median absolute deviation
  z_robust_amount_30d: number   // robust z-score = (amount - median) / (1.4826 * MAD)
  // Stripe identifiers for join-back — NOT feature inputs
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  stripe_event_id: string | null
}

export interface RawTxn {
  occurredAt: Date
  amountCents: bigint
  currency: string
  paymentMethodType?: string
  isRefund: boolean
  isDispute: boolean
  stripePaymentIntentId?: string | null
  stripeChargeId?: string | null
  stripeEventId?: string | null
}

/**
 * Build per-transaction feature rows.
 * Rolling baselines are computed over a sliding 30-day window.
 */
export function buildTxnFeatures(txns: RawTxn[]): TxnFeatureRow[] {
  // Sort ascending for rolling window
  const sorted = [...txns].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())

  const result: TxnFeatureRow[] = []

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]
    const amount = Number(t.amountCents) / 100
    const ts = t.occurredAt

    // Rolling 30-day window (exclusive of current row)
    const windowStart = new Date(ts.getTime() - 30 * 24 * 60 * 60 * 1000)
    const windowAmounts = sorted
      .slice(0, i)
      .filter((prev) => prev.occurredAt >= windowStart)
      .map((prev) => Math.abs(Number(prev.amountCents) / 100))

    const { median, mad, zRobust } = robustStats(Math.abs(amount), windowAmounts)

    result.push({
      occurred_at: ts.toISOString(),
      amount,
      amount_abs: Math.abs(amount),
      amount_log1p: Math.log1p(Math.abs(amount)),
      currency: t.currency.toLowerCase(),
      payment_method_type: t.paymentMethodType ?? 'unknown',
      is_refund: t.isRefund ? 1 : 0,
      is_dispute: t.isDispute ? 1 : 0,
      hour_of_day: ts.getUTCHours(),
      day_of_week: (ts.getUTCDay() + 6) % 7, // 0=Mon
      median_amount_30d: median,
      mad_amount_30d: mad,
      z_robust_amount_30d: zRobust,
      stripe_payment_intent_id: t.stripePaymentIntentId ?? null,
      stripe_charge_id: t.stripeChargeId ?? null,
      stripe_event_id: t.stripeEventId ?? null,
    })
  }

  return result
}

// ── Rolling statistics helpers ────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

function robustStats(
  value: number,
  window: number[],
): { median: number; mad: number; zRobust: number } {
  if (window.length === 0) return { median: 0, mad: 0, zRobust: 0 }
  const med = median(window)
  const absDevs = window.map((v) => Math.abs(v - med))
  const mad = median(absDevs)
  const zRobust = mad > 0 ? (value - med) / (1.4826 * mad) : 0
  return { median: med, mad, zRobust }
}

// ── CSV serialiser ────────────────────────────────────────────────────────────

export function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = row[h]
          const s = v === null || v === undefined ? '' : String(v)
          // Quote if contains comma, newline, or quotes
          return s.includes(',') || s.includes('\n') || s.includes('"')
            ? `"${s.replace(/"/g, '""')}"`
            : s
        })
        .join(','),
    )
  }
  return lines.join('\n')
}
