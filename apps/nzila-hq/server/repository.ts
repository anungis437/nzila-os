/**
 * Server-side data layer for Nzila HQ.
 *
 * Exposes a single `getHqRepository()` factory returning a frozen, typed view
 * over the canonical seeded data set. The repository is the *only* abstraction
 * that pages and server actions are allowed to call — never reach into
 * `seed-data.ts` directly. This keeps Phase-1 in-memory data, future Drizzle
 * adapters, and future authoritative cross-app aggregations swappable behind
 * the same interface.
 */
import 'server-only'
import {
  computeAllDependencyScores,
  computeAllocation,
  computeFounderBottleneckScore,
  agingBuckets,
  burnEstimate,
  concentrationByClient,
  diffAllocation,
  generateCapitalDirectionMemo,
  generateDependencyTrendReport,
  generateMonthlyPortfolioReview,
  generatePipelineReview,
  generateTodayTopFive,
  generateUrgentRiskDigest,
  generateWeeklyCeoBrief,
  recommendDelegationMoves,
  runAutomations,
  runScenario,
  runwayMonths,
  simulateCapitalInjection,
  simulateFounderTimeReallocation,
  summarizeAllocation,
  synthesizeHistory,
  type Alert,
  type AllocationDelta,
  type AllocationScore,
  type AllocationSummary,
  type AgingReport,
  type BurnEstimate,
  type CapitalInjectionInput,
  type CashEvent,
  type ChiefOfStaffOutput,
  type ConcentrationReport,
  type Contact,
  type DelegationMove,
  type DependencyScore,
  type Document,
  type FinanceSnapshot,
  type FounderTimeReallocationInput,
  type HqUser,
  type Invoice,
  type Meeting,
  type MetricsSnapshotShape,
  type MetricsWindow,
  type Opportunity,
  type Organization,
  type PortfolioSnapshot,
  type Report,
  type SimulationResult,
  type StrategicEvent,
  type Task,
  type Venture,
} from '@nzila/hq-domain'
import {
  CONTACTS,
  DOCUMENTS,
  MEETINGS,
  NOW,
  OPPORTUNITIES,
  ORGANIZATIONS,
  PREVIOUS_MONTH_MRR_CENTS,
  STRATEGIC_EVENTS,
  TASKS,
  USERS,
  VENTURES,
} from './seed-data'

const FOUNDER_USER_ID = process.env.NZILA_HQ_FOUNDER_USER_ID ?? 'user-founder'

export interface HqRepository {
  readonly now: string
  readonly founderUserId: string

  listUsers(): readonly HqUser[]
  getUser(id: string): HqUser | undefined

  listVentures(): readonly Venture[]
  getVenture(slug: string): Venture | undefined

  listOrganizations(): readonly Organization[]
  getOrganization(id: string): Organization | undefined

  listContacts(): readonly Contact[]
  contactsForOrganization(orgId: string): readonly Contact[]

  listOpportunities(): readonly Opportunity[]
  opportunitiesForVenture(slug: string): readonly Opportunity[]

  listTasks(): readonly Task[]
  tasksForVenture(slug: string): readonly Task[]
  tasksForUser(userId: string): readonly Task[]

  listDocuments(): readonly Document[]
  documentsForVenture(slug: string): readonly Document[]

  listMeetings(): readonly Meeting[]
  upcomingStrategicEvents(limit?: number): readonly StrategicEvent[]

  // ── Computed views ──────────────────────────────────────────────────
  dependencyScores(): readonly DependencyScore[]
  /** Synthesized "previous" snapshot for trend reporting (stable approximation). */
  previousDependencyScores(): readonly DependencyScore[]
  portfolioSnapshot(): PortfolioSnapshot
  financeSnapshot(): FinanceSnapshot
  alerts(): readonly Alert[]

  // ── Reports ─────────────────────────────────────────────────────────
  weeklyCeoBrief(): Report
  pipelineReview(): Report
  dependencyTrend(): Report
  monthlyPortfolioReview(): Report

  // ── Capital allocation (Phase 5) ────────────────────────────
  allocationScores(): readonly AllocationScore[]
  allocationSummary(): AllocationSummary

  // ── Phase 2 — metrics history ────────────────────────────
  metricsHistory(window: MetricsWindow): readonly MetricsSnapshotShape[]

