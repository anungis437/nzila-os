/**
 * Ledger readers — Phase 7 CFO real mode.
 *
 * Pulls real invoices and cash events from `hq_invoices` / `hq_cash_events`
 * (populated by the Stripe + QuickBooks sync jobs in
 * `server/integrations/billing-sync.ts`). Returns `null` when the database
 * is unavailable or empty so callers can transparently fall back to the
 * deterministic seed-derived values.
 *
 * Both readers cap at 365 days back so a runaway sync can't OOM the cockpit.
 * Per-request memoization via React `cache()` keeps a single page render
 * from hitting the DB twice for the same dataset.
 */
import 'server-only'
import { cache } from 'react'
import { and, desc, gt, isNull, sql } from 'drizzle-orm'
import type { CashEvent, Invoice, InvoiceStatus, CashEventCategory, CashEventKind } from '@nzila/hq-domain'
import { getHqDb } from '../db/client'
import { invoices as invoicesTable, cashEvents as cashEventsTable } from '../db/schema'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

export interface LedgerReadResult<T> {
  rows: readonly T[]
  source: 'live' | 'empty' | 'no-db'
}

export const readLedgerInvoices = cache(async (): Promise<LedgerReadResult<Invoice>> => {
  const db = getHqDb()
  if (!db) return { rows: [], source: 'no-db' }
  try {
    const since = new Date(Date.now() - ONE_YEAR_MS)
    const rows = await db
      .select()
      .from(invoicesTable)
      .where(and(isNull(invoicesTable.deletedAt), gt(invoicesTable.issuedAt, since)))
      .orderBy(desc(invoicesTable.issuedAt))
      .limit(2000)
    if (rows.length === 0) return { rows: [], source: 'empty' }
    const mapped: Invoice[] = rows.map((r) => ({
      id: r.id,
      ventureSlug: r.ventureSlug,
      clientOrgId: r.clientOrgId,
      clientName: r.clientName,
      issuedAt: r.issuedAt.toISOString(),
      dueAt: r.dueAt.toISOString(),
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      amountCents: r.amountCents,
      status: r.status as InvoiceStatus,
    }))
    return { rows: mapped, source: 'live' }
  } catch (err) {
    console.error('[ledger] readLedgerInvoices failed', String(err))
    return { rows: [], source: 'no-db' }
  }
})

export const readLedgerCashEvents = cache(async (): Promise<LedgerReadResult<CashEvent>> => {
  const db = getHqDb()
  if (!db) return { rows: [], source: 'no-db' }
  try {
    const since = new Date(Date.now() - ONE_YEAR_MS)
    const rows = await db
      .select()
      .from(cashEventsTable)
      .where(and(isNull(cashEventsTable.deletedAt), gt(cashEventsTable.occurredAt, since)))
      .orderBy(desc(cashEventsTable.occurredAt))
      .limit(5000)
    if (rows.length === 0) return { rows: [], source: 'empty' }
    const mapped: CashEvent[] = rows.map((r) => ({
      id: r.id,
      kind: r.kind as CashEventKind,
      category: r.category as CashEventCategory,
      amountCents: r.amountCents,
      occurredAt: r.occurredAt.toISOString(),
      ventureSlug: r.ventureSlug ?? null,
      description: r.description,
    }))
    return { rows: mapped, source: 'live' }
  } catch (err) {
    console.error('[ledger] readLedgerCashEvents failed', String(err))
    return { rows: [], source: 'no-db' }
  }
})

/** Returns `{count}` for invoice/cash rows in the ledger, used for the CFO provenance card. */
export const ledgerCounts = cache(
  async (): Promise<{ invoices: number; cashEvents: number }> => {
    const db = getHqDb()
    if (!db) return { invoices: 0, cashEvents: 0 }
    try {
      const [invRow] = await db.execute<{ n: string }>(
        sql`SELECT count(*)::text AS n FROM hq_invoices WHERE deleted_at IS NULL`,
      )
      const [cashRow] = await db.execute<{ n: string }>(
        sql`SELECT count(*)::text AS n FROM hq_cash_events WHERE deleted_at IS NULL`,
      )
      return {
        invoices: Number(invRow?.n ?? 0),
        cashEvents: Number(cashRow?.n ?? 0),
      }
    } catch {
      return { invoices: 0, cashEvents: 0 }
    }
  },
)
