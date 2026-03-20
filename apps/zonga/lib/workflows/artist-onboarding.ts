/**
 * Zonga — Artist Onboarding Workflow
 *
 * Lifecycle: application → verification → approval → active artist.
 * Emits audit events at each transition.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type ArtistOnboardingStatus =
  | 'applied'
  | 'profile_submitted'
  | 'verification_pending'
  | 'identity_verified'
  | 'rights_configured'
  | 'under_review'
  | 'approved'
  | 'active'
  | 'rejected'
  | 'suspended'

const TRANSITIONS: readonly Transition<ArtistOnboardingStatus>[] = [
  // Application
  { from: 'applied', to: 'profile_submitted', label: 'Submit profile', auditEvent: 'artist_profile_submitted' },
  { from: 'applied', to: 'rejected', label: 'Reject application', auditEvent: 'artist_application_rejected' },

  // Verification
  { from: 'profile_submitted', to: 'verification_pending', label: 'Request verification', auditEvent: 'artist_verification_requested' },
  { from: 'verification_pending', to: 'identity_verified', label: 'Identity verified', auditEvent: 'artist_identity_verified' },
  { from: 'verification_pending', to: 'rejected', label: 'Verification failed', auditEvent: 'artist_verification_failed' },

  // Rights setup
  { from: 'identity_verified', to: 'rights_configured', label: 'Configure rights & splits', auditEvent: 'artist_rights_configured' },

  // Review
  { from: 'rights_configured', to: 'under_review', label: 'Submit for review', auditEvent: 'artist_submitted_for_review' },
  { from: 'under_review', to: 'approved', label: 'Approve artist', auditEvent: 'artist_approved' },
  { from: 'under_review', to: 'rejected', label: 'Reject artist', auditEvent: 'artist_rejected' },

  // Activation
  { from: 'approved', to: 'active', label: 'Activate artist', auditEvent: 'artist_activated' },

  // Suspension
  { from: 'active', to: 'suspended', label: 'Suspend artist', auditEvent: 'artist_suspended' },
  { from: 'suspended', to: 'active', label: 'Reinstate artist', auditEvent: 'artist_reinstated' },
] as const

export const artistOnboarding = {
  name: 'artist_onboarding' as const,
  transitions: TRANSITIONS,
  validate: (from: ArtistOnboardingStatus, to: ArtistOnboardingStatus) =>
    validateTransition('artist_onboarding', TRANSITIONS, from, to),
  attempt: (from: ArtistOnboardingStatus, to: ArtistOnboardingStatus) =>
    attemptTransition('artist_onboarding', TRANSITIONS, from, to),
  getAvailable: (from: ArtistOnboardingStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