  // ── Phase 6 — allocation 2.0 ──────────────────────────────
  allocationDelta(): readonly AllocationDelta[]
  simulateCapital(scenario: CapitalInjectionInput): SimulationResult
  simulateFounderTime(scenario: FounderTimeReallocationInput): SimulationResult

  // ── Phase 5 — dependency 2.0 (delegation moves) ──────────────────
  delegationMoves(): readonly DelegationMove[]

  // ── Phase 4 — chief of staff ─────────────────────────────
  todayTopFive(): ChiefOfStaffOutput
  urgentRiskDigest(): ChiefOfStaffOutput
  capitalDirectionMemo(): ChiefOfStaffOutput

  // ── Phase 7 — CFO truth layer ────────────────────────────
  invoices(): readonly Invoice[]
  cashEvents(): readonly CashEvent[]
  cashOnHandCents(): number
  arAging(): AgingReport
  burn(): BurnEstimate
  cashRunwayMonths(): number | null
  clientConcentration(): ConcentrationReport
  worstCaseScenario(): ReturnType<typeof runScenario>
}

class InMemoryHqRepository implements HqRepository {
  readonly now = NOW
  readonly founderUserId = FOUNDER_USER_ID

  private readonly users = USERS
  private readonly ventures = VENTURES
  private readonly orgs = ORGANIZATIONS
  private readonly contacts = CONTACTS
  private readonly opps = OPPORTUNITIES
  private readonly tasks = TASKS
  private readonly docs = DOCUMENTS
  private readonly meetings = MEETINGS
  private readonly events = STRATEGIC_EVENTS

  // Cache computed views (called many times per render).
  private cachedScores: readonly DependencyScore[] | null = null
  private cachedAlerts: readonly Alert[] | null = null
  private cachedFinance: FinanceSnapshot | null = null
  private cachedPortfolio: PortfolioSnapshot | null = null

  listUsers() {
    return this.users
  }
  getUser(id: string) {
    return this.users.find((u) => u.id === id)
  }

  listVentures() {
    return this.ventures
  }
  getVenture(slug: string) {
    return this.ventures.find((v) => v.slug === slug)
  }

  listOrganizations() {
    return this.orgs
  }
  getOrganization(id: string) {
    return this.orgs.find((o) => o.id === id)
  }

  listContacts() {
    return this.contacts
  }
  contactsForOrganization(orgId: string) {
    return this.contacts.filter((c) => c.organizationId === orgId)
  }

  listOpportunities() {
    return this.opps
  }
  opportunitiesForVenture(slug: string) {
    return this.opps.filter((o) => o.ventureSlug === slug)
  }

  listTasks() {
    return this.tasks
  }
  tasksForVenture(slug: string) {
    return this.tasks.filter((t) => t.ventureSlug === slug)
  }
  tasksForUser(userId: string) {
    return this.tasks.filter((t) => t.ownerUserId === userId)
  }

  listDocuments() {
    return this.docs
  }
  documentsForVenture(slug: string) {
    return this.docs.filter((d) => d.ventureSlug === slug || d.ventureSlug == null)
  }

  listMeetings() {
    return this.meetings
  }
  upcomingStrategicEvents(limit = 12) {
    const now = new Date(this.now).getTime()
    return [...this.events]
      .filter((e) => new Date(e.occursAt).getTime() >= now)
      .sort((a, b) => new Date(a.occursAt).getTime() - new Date(b.occursAt).getTime())
      .slice(0, limit)
  }

  dependencyScores() {
    if (this.cachedScores) return this.cachedScores
    this.cachedScores = computeAllDependencyScores({
      founderUserId: this.founderUserId,
      ventures: [...this.ventures],
      opportunities: [...this.opps],
      tasks: [...this.tasks],
      contacts: [...this.contacts],
      now: this.now,
    })
    return this.cachedScores
  }

  /**
   * Deterministic "previous" snapshot — currently a baseline slightly worse than
   * present, so the trend report shows movement. When historical persistence
   * lands (`metrics_snapshots`), this will read from the store.
   */
  previousDependencyScores() {
    return this.dependencyScores().map((s) => ({
      ...s,
      score: Math.min(100, s.score + 8),
    }))
  }

