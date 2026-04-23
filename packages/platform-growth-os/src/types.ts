/**
 * @nzila/platform-growth-os — Public types
 *
 * Internal-agency operating layer. Composes the existing CRM/partner/decision
 * packages; does not replace them.
 *
 * Naming convention: every entity is org-scoped via {@link GrowthScope}.
 */

export const GROWTH_OS_VERSION = '0.1.0'

// ── Scope ───────────────────────────────────────────────────────────────────

/**
 * The scope every growth-os record is partitioned by. Mirrors the
 * (tenant, org, ...) pattern used by `@nzila/platform-cognition-core`.
 */
export interface GrowthScope {
  tenantId: string
  orgId: string
  /** Optional product/vertical (e.g. 'union-eyes', 'flow', 'zonga'). */
  product?: string
}

// ── Brand voice ─────────────────────────────────────────────────────────────

/** Voice profile used by creative briefs to enforce tone consistency. */
export interface BrandVoice {
  id: string
  scope: GrowthScope
  /** Display name (e.g. 'Union Eyes — operator', 'Founder — Aubert'). */
  label: string
  /** Hard tone rules. Short, declarative. */
  tone: string[]
  /** Phrases that must NEVER appear (anti-fluff guardrails). */
  forbiddenPhrases: string[]
  /** Required claim-level posture. */
  trustPosture: 'evidence-first' | 'proof-first' | 'neutral'
  /** Required disclosures (e.g. 'AI-generated', 'pilot-stage'). */
  requiredDisclosures: string[]
  createdAt: string
  updatedAt: string
}

// ── Campaign primitives ─────────────────────────────────────────────────────

export type CampaignChannel =
  | 'email'
  | 'landing_page'
  | 'partner_co_sell'
  | 'founder_outbound'
  | 'enterprise_procurement'
  | 'event'
  | 'paid'

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'paused'
  | 'completed'
  | 'archived'

/** A single campaign record. */
export interface Campaign {
  id: string
  scope: GrowthScope
  name: string
  /** Free-form objective in operator language (e.g. 'Convert CUPE pilot to paid'). */
  objective: string
  /** Channels in scope. */
  channels: CampaignChannel[]
  /** Audience segment IDs. */
  audienceSegmentIds: string[]
  /** Brand voice this campaign is bound to. */
  brandVoiceId: string
  /** Approved offer IDs (commercial packets). */
  offerIds: string[]
  /** Optional founder/operator owner. */
  ownerId?: string
  status: CampaignStatus
  /** Inclusive start (ISO). */
  startsAt?: string
  /** Inclusive end (ISO). */
  endsAt?: string
  /** Free-form tags for segmentation. */
  tags: string[]
  createdAt: string
  updatedAt: string
}

/** A definition of a target audience used by one or more campaigns. */
export interface AudienceSegment {
  id: string
  scope: GrowthScope
  label: string
  /** Filter description in operator language (declarative). */
  description: string
  /** Hard predicates — interpreted by the matching engine. */
  predicates: AudiencePredicate[]
  /** Estimated size (for explainable display). Computed and updated by the engine. */
  estimatedSize?: number
  estimatedAt?: string
  createdAt: string
  updatedAt: string
}

/** A single declarative predicate over an arbitrary subject record. */
export interface AudiencePredicate {
  field: string
  op: 'eq' | 'in' | 'gte' | 'lte' | 'has_tag' | 'matches'
  value: string | number | string[]
}

/** A campaign run is a single dispatch of a campaign at a point in time. */
export interface CampaignRun {
  id: string
  scope: GrowthScope
  campaignId: string
  /** Variant chosen for this run (must be a content asset id). */
  contentAssetId: string
  /** Number of subjects targeted at run start. */
  audienceSize: number
  startedAt: string
  /** Optional terminal time. */
  completedAt?: string
  /** Outcome counts; `null` until set by the engine. */
  result?: CampaignRunResult
}

export interface CampaignRunResult {
  reached: number
  responded: number
  converted: number
  /** Net pipeline created (CAD; sum of opportunity estimated values). */
  pipelineCreated?: number
  /** Free-form notes captured by the operator. */
  notes?: string
}

