/**
 * @nzila/platform-growth-os — Outreach Sequence types
 *
 * Defines step-by-step cadences for cold, warm, and post-event outbound.
 * Sequences are linked to deal-engine stages and ICP segments.
 *
 * Design: sequences are data, not code. Each step has a
 * delay, channel, template reference, and personalisation fields.
 * The sequence engine does NOT send emails — it produces step instructions
 * that the operator executes (manual or via CRM integration).
 */
import type { GrowthScope } from '../types'

// ── Channels ─────────────────────────────────────────────────────────────────

export type SequenceChannel =
  | 'email'
  | 'linkedin_connection'
  | 'linkedin_message'
  | 'phone'
  | 'video_voicemail'
  | 'partner_intro'
  | 'in_person'

// ── Template references ───────────────────────────────────────────────────────

/**
 * Links to assets in docs/commercial/sales-kit/ and
 * docs/commercial/close-package/. String keys — no file system coupling.
 */
export type SequenceTemplateId =
  | 'cold-email-ue-intro'
  | 'cold-email-ue-pain-hook'
  | 'warm-intro-email'
  | 'post-event-email-day0'
  | 'post-event-email-day2'
  | 'post-event-email-day5'
  | 'demo-followup-email-day0'
  | 'demo-followup-email-day2'
  | 'demo-followup-email-day5'
  | 'demo-followup-email-day7'
  | 'demo-followup-email-day10'
  | 'pilot-proposal-email'
  | 'procurement-intake-email'
  | 'procurement-follow-email'
  | 're-engagement-email'
  | 'roi-calculator-share'
  | 'trust-pack-share'
  | 'case-study-share'
  | 'linkedin-connection-note'
  | 'phone-voicemail-script'

// ── Sequence types ────────────────────────────────────────────────────────────

export type SequenceKind =
  | 'cold'
  | 'warm_intro'
  | 'post_event'
  | 'demo_followup'
  | 'procurement'
  | 're_engagement'
  | 'pilot_close'

// ── Step ─────────────────────────────────────────────────────────────────────

export interface SequenceStep {
  stepNumber: number
  /** Delay in hours from previous step (0 = send immediately). */
  delayHours: number
  channel: SequenceChannel
  templateId: SequenceTemplateId
  /**
   * Fields the sender must personalise before sending.
   * e.g. ['contactFirstName', 'localNumber', 'memberCount']
   */
  personalisationFields: string[]
  /** Condition that must be true before sending (null = always send). */
  sendCondition: string | null
  /** Stop the sequence if this event is received. */
  stopOnEvent: string | null
  /** Goal of this specific step. */
  goal: string
}

// ── Sequence ──────────────────────────────────────────────────────────────────

export interface OutreachSequence {
  id: string
  scope: GrowthScope
  label: string
  kind: SequenceKind
  description: string
  /** Target ICP tier(s) for which this sequence is appropriate. */
  targetTiers: ('A' | 'B' | 'C')[]
  /** Deal-engine stage at which this sequence should be triggered. */
  triggerStage: string
  steps: SequenceStep[]
  /** Expected reply rate [0–1] — honest estimate, not a guarantee. */
  benchmarkReplyRate: number | null
  createdAt: string
  updatedAt: string
}

// ── Active sequence instance ──────────────────────────────────────────────────

export type SequenceInstanceStatus = 'active' | 'paused' | 'completed' | 'stopped'

export interface SequenceInstance {
  id: string
  sequenceId: string
  /** Target organisation ID from the union map / ICP. */
  targetOrgId: string
  /** CRM deal ID. */
  dealEngineId: string | null
  contactName: string
  contactEmail: string
  currentStepNumber: number
  status: SequenceInstanceStatus
  /** ISO datetime of next scheduled step. */
  nextStepAt: string | null
  /** Record of completed steps. */
  completedSteps: CompletedStep[]
  startedAt: string
  updatedAt: string
}

export interface CompletedStep {
  stepNumber: number
  completedAt: string
  channel: SequenceChannel
  outcome: 'sent' | 'replied' | 'bounced' | 'opted_out' | 'skipped'
  notes: string
}