  portfolioSnapshot() {
    if (this.cachedPortfolio) return this.cachedPortfolio
    const active = this.ventures.filter((v) => v.stage !== 'sunset')
    const totalMrr = active.reduce((s, v) => s + v.monthlyRecurringRevenueCents, 0)
    const totalPipeline = active.reduce((s, v) => s + v.pipelineValueCents, 0)
    const weighted = active.reduce((s, v) => s + v.weightedPipelineCents, 0)
    const pilots = active.reduce((s, v) => s + v.pilotsLive, 0)
    const alerts = this.alerts()
    const bottleneck = computeFounderBottleneckScore([...this.dependencyScores()], [...active])

    this.cachedPortfolio = {
      activeVentures: active.length,
      totalMrrCents: totalMrr,
      totalPipelineCents: totalPipeline,
      weightedPipelineCents: weighted,
      pilotsLive: pilots,
      strategicAlerts: alerts.filter((a) => a.severity !== 'info').length,
      founderBottleneckScore: bottleneck.score,
      founderBottleneckSignal: bottleneck.signal,
    }
    return this.cachedPortfolio
  }

  financeSnapshot() {
    if (this.cachedFinance) return this.cachedFinance
    const active = this.ventures.filter((v) => v.stage !== 'sunset')
    const totalMrr = active.reduce((s, v) => s + v.monthlyRecurringRevenueCents, 0)
    const arr = totalMrr * 12
    const pipeline = active.reduce((s, v) => s + v.pipelineValueCents, 0)
    const weighted = active.reduce((s, v) => s + v.weightedPipelineCents, 0)
    const topVentureMrr =
      active.map((v) => v.monthlyRecurringRevenueCents).sort((a, b) => b - a)[0] ?? 0
    const topShare = totalMrr === 0 ? 0 : topVentureMrr / totalMrr

    this.cachedFinance = {
      totalMrrCents: totalMrr,
      arrRunRateCents: arr,
      pipelineValueCents: pipeline,
      weightedPipelineCents: weighted,
      cacProxyCents: null,
      paybackMonths: null,
      cashRunwayMonths: 18,
      topVentureRevenueShare: topShare,
      marginByVentureCents: Object.fromEntries(active.map((v) => [v.slug, null])),
    }
    return this.cachedFinance
  }

  alerts() {
    if (this.cachedAlerts) return this.cachedAlerts
    this.cachedAlerts = runAutomations({
      founderUserId: this.founderUserId,
      now: this.now,
      ventures: [...this.ventures],
      opportunities: [...this.opps],
      tasks: [...this.tasks],
      dependencyScores: [...this.dependencyScores()],
      finance: this.financeSnapshot(),
      previousMonthMrrCents: PREVIOUS_MONTH_MRR_CENTS,
    })
    return this.cachedAlerts
  }

  weeklyCeoBrief() {
    return generateWeeklyCeoBrief({
      now: this.now,
      portfolio: this.portfolioSnapshot(),
      ventures: [...this.ventures],
      alerts: [...this.alerts()],
      dependencyScores: [...this.dependencyScores()],
    })
  }
  pipelineReview() {
    return generatePipelineReview({ now: this.now, opportunities: [...this.opps] })
  }
  dependencyTrend() {
    return generateDependencyTrendReport({
      now: this.now,
      current: [...this.dependencyScores()],
      previous: [...this.previousDependencyScores()],
    })
  }
  monthlyPortfolioReview() {
    return generateMonthlyPortfolioReview({
      now: this.now,
      portfolio: this.portfolioSnapshot(),
      finance: this.financeSnapshot(),
      ventures: [...this.ventures],
    })
  }

  // ── Capital allocation ────────────────────────────────────────────────────
  // Memoized so multiple sections of the home/allocation pages reuse one pass.
  private cachedAllocation: readonly AllocationScore[] | null = null

  allocationScores() {
    if (this.cachedAllocation) return this.cachedAllocation
    this.cachedAllocation = computeAllocation({
      now: this.now,
      ventures: [...this.ventures],
      opportunities: [...this.opps],
      dependencyScores: [...this.dependencyScores()],
      // No founder-set strategic priority store yet → engine defaults to neutral.
    })
    return this.cachedAllocation
  }