/** A reusable content asset (copy, landing page, brief, etc.). */
export interface ContentAsset {
  id: string
  scope: GrowthScope
  campaignId?: string
  brandVoiceId: string
  channel: CampaignChannel
  /** Asset kind. */
  kind:
    | 'email_copy'
    | 'landing_page_brief'
    | 'one_pager'
    | 'objection_card'
    | 'sequence'
    | 'roi_packet'
    | 'partner_kit'
    | 'social_post'
  title: string
  /** Operator-written body. No LLM-generated content stored here unsigned. */
  body: string
  /** Required source-of-truth doc references (paths under `docs/commercial/`). */
  sources: string[]
  /** Approval state — every public-facing asset must reach 'approved'. */
  approval: ApprovalState
  approvedBy?: string
  approvedAt?: string
  createdAt: string
  updatedAt: string
  version: number
}

export type ApprovalState = 'draft' | 'in_review' | 'approved' | 'rejected'

/** A commercial packet — the assembled artifact a buyer receives. */
export interface CommercialOffer {
  id: string
  scope: GrowthScope
  /** Internal label. */
  label: string
  /** Which product this packet is for. */
  product: string
  /** Buyer archetype (matches IDEAL_CUSTOMER_PROFILE_MATRIX.md). */
  buyerType: string
  /** Pilot duration in days. */
  pilotDurationDays?: number
  /** Reference price in CAD (per pilot, before subscription). */
  pilotPriceCad?: number
  /** Annual subscription range in CAD (low–high). */
  annualPriceLowCad?: number
  annualPriceHighCad?: number
  /** Required packet components. */
  components: OfferComponent[]
  approval: ApprovalState
  createdAt: string
  updatedAt: string
}

export interface OfferComponent {
  kind: 'roi_brief' | 'security_one_pager' | 'pilot_offer' | 'demo_script' | 'objection_pack' | 'trust_link'
  /** Reference to a content asset id OR an external doc path. */
  ref: string
}

// ── Lead / deal scoring ─────────────────────────────────────────────────────

export type LeadStage =
  | 'unscored'
  | 'cold'
  | 'warming'
  | 'engaged'
  | 'qualified'
  | 'in_pilot'
  | 'paid'
  | 'expansion'
  | 'churn_risk'
  | 'dormant'

export interface LeadScoreFeatures {
  /** Days since most recent meaningful event. */
  recencyDays: number
  /** Number of meaningful events in window. */
  eventCount: number
  /** Number of distinct touchpoints (channel diversity). */
  channelDiversity: number
  /** Sum of positive valence signals (-1..+inf). */
  positiveSignal: number
  /** Sum of negative valence signals (-1..+inf). */
  negativeSignal: number
  /** Whether a pilot exists today. */
  hasActivePilot: boolean
  /** Whether the prospect has procurement engagement. */
  hasProcurementSignal: boolean
  /** Whether a partner is sourcing/influencing the deal. */
  partnerInfluenced: boolean
}

export interface LeadScore {
  id: string
  scope: GrowthScope
  /** The thing being scored (a CRM contact id, deal id, partner deal id, …). */
  subjectKind: 'contact' | 'opportunity' | 'partner_deal' | 'pilot'
  subjectId: string
  /** [0,1] composite score. */
  score: number
  /** Recommended next stage. */
  stage: LeadStage
  /** Confidence in [0,1] driven by data sufficiency. */
  confidence: number
  /** Per-feature contribution for the explain panel. */
  contributions: ScoreContribution[]
  /** Algorithm version (mirrors cognition pattern). */
  modelVersion: string
  scoredAt: string
}

export interface ScoreContribution {
  feature: keyof LeadScoreFeatures
  weight: number
  value: number
  contribution: number
}

// ── Next-best-action ────────────────────────────────────────────────────────

export type NextActionKind =
  | 'send_followup'
  | 'send_proof_packet'
  | 'request_intro'
  | 'request_testimonial'
  | 'schedule_demo'
  | 'escalate_to_founder'
  | 'pause_outreach'
  | 'upsell_pitch'
  | 'partner_co_sell'

export interface NextBestAction {
  scope: GrowthScope
  subjectKind: LeadScore['subjectKind']
  subjectId: string
  action: NextActionKind
  /** Operator-readable rationale; never a hallucinated claim. */
  rationale: string
  /** Time horizon for the action (hours). */
  withinHours: number
  /** Confidence in [0,1] inherited from the underlying score. */
  confidence: number
  /** Source score id (for audit). */
  sourceScoreId: string
  generatedAt: string
}

