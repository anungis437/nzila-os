/**
 * @nzila/platform-intelligence-home — Shared Types
 *
 * Canonical types for the Intelligence Home service layer.
 * Used across funding, deal, partner, scoring, risk, briefing, and sync services.
 */

// ── Funding Opportunity (enriched view over FundingProgram) ──────────────────

export type FundingStatus = 'apply' | 'watch' | 'submitted' | 'awarded' | 'rejected' | 'expired'

export interface FundingOpportunity {
  /** Matches FundingProgram.id */
  id: string
  name: string
  agency: string
  government: string
  fundingType: string
  typicalMinCad: number | null
  typicalMaxCad: number | null
  deadline: string | null
  /** Days until deadline. Null = rolling / no deadline */
  daysUntilDeadline: number | null
  status: FundingStatus
  /** 0-100 confidence score (eligibility × timing × effort) */
  confidenceScore: number
  nzilaFit: string
  relevantDomains: readonly string[]
  isRecurring: boolean
  intakeTiming: string
  url: string
  notes: string | null
}

// ── Deal Pipeline ────────────────────────────────────────────────────────────

export type DealStage =
  | 'discovery'
  | 'proposal'
  | 'negotiation'
  | 'pilot_active'
  | 'closed_won'
  | 'closed_lost'
  | 'stale'
  | 'prospect'

export type DealType =
  | 'pilot'
  | 'sponsor'
  | 'enterprise_sales'
  | 'channel'
  | 'law_firm_partnership'
  | 'research'
  | 'distribution'
  | 'grant'

export interface Deal {
  id: string
  name: string
  org: string
  product: string
  dealType: DealType
  stage: DealStage
  estimatedValueCad: number
  owner: string
  probability: number
  expectedCloseDate: string | null
  nextStep: string
  lastActivityDate: string
  /** Days since last activity */
  daysSinceActivity: number
  notes: string | null
}

export interface DealKpis {
  totalDeals: number
  weightedPipelineCad: number
  avgProbability: number
  staleDeals: number
  closedWonCount: number
  closedWonValueCad: number
  pilotCount: number
  sponsorCount: number
}

// ── Partner Map ──────────────────────────────────────────────────────────────

export type PartnerType =
  | 'union'
  | 'law_firm'
  | 'music_house'
  | 'smb_channel'
  | 'government_agency'
  | 'research_institution'
  | 'insurer'
  | 'pension_fund'
  | 'ngo'
  | 'media'
  | 'tech_partner'
  | 'foundation'
  | 'financial_institution'

export type PartnerStatus = 'active' | 'prospect' | 'negotiating' | 'paused' | 'inactive'

export interface Partner {
  id: string
  name: string
  partnerType: PartnerType
  primaryDomain: string
  status: PartnerStatus
  annualValueCad: number
  agreementTypes: string[]
  contactName: string | null
  contactEmail: string | null
  notes: string | null
}

export interface PartnerKpis {
  totalPartners: number
  activePartners: number
  prospects: number
  totalAnnualValueCad: number
}

// ── Product Scoring ──────────────────────────────────────────────────────────

export interface ProductScore {
  productId: string
  productName: string
  rank: number
  totalScore: number
  pipelineDemand: number
  strategicFit: number
  revenueSpeed: number
  implementationReadiness: number
  founderLeverage: number
  strengths: string[]
  gaps: string[]
  /** Recommended weekly focus hours */
  recommendedFocusHours: number
}

// ── Risk ─────────────────────────────────────────────────────────────────────

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low'
export type RiskCategory = 'capital' | 'execution' | 'pipeline' | 'data' | 'strategic' | 'timing'

export interface Risk {
  id: string
  category: RiskCategory
  severity: RiskSeverity
  title: string
  detail: string
  recommendedAction: string
  detectedAt: string
}

// ── Briefing ─────────────────────────────────────────────────────────────────

export type BriefingActionCategory =
  | 'funding'
  | 'deal'
  | 'product'
  | 'risk_mitigation'
  | 'admin'
  | 'data'

export interface BriefingAction {
  id: string
  priority: number
  category: BriefingActionCategory
  title: string
  rationale: string
  estimatedImpact: string | null
  dueDate: string | null
  product: string | null
}

export interface WeeklyBriefing {
  generatedAt: string
  weekEnding: string
  northStar: string
  actions: BriefingAction[]
  fundingDeadlinesIn30d: number
  staleDeals: number
  openRisks: number
}

// ── Data Sync ────────────────────────────────────────────────────────────────

export type SyncStatus = 'healthy' | 'stale' | 'failed' | 'never_run' | 'running'

export interface DataSourceHealth {
  sourceId: string
  sourceName: string
  category: string
  status: SyncStatus
  lastSyncAt: string | null
  lastSyncRecords: number
  nextScheduledAt: string | null
  errorMessage: string | null
  isPublic: boolean
}

export interface SyncHealthKpis {
  total: number
  healthy: number
  stale: number
  failed: number
  neverRun: number
  healthPct: number
}

// ── Dashboard KPIs ───────────────────────────────────────────────────────────

export interface DashboardKpis {
  openFundingCount: number
  totalFundingAvailableCad: number
  weightedPipelineCad: number
  activePartners: number
  productsInFocus: number
  deadlinesIn30d: number
  dataSourceHealthPct: number
  openRisksCount: number
  criticalRisksCount: number
}

// ── Executive Intelligence ───────────────────────────────────────────────────

export type InsightSignal = 'opportunity' | 'warning' | 'trend' | 'action_required'

export interface ExecutiveInsight {
  id: string
  signal: InsightSignal
  /** Lower = higher priority */
  priority: number
  title: string
  body: string
  product: string | null
  /** 0–100 confidence score */
  confidence: number
  /** Which service produced this insight */
  source: string
}

export type DecisionQuestion =
  | 'where_to_spend_20_hours'
  | 'next_dollar_product'
  | 'most_likely_close'
  | 'highest_roi_grant'
  | 'partner_unlock_most'

export interface FounderDecision {
  question: DecisionQuestion
  questionLabel: string
  answer: string
  rationale: string
  confidence: number
  dataPoints: string[]
  value: string | null
}

export type MichelActionType =
  | 'legal_review'
  | 'negotiation'
  | 'sponsor_call'
  | 'grant_submission'
  | 'strategic_intro'
  | 'deal_advance'
  | 'approve_document'

export interface MichelAction {
  id: string
  actionType: MichelActionType
  /** 1 = do this week, 2 = this week if time, 3 = this month */
  priority: 1 | 2 | 3
  title: string
  /** What's happening and why it needs attention */
  context: string
  /** Why Michel specifically should own this — the strategic leverage */
  leverage: string
  estimatedTime: string
  product: string | null
  dueBy: string | null
}