  allocationSummary() {
    return summarizeAllocation(this.allocationScores())
  }

  // ── Metrics history (Phase 2) ──────────────────────────────
  private cachedHistory: Partial<Record<MetricsWindow, readonly MetricsSnapshotShape[]>> = {}
  metricsHistory(window: MetricsWindow) {
    const cached = this.cachedHistory[window]
    if (cached) return cached
    const series = synthesizeHistory({
      now: this.now,
      window,
      ventures: [...this.ventures],
      tasks: [...this.tasks],
      dependencyScores: [...this.dependencyScores()],
      portfolio: this.portfolioSnapshot(),
      finance: this.financeSnapshot(),
    })
    this.cachedHistory[window] = series
    return series
  }

  // ── Allocation 2.0 (Phase 6) ───────────────────────────────
  /**
   * "Previous" baseline for allocation diff. Like `previousDependencyScores`,
   * this is a deterministic synthesized prior until `metrics_snapshots` lands.
   */
  private allocationInput() {
    return {
      now: this.now,
      ventures: [...this.ventures],
      opportunities: [...this.opps],
      dependencyScores: [...this.dependencyScores()],
    }
  }
  private cachedAllocationDelta: readonly AllocationDelta[] | null = null
  allocationDelta() {
    if (this.cachedAllocationDelta) return this.cachedAllocationDelta
    // Synthesize a prior by softening pipeline + worsening dependency a touch.
    const prior = computeAllocation({
      ...this.allocationInput(),
      ventures: this.ventures.map((v) => ({
        ...v,
        weightedPipelineCents: Math.round(v.weightedPipelineCents * 0.85),
      })),
      dependencyScores: this.dependencyScores().map((s) => ({
        ...s,
        score: Math.min(100, s.score + 5),
      })),
    })
    this.cachedAllocationDelta = diffAllocation(prior, this.allocationScores())
    return this.cachedAllocationDelta
  }
  simulateCapital(scenario: CapitalInjectionInput) {
    return simulateCapitalInjection(this.allocationInput(), scenario)
  }
  simulateFounderTime(scenario: FounderTimeReallocationInput) {
    return simulateFounderTimeReallocation(this.allocationInput(), scenario)
  }

  // ── Dependency 2.0 — delegation moves (Phase 5) ────────────────────
  private cachedMoves: readonly DelegationMove[] | null = null
  delegationMoves() {
    if (this.cachedMoves) return this.cachedMoves
    this.cachedMoves = recommendDelegationMoves({
      founderUserId: this.founderUserId,
      ventures: [...this.ventures],
      tasks: [...this.tasks],
      contacts: [...this.contacts],
      scores: [...this.dependencyScores()],
    })
    return this.cachedMoves
  }

  // ── Chief of Staff (Phase 4) ───────────────────────────────
  todayTopFive() {
    return generateTodayTopFive({
      now: this.now,
      tasks: [...this.tasks],
      opportunities: [...this.opps],
      alerts: [...this.alerts()],
      founderUserId: this.founderUserId,
    })
  }
  urgentRiskDigest() {
    return generateUrgentRiskDigest({
      now: this.now,
      alerts: [...this.alerts()],
      dependencyScores: [...this.dependencyScores()],
      ventures: [...this.ventures],
    })
  }
  capitalDirectionMemo() {
    return generateCapitalDirectionMemo({
      now: this.now,
      scores: this.allocationScores(),
      deltas: this.allocationDelta(),
    })
  }

