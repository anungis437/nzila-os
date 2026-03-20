/**
 * Zonga — Content Moderation Workflow
 *
 * Lifecycle: submitted → auto-review → human review → approved/rejected.
 * Applies to tracks, albums, event listings, and profile content.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type ModerationStatus =
  | 'submitted'
  | 'auto_reviewing'
  | 'auto_approved'
  | 'auto_flagged'
  | 'auto_rejected'
  | 'human_review_queued'
  | 'human_reviewing'
  | 'approved'
  | 'rejected'
  | 'appealed'
  | 'appeal_reviewing'
  | 'appeal_approved'
  | 'appeal_rejected'

const TRANSITIONS: readonly Transition<ModerationStatus>[] = [
  // Auto review
  { from: 'submitted', to: 'auto_reviewing', label: 'Begin auto-review', auditEvent: 'moderation_auto_started' },
  { from: 'auto_reviewing', to: 'auto_approved', label: 'Auto-approved', auditEvent: 'moderation_auto_approved' },
  { from: 'auto_reviewing', to: 'auto_flagged', label: 'Auto-flagged', auditEvent: 'moderation_auto_flagged' },
  { from: 'auto_reviewing', to: 'auto_rejected', label: 'Auto-rejected', auditEvent: 'moderation_auto_rejected' },

  // Auto → Final or Human
  { from: 'auto_approved', to: 'approved', label: 'Confirm approval', auditEvent: 'moderation_approved' },
  { from: 'auto_flagged', to: 'human_review_queued', label: 'Queue for human review', auditEvent: 'moderation_human_queued' },
  { from: 'auto_rejected', to: 'human_review_queued', label: 'Queue for human review', auditEvent: 'moderation_human_queued' },

  // Human review
  { from: 'human_review_queued', to: 'human_reviewing', label: 'Begin human review', auditEvent: 'moderation_human_started' },
  { from: 'human_reviewing', to: 'approved', label: 'Approve', auditEvent: 'moderation_approved' },
  { from: 'human_reviewing', to: 'rejected', label: 'Reject', auditEvent: 'moderation_rejected' },

  // Appeal
  { from: 'rejected', to: 'appealed', label: 'Appeal decision', auditEvent: 'moderation_appealed' },
  { from: 'auto_rejected', to: 'appealed', label: 'Appeal auto-rejection', auditEvent: 'moderation_appealed' },
  { from: 'appealed', to: 'appeal_reviewing', label: 'Begin appeal review', auditEvent: 'moderation_appeal_started' },
  { from: 'appeal_reviewing', to: 'appeal_approved', label: 'Appeal approved', auditEvent: 'moderation_appeal_approved' },
  { from: 'appeal_reviewing', to: 'appeal_rejected', label: 'Appeal rejected', auditEvent: 'moderation_appeal_rejected' },

  // Appeal resolution
  { from: 'appeal_approved', to: 'approved', label: 'Publish after appeal', auditEvent: 'moderation_approved' },
] as const

export const moderation = {
  name: 'content_moderation' as const,
  transitions: TRANSITIONS,
  validate: (from: ModerationStatus, to: ModerationStatus) =>
    validateTransition('content_moderation', TRANSITIONS, from, to),
  attempt: (from: ModerationStatus, to: ModerationStatus) =>
    attemptTransition('content_moderation', TRANSITIONS, from, to),
  getAvailable: (from: ModerationStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
