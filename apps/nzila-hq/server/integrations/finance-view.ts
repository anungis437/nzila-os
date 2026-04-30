/**
 * Finance view — Phase 7 CFO real-mode wiring.
 *
 * Combines two sources for invoices and cash events:
 *  1. **Live ledger** read from `hq_invoices` / `hq_cash_events` (populated
 *     by Stripe + QuickBooks sync jobs).
 *  2. **Deterministic seed** from `getHqRepository()` (used in dev / CI /
 *     before the first real sync).
 *
 * Each source is selected independently — you can have live invoices and
 * derived cash events, or vice versa, while the sync rolls out.
 *
 * The returned `provenance` block tells the CFO page exactly which source
 * is currently in use so the founder is never confused about whether a
 * number is real or synthesized.
 */
import 'server-only'
import { cache } from 'react'
import {
  agingBuckets,
  burnEstimate,
  concentrationByClient,
  runwayMonths,
  runScenario,
  type AgingReport,
  type BurnEstimate,
  type CashEvent,
  type ConcentrationReport,
  type Invoice,
  type ScenarioResult,
} from '@nzila/hq-domain'
import { getHqRepository } from '../repository'
import { readLedgerCashEvents, readLedgerInvoices, ledgerCounts } from '../db/ledger'

export type LedgerProvenance = 'live' | 'derived'

export interface FinanceView {
  invoices: readonly Invoice[]
  cashEvents: readonly CashEvent[]
  cashOnHandCents: number
  aging: AgingReport
  burn: BurnEstimate
  runwayMonths: number | null
  concentration: ConcentrationReport
  worstCaseScenario: ScenarioResult
  provenance: {
    invoices: LedgerProvenance
    cashEvents: LedgerProvenance
    counts: { ledgerInvoices: number; ledgerCashEvents: number }
  }
}

export const buildFinanceView = cache(async (): Promise<FinanceView> => {
  const repo = getHqRepository()
  const [liveInv, liveCash, counts] = await Promise.all([
    readLedgerInvoices(),
    readLedgerCashEvents(),
    ledgerCounts(),
  ])

  const invoices: readonly Invoice[] =
    liveInv.source === 'live' ? liveInv.rows : repo.invoices()
  const cashEvents: readonly CashEvent[] =
    liveCash.source === 'live' ? liveCash.rows : repo.cashEvents()

  const nowIso = new Date().toISOString()
  const aging = agingBuckets(invoices, nowIso)
  const burn = burnEstimate(cashEvents, nowIso)
  // Mirror the repo's cash-on-hand derivation when not live; if live cash
  // events include explicit balance entries, the engine will pick them up
  // through the same burn computation.
  const cashOnHandCents = repo.cashOnHandCents()
  const runway = runwayMonths(cashOnHandCents, burn)
  const concentration = concentrationByClient(invoices)

  // Worst-case = lose top client.
  const topClientId = concentration.byClient[0]?.clientOrgId ?? null
  const scenario = runScenario(
    { nowIso, invoices, events: cashEvents, cashOnHandCents },
    { loseClientOrgId: topClientId ?? undefined },
  )

  return {
    invoices,
    cashEvents,
    cashOnHandCents,
    aging,
    burn,
    runwayMonths: runway,
    concentration,
    worstCaseScenario: scenario,
    provenance: {
      invoices: liveInv.source === 'live' ? 'live' : 'derived',
      cashEvents: liveCash.source === 'live' ? 'live' : 'derived',
      counts: { ledgerInvoices: counts.invoices, ledgerCashEvents: counts.cashEvents },
    },
  }
})