  // ── CFO truth (Phase 7) ──────────────────────────────────
  // Until a real billing system is wired in, invoices and cash events are
  // *derived* from the venture seed using deterministic rules (one invoice
  // per venture per month at 1/12 of stated MRR, payroll proxy at 80% of MRR,
  // infra at 8%). The CFO page makes this provenance explicit. The shapes are
  // identical to what the future Stripe/QuickBooks adapter will produce.
  private cachedInvoices: readonly Invoice[] | null = null
  invoices() {
    if (this.cachedInvoices) return this.cachedInvoices
    const out: Invoice[] = []
    const nowMs = Date.parse(this.now)
    let counter = 0
    for (const v of this.ventures) {
      if (v.stage === 'sunset') continue
      const monthlyCents = v.monthlyRecurringRevenueCents
      if (monthlyCents === 0) continue
      // Three months of synthesized invoices per venture, varying client name
      // by venture slug so concentration is meaningful.
      for (let m = 0; m < 3; m++) {
        const issued = new Date(nowMs - (m + 1) * 30 * 86_400_000).toISOString()
        const due = new Date(nowMs - m * 30 * 86_400_000 + 5 * 86_400_000).toISOString()
        // Two synthetic clients per venture so we can show concentration.
        const clientIdx = (m + counter) % 2
        const clientOrgId = `${v.slug}-client-${clientIdx + 1}`
        const clientName = `${v.name} client ${clientIdx + 1}`
        out.push({
          id: `inv-${v.slug}-${m}`,
          ventureSlug: v.slug,
          clientOrgId,
          clientName,
          issuedAt: issued,
          dueAt: due,
          paidAt: m >= 1 ? issued : null,
          amountCents: monthlyCents,
          status: m === 0 ? 'sent' : 'paid',
        })
      }
      counter++
    }
    this.cachedInvoices = out
    return this.cachedInvoices
  }

  private cachedCashEvents: readonly CashEvent[] | null = null
  cashEvents() {
    if (this.cachedCashEvents) return this.cachedCashEvents
    const finance = this.financeSnapshot()
    const monthlyMrr = finance.totalMrrCents
    const out: CashEvent[] = []
    const nowMs = Date.parse(this.now)
    // 90 days of inflow + outflow events.
    for (let m = 0; m < 3; m++) {
      const ts = new Date(nowMs - m * 30 * 86_400_000).toISOString()
      out.push({
        id: `cash-in-${m}`,
        kind: 'inflow',
        category: 'customer-payment',
        amountCents: monthlyMrr,
        occurredAt: ts,
        ventureSlug: null,
        description: 'Monthly recurring inflow (derived from MRR)',
      })
      // Burn proxy: payroll + infra + tooling = ~110% MRR
      out.push({
        id: `cash-payroll-${m}`,
        kind: 'outflow',
        category: 'payroll',
        amountCents: Math.round(monthlyMrr * 0.8),
        occurredAt: ts,
        ventureSlug: null,
        description: 'Payroll (derived: 80% of MRR)',
      })
      out.push({
        id: `cash-infra-${m}`,
        kind: 'outflow',
        category: 'infrastructure',
        amountCents: Math.round(monthlyMrr * 0.18),
        occurredAt: ts,
        ventureSlug: null,
        description: 'Infrastructure (derived: 18% of MRR)',
      })
      out.push({
        id: `cash-tooling-${m}`,
        kind: 'outflow',
        category: 'tooling',
        amountCents: Math.round(monthlyMrr * 0.12),
        occurredAt: ts,
        ventureSlug: null,
        description: 'Tooling (derived: 12% of MRR)',
      })
    }
    this.cachedCashEvents = out
    return this.cachedCashEvents
  }

  cashOnHandCents() {
    // Derived from runway months × monthly burn so cash-on-hand stays
    // internally consistent. When real ledger lands, swap to true balance.
    const burn = this.burn()
    const months = this.financeSnapshot().cashRunwayMonths ?? 0
    if (burn.netMonthlyCents >= 0) return Math.max(0, months * 50_000_00)
    return Math.round(months * -burn.netMonthlyCents)
  }

  arAging() {
    return agingBuckets(this.invoices(), this.now)
  }
  burn() {
    return burnEstimate(this.cashEvents(), this.now, 90)
  }
  cashRunwayMonths() {
    return runwayMonths(this.cashOnHandCents(), this.burn())
  }
  clientConcentration() {
    return concentrationByClient(this.invoices())
  }
  worstCaseScenario() {
    const conc = this.clientConcentration()
    return runScenario(
      {
        cashOnHandCents: this.cashOnHandCents(),
        invoices: this.invoices(),
        events: this.cashEvents(),
        nowIso: this.now,
      },
      {
        loseClientOrgId: conc.byClient[0]?.clientOrgId,
        cutBurnPct: 0,
      },
    )
  }
}

let singleton: HqRepository | null = null
export function getHqRepository(): HqRepository {
  if (!singleton) singleton = new InMemoryHqRepository()
  return singleton
}
