/**
 * Zonga — Track Upload Processing Workflow
 *
 * Lifecycle: upload → validation → transcoding → fingerprinting → ready.
 * Ensures no track reaches the catalog without passing all quality gates.
 */
import type { Transition } from './types'
import { validateTransition, attemptTransition, getAvailableTransitions } from './types'

export type TrackUploadStatus =
  | 'uploaded'
  | 'validating'
  | 'validation_failed'
  | 'transcoding'
  | 'transcode_failed'
  | 'fingerprinting'
  | 'fingerprint_failed'
  | 'quality_check'
  | 'quality_rejected'
  | 'ready'
  | 'archived'

const TRANSITIONS: readonly Transition<TrackUploadStatus>[] = [
  { from: 'uploaded', to: 'validating', label: 'Start validation', auditEvent: 'track.validation_started' },
  { from: 'validating', to: 'transcoding', label: 'Validation passed', auditEvent: 'track.validation_passed' },
  { from: 'validating', to: 'validation_failed', label: 'Validation failed', auditEvent: 'track.validation_failed' },
  { from: 'transcoding', to: 'fingerprinting', label: 'Transcoding complete', auditEvent: 'track.transcoding_complete' },
  { from: 'transcoding', to: 'transcode_failed', label: 'Transcoding failed', auditEvent: 'track.transcoding_failed' },
  { from: 'fingerprinting', to: 'quality_check', label: 'Fingerprint generated', auditEvent: 'track.fingerprint_generated' },
  { from: 'fingerprinting', to: 'fingerprint_failed', label: 'Fingerprint failed', auditEvent: 'track.fingerprint_failed' },
  { from: 'quality_check', to: 'ready', label: 'Quality approved', auditEvent: 'track.quality_approved' },
  { from: 'quality_check', to: 'quality_rejected', label: 'Quality rejected', auditEvent: 'track.quality_rejected' },
  { from: 'ready', to: 'archived', label: 'Archive track', auditEvent: 'track.archived' },
  // Retries
  { from: 'validation_failed', to: 'validating', label: 'Retry validation', auditEvent: 'track.validation_retried' },
  { from: 'transcode_failed', to: 'transcoding', label: 'Retry transcoding', auditEvent: 'track.transcoding_retried' },
  { from: 'fingerprint_failed', to: 'fingerprinting', label: 'Retry fingerprinting', auditEvent: 'track.fingerprinting_retried' },
  { from: 'quality_rejected', to: 'uploaded', label: 'Re-upload', auditEvent: 'track.re_uploaded' },
] as const

export const trackUploadProcessing = {
  name: 'track_upload_processing' as const,
  transitions: TRANSITIONS,
  validate: (from: TrackUploadStatus, to: TrackUploadStatus) =>
    validateTransition('track_upload_processing', TRANSITIONS, from, to),
  attempt: (from: TrackUploadStatus, to: TrackUploadStatus) =>
    attemptTransition('track_upload_processing', TRANSITIONS, from, to),
  getAvailable: (from: TrackUploadStatus) =>
    getAvailableTransitions(TRANSITIONS, from),
}
