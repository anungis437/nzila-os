/**
 * CFO Finance Truth — Phase 7.
 *
 * Three pure capabilities the cockpit's `/finance` and `/finance/cfo` pages need:
 *   1. AR aging buckets (current / 1-30 / 31-60 / 61-90 / 90+).
 *   2. Burn estimate + runway projection from a stream of cash events.
 *   3. Client/venture concentration (Herfindahl-Hirschman style).
 *   4. Scenario simulation: "what if we lose top client?" / "what if we cut burn 20%?"
 *
 * All inputs are typed; nothing reads files or env. The cockpit will inject
 * these from the repository.
 */

// ── Inputs ─────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void' | 'overdue'

export interface Invoice {
  id: string
  ventureSlug: string
  clientOrgId: string
  clientName: string
  issuedAt: string
  dueAt: string
  paidAt: string | null
  amountCents: number
  status: InvoiceStatus
}

export type CashEventKind = 'inflow' | 'outflow'
export type CashEventCategory =
  | 'customer-payment'
  | 'payroll'
  | 'infrastructure'
  | 'tooling'
  | 'contractor'
  | 'capital-raise'
  | 'other'

export interface CashEvent {
  id: string
  kind: CashEventKind
  category: CashEventCategory
  amountCents: number
  occurredAt: string
  ventureSlug: string | null
  description: string
}

// ── 1) AR aging ────────────────────────────────────────────────────────────

export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+'

export interface AgingReport {
  buckets: Record<AgingBucket, { count: number; totalCents: number }>
  overdueCents: number
  receivableCents: number
}

export function agingBuckets(invoices: readonly Invoice[], nowIso: string): AgingReport {
  const now = Date.parse(nowIso)
  const empty: AgingReport['buckets'] = {
    current: { count: 0, totalCents: 0 },
    '1-30': { count: 0, totalCents: 0 },
    '31-60': { count: 0, totalCents: 0 },
    '61-90': { count: 0, totalCents: 0 },
    '90+': { count: 0, totalCents: 0 },
  }
  let overdue = 0
  let receivable = 0
  for (const inv of invoices) {
    if (inv.status === 'paid' || inv.status === 'void' || inv.status === 'draft') continue
    receivable += inv.amountCents
    const due = Date.parse(inv.dueAt)
    const daysPast = Math.floor((now - due) / 86_400_000)
    let bucket: AgingBucket
    if (daysPast <= 0) bucket = 'current'
    else if (daysPast <= 30) bucket = '1-30'
    else if (daysPast <= 60) bucket = '31-60'
    else if (daysPast <= 90) bucket = '61-90'
    else bucket = '90+'
    empty[bucket].count += 1
    empty[bucket].totalCents += inv.amountCents
    if (daysPast > 0) overdue += inv.amountCents
  }
  return { buckets: empty, overdueCents: overdue, receivableCents: receivable }
}

// ── 2) Burn + runway ───────────────────────────────────────────────────────

export interface BurnEstimate {
  monthlyBurnCents: number
  monthlyInflowCents: number
  netMonthlyCents: number // negative = burning, positive = profitable
  windowDays: number
  byCategoryCents: Record<CashEventCategory, number>
}

export function burnEstimate(
  events: readonly CashEvent[],
  nowIso: string,
  windowDays = 90,
): BurnEstimate {
  const now = Date.parse(nowIso)
  const cutoff = now - windowDays * 86_400_000
  const byCategory: Record<CashEventCategory, number> = {
    'customer-payment': 0,
    payroll: 0,
    infrastructure: 0,
    tooling: 0,
    contractor: 0,
    'capital-raise': 0,
    other: 0,
  }
  let inflow = 0
  let outflow = 0
  for (const e of events) {
    const ts = Date.parse(e.occurredAt)
    if (ts < cutoff || ts > now) continue
    byCategory[e.category] += e.amountCents
    if (e.kind === 'inflow') inflow += e.amountCents
    else outflow += e.amountCents
  }
  const monthFactor = 30 / windowDays
  return {
    monthlyBurnCents: Math.round(outflow * monthFactor),
    monthlyInflowCents: Math.round(inflow * monthFactor),
    netMonthlyCents: Math.round((inflow - outflow) * monthFactor),
    windowDays,
    byCategoryCents: byCategory,
  }
}

export function runwayMonths(
  cashOnHandCents: number,
  burn: BurnEstimate,
): number | null {
  // If we're net-positive, runway is "infinite" — return null and let UI show ∞.
  if (burn.netMonthlyCents >= 0) return null
  const monthlyNetBurn = -burn.netMonthlyCents
  if (monthlyNetBurn <= 0) return null
  return Math.max(0, Math.round((cashOnHandCents / monthlyNetBurn) * 10) / 10)
}

// ── 3) Concentration ───────────────────────────────────────────────────────

