/**
 * Billing sync — Phase 7 CFO real mode.
 *
 * Pulls live invoices from Stripe and live AP/AR cash events from QuickBooks
 * Online into the HQ ledger tables (`hq_invoices`, `hq_cash_events`). Both
 * sides are independently feature-flagged so partial rollouts work.
 *
 * Runs are upserts on `external_id` so re-running the same window is a
 * no-op (Stripe gives us stable invoice IDs; QBO gives us stable bill IDs).
 *
 * Triggers
 * - Cron via `POST /api/internal/billing/sync` (bearer-token guarded).
 * - Local dev via `pnpm --filter @nzila/nzila-hq exec tsx scripts/billing-sync.ts` (TODO).
 *
 * Why we don't use Stripe webhooks here
 * - The HQ ledger is the *aggregated* view across all peer apps. Webhooks fire
 *   per event in the originating app (Zonga, Veridian, …). Pulling on a daily
 *   cadence keeps the HQ tier read-only against operational systems and avoids
 *   double-writes.
 */
import 'server-only'
import { sql } from 'drizzle-orm'
import { getHqDb } from '../db/client'

// Lazy imports — these packages bring native deps (Stripe SDK) we don't want
// to load when the env flags are off.
const STRIPE_INVOICE_LOOKBACK_DAYS = 90
const QBO_LOOKBACK_DAYS = 90

export interface SyncResult {
  source: 'stripe' | 'qbo'
  enabled: boolean
  written: number
  skipped: number
  reason?: string
}

// ─────────────────────────────────────────────────────────────────────────
// Stripe → hq_invoices
// ─────────────────────────────────────────────────────────────────────────

export async function syncStripeInvoices(): Promise<SyncResult> {
  if (process.env.NZILA_HQ_BILLING_STRIPE !== '1') {
    return { source: 'stripe', enabled: false, written: 0, skipped: 0, reason: 'flag-off' }
  }
  const db = getHqDb()
  if (!db) return { source: 'stripe', enabled: true, written: 0, skipped: 0, reason: 'no-db' }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { source: 'stripe', enabled: true, written: 0, skipped: 0, reason: 'no-key' }
  }

  // Lazy import to keep the Stripe SDK off the cold-start path when disabled.
  const { getStripeClient } = await import('@nzila/payments-stripe')
  const stripe = getStripeClient()

  const since = Math.floor(
    (Date.now() - STRIPE_INVOICE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000,
  )

  let written = 0
  let skipped = 0
  // Auto-paginate through invoices in the window.
  for await (const inv of stripe.invoices.list({
    created: { gte: since },
    limit: 100,
  })) {
    if (!inv.id || inv.amount_due == null) {
      skipped++
      continue
    }
    const ventureSlug = (inv.metadata?.['venture_slug'] ?? 'unassigned') as string
    const clientOrgId = inv.customer ? String(inv.customer) : 'stripe-unknown'
    const clientName =
      (typeof inv.customer === 'object' && inv.customer && 'name' in inv.customer
        ? (inv.customer.name as string | null)
        : null) ??
      inv.customer_name ??
      inv.customer_email ??
      'Unknown'
    const issuedAt = new Date((inv.created ?? Date.now() / 1000) * 1000)
    const dueAt = new Date(((inv.due_date ?? inv.created ?? 0) || Date.now() / 1000) * 1000)
    const paidAt = inv.status_transitions?.paid_at
      ? new Date(inv.status_transitions.paid_at * 1000)
      : null
    const status = mapStripeInvoiceStatus(inv.status)

    await db.execute(sql`
      INSERT INTO hq_invoices (
        external_id, venture_slug, client_org_id, client_name,
        issued_at, due_at, paid_at, amount_cents, status, source_system
      ) VALUES (
        ${inv.id}, ${ventureSlug}, ${clientOrgId}, ${clientName},
        ${issuedAt.toISOString()}::timestamptz, ${dueAt.toISOString()}::timestamptz,
        ${paidAt ? paidAt.toISOString() : null}::timestamptz,
        ${inv.amount_due}, ${status}, 'stripe'
      )
      ON CONFLICT (external_id) DO UPDATE SET
        client_name = EXCLUDED.client_name,
        due_at = EXCLUDED.due_at,
        paid_at = EXCLUDED.paid_at,
        amount_cents = EXCLUDED.amount_cents,
        status = EXCLUDED.status,
        updated_at = now()
    `)
    written++
  }

  return { source: 'stripe', enabled: true, written, skipped }
}

function mapStripeInvoiceStatus(s: string | null | undefined): string {
  switch (s) {
    case 'paid':
      return 'paid'
    case 'void':
    case 'uncollectible':
      return 'void'
    case 'draft':
      return 'draft'
    case 'open':
      return 'sent'
    default:
      return 'sent'
  }
}

// ─────────────────────────────────────────────────────────────────────────
// QuickBooks Online → hq_cash_events
// ─────────────────────────────────────────────────────────────────────────
//
// QBO requires a per-realm OAuth token. We don't yet have a token store in
// HQ (that lives in the operational app per realm). Until the centralized
// token vault lands, this function is a no-op stub that reports its state
// honestly. The Stripe path stays fully functional independently.

export async function syncQboCashEvents(): Promise<SyncResult> {
  if (process.env.NZILA_HQ_BILLING_QBO !== '1') {
    return { source: 'qbo', enabled: false, written: 0, skipped: 0, reason: 'flag-off' }
  }
  // The HQ-level QBO token vault is intentionally not yet built — see the
  // comment block above for why. When it is, this function will read the
  // token, build a `QboClient`, and fan out across realms.
  return {
    source: 'qbo',
    enabled: true,
    written: 0,
    skipped: 0,
    reason: 'token-vault-not-yet-implemented',
  }
}

export async function syncAll(): Promise<{ stripe: SyncResult; qbo: SyncResult }> {
  const [stripe, qbo] = await Promise.all([syncStripeInvoices(), syncQboCashEvents()])
  return { stripe, qbo }
}

void QBO_LOOKBACK_DAYS