// ── Attribution ─────────────────────────────────────────────────────────────

export type AttributionEventKind =
  | 'campaign_touch'
  | 'partner_referral'
  | 'organic_visit'
  | 'founder_outreach'
  | 'demo_attended'
  | 'pilot_started'
  | 'opportunity_created'
  | 'quote_sent'
  | 'deal_closed_won'
  | 'deal_closed_lost'

export interface AttributionEvent {
  id: string
  scope: GrowthScope
  subjectKind: 'contact' | 'opportunity' | 'pilot' | 'deal'
  subjectId: string
  kind: AttributionEventKind
  /** Optional channel for the touch. */
  channel?: CampaignChannel
  /** Optional campaign run id. */
  campaignRunId?: string
  /** Optional partner id. */
  partnerId?: string
  /** Optional revenue impact in CAD (set on closed_won, expansion, etc.). */
  revenueCad?: number
  occurredAt: string
  recordedAt: string
}

export type AttributionModel = 'first_touch' | 'last_touch' | 'linear' | 'time_decay' | 'position'

export interface AttributionResult {
  scope: GrowthScope
  subjectId: string
  model: AttributionModel
  totalRevenueCad: number
  /** Contribution per source (channel, partner id, or campaign id). */
  contributions: AttributionContribution[]
  computedAt: string
}

export interface AttributionContribution {
  source: string
  sourceKind: 'channel' | 'partner' | 'campaign'
  weight: number
  revenueCad: number
}

// ── Proof capture ───────────────────────────────────────────────────────────

export type ProofRequestStatus =
  | 'requested'
  | 'awaiting_permission'
  | 'permission_granted'
  | 'awaiting_quote'
  | 'awaiting_kpi'
  | 'awaiting_legal'
  | 'ready_to_publish'
  | 'published'
  | 'declined'
  | 'cancelled'

export interface ProofRequest {
  id: string
  scope: GrowthScope
  /** Pilot/case the proof is about. */
  subjectKind: 'pilot' | 'opportunity' | 'partner_deal'
  subjectId: string
  /** Proof artifact kind. */
  proofKind: 'testimonial' | 'case_study' | 'reference_call' | 'logo' | 'kpi_baseline'
  /** Customer-facing display name (with permission). */
  customerLabel?: string
  status: ProofRequestStatus
  /** Required KPI baselines for the case study. */
  kpiBaselines: ProofKpiBaseline[]
  /** Quote text (operator-captured; never invented). */
  quoteText?: string
  quoteAttribution?: string
  /** Permission record (signed off). */
  permission?: ProofPermission
  /** Where the asset is published (URL or doc path). */
  publishedAt?: string
  publishedRef?: string
  createdAt: string
  updatedAt: string
}

export interface ProofKpiBaseline {
  metric: string
  baselineValue: number
  observedValue?: number
  unit: string
  capturedAt?: string
}

export interface ProofPermission {
  grantedBy: string
  grantedAt: string
  scope: 'logo_only' | 'name_quote' | 'full_case_study' | 'reference_call'
  expiresAt?: string
}

// ── Founder narrative ───────────────────────────────────────────────────────

export interface FounderTopic {
  id: string
  scope: GrowthScope
  ownerId: string
  /** Narrative theme (e.g. 'consent-native AI for regulated verticals'). */
  theme: string
  /** Audiences this topic serves. */
  audiences: Array<'investor' | 'partner' | 'customer' | 'media' | 'community'>
  /** Talking points — short, declarative, evidence-backed. */
  talkingPoints: string[]
  /** Sources / proof refs. */
  sources: string[]
  /** Recurrence cadence in days (how often to surface as content). */
  cadenceDays: number
  /** Last surfaced as content (ISO). */
  lastSurfacedAt?: string
  status: 'active' | 'snoozed' | 'retired'
  createdAt: string
  updatedAt: string
}

// ── Generic ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  scope: GrowthScope
  actor: string
  action: string
  subjectKind: string
  subjectId: string
  metadata?: Record<string, unknown>
  occurredAt: string
}
