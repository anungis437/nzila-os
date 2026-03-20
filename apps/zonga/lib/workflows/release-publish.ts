/**
 * Zonga — Release Publish Workflow
 *
 * Lifecycle: draft → review → distribution → published.
 * Integrates moderation, rights verification, and platform distribution.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type ReleasePublishStatus =
  | 'draft'
  | 'metadata_complete'
  | 'rights_verified'
  | 'moderation_pending'
  | 'moderation_approved'
  | 'moderation_rejected'
  | 'scheduling'
  | 'scheduled'
  | 'distributing'
  | 'published'
  | 'taken_down'
  | 'archived'

const TRANSITIONS: readonly Transition<ReleasePublishStatus>[] = [
  // Creation
  { from: 'draft', to: 'metadata_complete', label: 'Complete metadata', auditEvent: 'release_metadata_complete' },

  // Rights
  { from: 'metadata_complete', to: 'rights_verified', label: 'Verify rights', auditEvent: 'release_rights_verified' },

  // Moderation
  { from: 'rights_verified', to: 'moderation_pending', label: 'Submit for moderation', auditEvent: 'release_submitted_for_moderation' },
  { from: 'moderation_pending', to: 'moderation_approved', label: 'Moderation approved', auditEvent: 'release_moderation_approved' },
  { from: 'moderation_pending', to: 'moderation_rejected', label: 'Moderation rejected', auditEvent: 'release_moderation_rejected' },
  { from: 'moderation_rejected', to: 'draft', label: 'Revise and resubmit', auditEvent: 'release_revision_started' },

  // Scheduling
  { from: 'moderation_approved', to: 'scheduling', label: 'Set release date', auditEvent: 'release_scheduling' },
  { from: 'scheduling', to: 'scheduled', label: 'Confirm schedule', auditEvent: 'release_scheduled' },
  { from: 'moderation_approved', to: 'distributing', label: 'Publish immediately', auditEvent: 'release_immediate_publish' },

  // Distribution
  { from: 'scheduled', to: 'distributing', label: 'Begin distribution', auditEvent: 'release_distributing' },
  { from: 'distributing', to: 'published', label: 'Distribution complete', auditEvent: 'release_published' },

  // After publication
  { from: 'published', to: 'taken_down', label: 'Take down', auditEvent: 'release_taken_down' },
  { from: 'taken_down', to: 'published', label: 'Reinstate', auditEvent: 'release_reinstated' },
  { from: 'published', to: 'archived', label: 'Archive', auditEvent: 'release_archived' },
  { from: 'taken_down', to: 'archived', label: 'Archive', auditEvent: 'release_archived' },
] as const

export const releasePublish = {
  name: 'release_publish' as const,
  transitions: TRANSITIONS,
  validate: (from: ReleasePublishStatus, to: ReleasePublishStatus) =>
    validateTransition('release_publish', TRANSITIONS, from, to),
  attempt: (from: ReleasePublishStatus, to: ReleasePublishStatus) =>
    attemptTransition('release_publish', TRANSITIONS, from, to),
  getAvailable: (from: ReleasePublishStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