export interface ConcentrationReport {
  totalCents: number
  /** Sorted high-to-low. */
  byClient: { clientOrgId: string; clientName: string; share: number; cents: number }[]
  /** 0..1 — Herfindahl index (sum of squared shares). 1 = single client, 0 = perfectly diversified. */
  herfindahl: number
  /** Top client share. */
  topShare: number
}

export function concentrationByClient(invoices: readonly Invoice[]): ConcentrationReport {
  const totals = new Map<string, { name: string; cents: number }>()
  let total = 0
  for (const inv of invoices) {
    if (inv.status === 'void' || inv.status === 'draft') continue
    const cur = totals.get(inv.clientOrgId)
    if (cur) cur.cents += inv.amountCents
    else totals.set(inv.clientOrgId, { name: inv.clientName, cents: inv.amountCents })
    total += inv.amountCents
  }
  const byClient = Array.from(totals.entries())
    .map(([clientOrgId, v]) => ({
      clientOrgId,
      clientName: v.name,
      cents: v.cents,
      share: total === 0 ? 0 : v.cents / total,
    }))
    .sort((a, b) => b.cents - a.cents)
  const herfindahl = byClient.reduce((s, c) => s + c.share * c.share, 0)
  return {
    totalCents: total,
    byClient,
    herfindahl: Number(herfindahl.toFixed(4)),
    topShare: byClient[0]?.share ?? 0,
  }
}

// ── 4) Scenario simulation ─────────────────────────────────────────────────

export interface FinanceScenarioInput {
  cashOnHandCents: number
  invoices: readonly Invoice[]
  events: readonly CashEvent[]
  nowIso: string
}

export interface ScenarioDeltas {
  /** Fraction of monthly outflow to cut (0..1). */
  cutBurnPct?: number
  /** Client org id whose AR + future revenue is removed entirely. */
  loseClientOrgId?: string
  /** Additional one-time capital raise amount in cents. */
  raiseCents?: number
  /** Additional monthly recurring inflow added (e.g. closing top deal). */
  newMonthlyInflowCents?: number
}

export interface ScenarioResult {
  baseline: { burn: BurnEstimate; runwayMonths: number | null; concentration: ConcentrationReport }
  scenario: { burn: BurnEstimate; runwayMonths: number | null; concentration: ConcentrationReport; cashOnHandCents: number }
  notes: string[]
}

export function runScenario(
  input: FinanceScenarioInput,
  deltas: ScenarioDeltas,
): ScenarioResult {
  const baselineBurn = burnEstimate(input.events, input.nowIso)
  const baselineConc = concentrationByClient(input.invoices)
  const baselineRunway = runwayMonths(input.cashOnHandCents, baselineBurn)

  // Apply scenario.
  const notes: string[] = []
  let scenarioEvents = [...input.events]
  let scenarioInvoices = [...input.invoices]
  let cash = input.cashOnHandCents

  if (deltas.cutBurnPct && deltas.cutBurnPct > 0) {
    const factor = 1 - Math.min(0.95, deltas.cutBurnPct)
    scenarioEvents = scenarioEvents.map((e) =>
      e.kind === 'outflow' ? { ...e, amountCents: Math.round(e.amountCents * factor) } : e,
    )
    notes.push(`Cut all outflow categories by ${Math.round(deltas.cutBurnPct * 100)}%.`)
  }
  if (deltas.loseClientOrgId) {
    const lost = scenarioInvoices.filter((i) => i.clientOrgId === deltas.loseClientOrgId)
    scenarioInvoices = scenarioInvoices.filter((i) => i.clientOrgId !== deltas.loseClientOrgId)
    notes.push(`Removed ${lost.length} invoice(s) from client ${deltas.loseClientOrgId}.`)
  }
  if (deltas.raiseCents && deltas.raiseCents > 0) {
    cash += deltas.raiseCents
    notes.push(`One-time capital injection of ${dollars(deltas.raiseCents)}.`)
  }
  if (deltas.newMonthlyInflowCents && deltas.newMonthlyInflowCents > 0) {
    // Synthesize a representative inflow event over the burn window.
    scenarioEvents.push({
      id: 'sim-monthly-inflow',
      kind: 'inflow',
      category: 'customer-payment',
      amountCents: deltas.newMonthlyInflowCents * 3, // 3 months in the 90d window
      occurredAt: input.nowIso,
      ventureSlug: null,
      description: 'Simulated new monthly inflow',
    })
    notes.push(`Add ${dollars(deltas.newMonthlyInflowCents)}/mo new recurring inflow.`)
  }

  const scenarioBurn = burnEstimate(scenarioEvents, input.nowIso)
  const scenarioConc = concentrationByClient(scenarioInvoices)
  const scenarioRunway = runwayMonths(cash, scenarioBurn)

  return {
    baseline: { burn: baselineBurn, runwayMonths: baselineRunway, concentration: baselineConc },
    scenario: { burn: scenarioBurn, runwayMonths: scenarioRunway, concentration: scenarioConc, cashOnHandCents: cash },
    notes,
  }
}

function dollars(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('en-CA')}`
}
