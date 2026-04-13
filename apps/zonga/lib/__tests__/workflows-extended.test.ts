/**
 * Zonga — Extended Workflow State Machine Tests
 *
 * Covers the 5 workflows not tested in workflows.test.ts:
 *   - ticketScan
 *   - refundFlow
 *   - rightsUpdate
 *   - paymentFailureRecovery
 *   - trackUploadProcessing
 *
 * Pattern mirrors workflows.test.ts: valid/invalid transitions,
 * available transitions, terminal states, and audit events.
 */
import { describe, it, expect } from 'vitest'
import {
  ticketScan,
  refundFlow,
  rightsUpdate,
  paymentFailureRecovery,
  trackUploadProcessing,
  InvalidTransitionError,
} from '../workflows'

// ── ticketScan ────────────────────────────────────────────────────────────────

describe('ticketScan workflow', () => {
  it('validates pending_scan → scanning', () => {
    const r = ticketScan.validate('pending_scan', 'scanning')
    expect(r.ok).toBe(true)
    expect(r.auditEvent).toBe('ticket.scan_initiated')
  })

  it('validates scanning → validated', () => {
    const r = ticketScan.validate('scanning', 'validated')
    expect(r.ok).toBe(true)
    expect(r.auditEvent).toBe('ticket.scan_validated')
  })

  it('validates scanning → duplicate_detected', () => {
    const r = ticketScan.validate('scanning', 'duplicate_detected')
    expect(r.ok).toBe(true)
  })

  it('validates scanning → fraud_flagged', () => {
    const r = ticketScan.validate('scanning', 'fraud_flagged')
    expect(r.ok).toBe(true)
  })

  it('validates validated → checked_in', () => {
    const r = ticketScan.validate('validated', 'checked_in')
    expect(r.ok).toBe(true)
    expect(r.auditEvent).toBe('ticket.checked_in')
  })

  it('validates offline path: scanning → offline_queued → offline_synced → validated', () => {
    expect(ticketScan.validate('scanning', 'offline_queued').ok).toBe(true)
    expect(ticketScan.validate('offline_queued', 'offline_synced').ok).toBe(true)
    expect(ticketScan.validate('offline_synced', 'validated').ok).toBe(true)
  })

  it('rejects pending_scan → checked_in (skip steps)', () => {
    expect(ticketScan.validate('pending_scan', 'checked_in').ok).toBe(false)
  })

  it('attempt throws on invalid transition', () => {
    expect(() => ticketScan.attempt('pending_scan', 'checked_in')).toThrow(InvalidTransitionError)
  })

  it('attempt returns ok result for valid transition', () => {
    const r = ticketScan.attempt('pending_scan', 'scanning')
    expect(r.ok).toBe(true)
  })

  it('getAvailable from scanning returns multiple terminal options', () => {
    const targets = ticketScan.getAvailable('scanning').map((t) => t.to)
    expect(targets).toContain('validated')
    expect(targets).toContain('duplicate_detected')
    expect(targets).toContain('invalid_ticket')
    expect(targets).toContain('fraud_flagged')
    expect(targets).toContain('offline_queued')
  })

  it('terminal states have no exits: checked_in', () => {
    expect(ticketScan.getAvailable('checked_in')).toHaveLength(0)
  })

  it('terminal states have no exits: fraud_flagged', () => {
    expect(ticketScan.getAvailable('fraud_flagged')).toHaveLength(0)
  })

  it('invalid_ticket is terminal', () => {
    expect(ticketScan.getAvailable('invalid_ticket')).toHaveLength(0)
  })
})

// ── refundFlow ────────────────────────────────────────────────────────────────

describe('refundFlow workflow', () => {
  it('validates refund_requested → validating', () => {
    const r = refundFlow.validate('refund_requested', 'validating')
    expect(r.ok).toBe(true)
    expect(r.auditEvent).toBe('refund.validation_started')
  })

  it('validates happy path: refund_requested → validating → pending_approval → approved → processing → ledger_reversed → provider_refunded → completed', () => {
    const path = [
      ['refund_requested', 'validating'],
      ['validating', 'pending_approval'],
      ['pending_approval', 'approved'],
      ['approved', 'processing'],
      ['processing', 'ledger_reversed'],
      ['ledger_reversed', 'provider_refunded'],
      ['provider_refunded', 'completed'],
    ] as const
    for (const [from, to] of path) {
      expect(refundFlow.validate(from as never, to as never).ok).toBe(true)
    }
  })

  it('validates rejection path: validating → rejected', () => {
    expect(refundFlow.validate('validating', 'rejected').ok).toBe(true)
  })

  it('validates rejection from pending_approval', () => {
    expect(refundFlow.validate('pending_approval', 'rejected').ok).toBe(true)
  })

  it('validates retry: failed → processing', () => {
    expect(refundFlow.validate('failed', 'processing').ok).toBe(true)
  })

  it('rejects refund_requested → completed (skip all steps)', () => {
    expect(refundFlow.validate('refund_requested', 'completed').ok).toBe(false)
  })

  it('attempt throws on invalid transition', () => {
    expect(() => refundFlow.attempt('refund_requested', 'completed')).toThrow(InvalidTransitionError)
  })

  it('getAvailable from validating includes pending_approval and rejected', () => {
    const targets = refundFlow.getAvailable('validating').map((t) => t.to)
    expect(targets).toContain('pending_approval')
    expect(targets).toContain('rejected')
  })

  it('terminal state completed has no exits', () => {
    expect(refundFlow.getAvailable('completed')).toHaveLength(0)
  })

  it('terminal state rejected has no exits', () => {
    expect(refundFlow.getAvailable('rejected')).toHaveLength(0)
  })

  it('failed can be retried (not terminal)', () => {
    const targets = refundFlow.getAvailable('failed').map((t) => t.to)
    expect(targets).toContain('processing')
  })
})

// ── rightsUpdate ──────────────────────────────────────────────────────────────

describe('rightsUpdate workflow', () => {
  it('validates update_requested → validating_splits', () => {
    const r = rightsUpdate.validate('update_requested', 'validating_splits')
    expect(r.ok).toBe(true)
    expect(r.auditEvent).toBe('rights.update_validation')
  })

  it('validates happy path through to completed', () => {
    const path = [
      ['update_requested', 'validating_splits'],
      ['validating_splits', 'pending_approval'],
      ['pending_approval', 'approved'],
      ['approved', 'applying'],
      ['applying', 'ledger_synced'],
      ['ledger_synced', 'completed'],
    ] as const
    for (const [from, to] of path) {
      expect(rightsUpdate.validate(from as never, to as never).ok).toBe(true)
    }
  })

  it('validates conflict detection and re-submission', () => {
    expect(rightsUpdate.validate('validating_splits', 'conflict_detected').ok).toBe(true)
    expect(rightsUpdate.validate('conflict_detected', 'update_requested').ok).toBe(true)
  })

  it('rejects update_requested → completed', () => {
    expect(rightsUpdate.validate('update_requested', 'completed').ok).toBe(false)
  })

  it('attempt throws on invalid transition', () => {
    expect(() => rightsUpdate.attempt('update_requested', 'completed')).toThrow(InvalidTransitionError)
  })

  it('pending_approval can be approved or rejected', () => {
    const targets = rightsUpdate.getAvailable('pending_approval').map((t) => t.to)
    expect(targets).toContain('approved')
    expect(targets).toContain('rejected')
  })

  it('terminal state completed has no exits', () => {
    expect(rightsUpdate.getAvailable('completed')).toHaveLength(0)
  })

  it('terminal state rejected has no exits', () => {
    expect(rightsUpdate.getAvailable('rejected')).toHaveLength(0)
  })
})

// ── paymentFailureRecovery ────────────────────────────────────────────────────

describe('paymentFailureRecovery workflow', () => {
  it('validates failed → retry_scheduled', () => {
    const r = paymentFailureRecovery.validate('failed', 'retry_scheduled')
    expect(r.ok).toBe(true)
    expect(r.auditEvent).toBe('payment.retry_scheduled')
  })

  it('validates retry cycle: retry_scheduled → retrying → retry_succeeded → recovered', () => {
    expect(paymentFailureRecovery.validate('retry_scheduled', 'retrying').ok).toBe(true)
    expect(paymentFailureRecovery.validate('retrying', 'retry_succeeded').ok).toBe(true)
    expect(paymentFailureRecovery.validate('retry_succeeded', 'recovered').ok).toBe(true)
  })

  it('validates retry failure loop: retrying → failed → retry_scheduled', () => {
    expect(paymentFailureRecovery.validate('retrying', 'failed').ok).toBe(true)
    expect(paymentFailureRecovery.validate('failed', 'retry_scheduled').ok).toBe(true)
  })

  it('validates escalation path: failed → max_retries_reached → escalated → manual_review → manually_resolved → recovered', () => {
    const path = [
      ['failed', 'max_retries_reached'],
      ['max_retries_reached', 'escalated'],
      ['escalated', 'manual_review'],
      ['manual_review', 'manually_resolved'],
      ['manually_resolved', 'recovered'],
    ] as const
    for (const [from, to] of path) {
      expect(paymentFailureRecovery.validate(from as never, to as never).ok).toBe(true)
    }
  })

  it('validates immediate escalation: failed → escalated', () => {
    expect(paymentFailureRecovery.validate('failed', 'escalated').ok).toBe(true)
  })

  it('validates written-off path: manual_review → written_off', () => {
    expect(paymentFailureRecovery.validate('manual_review', 'written_off').ok).toBe(true)
  })

  it('rejects retry_scheduled → recovered (skip steps)', () => {
    expect(paymentFailureRecovery.validate('retry_scheduled', 'recovered').ok).toBe(false)
  })

  it('attempt throws on invalid transition', () => {
    expect(() => paymentFailureRecovery.attempt('retry_scheduled', 'recovered')).toThrow(InvalidTransitionError)
  })

  it('failed has multiple next states', () => {
    const targets = paymentFailureRecovery.getAvailable('failed').map((t) => t.to)
    expect(targets).toContain('retry_scheduled')
    expect(targets).toContain('max_retries_reached')
    expect(targets).toContain('escalated')
  })

  it('terminal state recovered has no exits', () => {
    expect(paymentFailureRecovery.getAvailable('recovered')).toHaveLength(0)
  })

  it('terminal state written_off has no exits', () => {
    expect(paymentFailureRecovery.getAvailable('written_off')).toHaveLength(0)
  })
})

// ── trackUploadProcessing ─────────────────────────────────────────────────────

describe('trackUploadProcessing workflow', () => {
  it('validates uploaded → validating', () => {
    const r = trackUploadProcessing.validate('uploaded', 'validating')
    expect(r.ok).toBe(true)
    expect(r.auditEvent).toBe('track.validation_started')
  })

  it('validates happy path: uploaded → validating → transcoding → fingerprinting → quality_check → ready', () => {
    const path = [
      ['uploaded', 'validating'],
      ['validating', 'transcoding'],
      ['transcoding', 'fingerprinting'],
      ['fingerprinting', 'quality_check'],
      ['quality_check', 'ready'],
    ] as const
    for (const [from, to] of path) {
      expect(trackUploadProcessing.validate(from as never, to as never).ok).toBe(true)
    }
  })

  it('validates archiving: ready → archived', () => {
    expect(trackUploadProcessing.validate('ready', 'archived').ok).toBe(true)
  })

  it('validates failure + retry: validation_failed → validating', () => {
    expect(trackUploadProcessing.validate('validating', 'validation_failed').ok).toBe(true)
    expect(trackUploadProcessing.validate('validation_failed', 'validating').ok).toBe(true)
  })

  it('validates transcode failure + retry', () => {
    expect(trackUploadProcessing.validate('transcoding', 'transcode_failed').ok).toBe(true)
    expect(trackUploadProcessing.validate('transcode_failed', 'transcoding').ok).toBe(true)
  })

  it('validates fingerprint failure + retry', () => {
    expect(trackUploadProcessing.validate('fingerprinting', 'fingerprint_failed').ok).toBe(true)
    expect(trackUploadProcessing.validate('fingerprint_failed', 'fingerprinting').ok).toBe(true)
  })

  it('validates quality rejection → re-upload', () => {
    expect(trackUploadProcessing.validate('quality_check', 'quality_rejected').ok).toBe(true)
    expect(trackUploadProcessing.validate('quality_rejected', 'uploaded').ok).toBe(true)
  })

  it('rejects uploaded → ready (skip all processing)', () => {
    expect(trackUploadProcessing.validate('uploaded', 'ready').ok).toBe(false)
  })

  it('attempt throws on invalid transition', () => {
    expect(() => trackUploadProcessing.attempt('uploaded', 'ready')).toThrow(InvalidTransitionError)
  })

  it('getAvailable from validating: transcoding and validation_failed', () => {
    const targets = trackUploadProcessing.getAvailable('validating').map((t) => t.to)
    expect(targets).toContain('transcoding')
    expect(targets).toContain('validation_failed')
  })

  it('terminal state ready → can be archived', () => {
    const targets = trackUploadProcessing.getAvailable('ready').map((t) => t.to)
    expect(targets).toContain('archived')
  })

  it('archived is terminal', () => {
    expect(trackUploadProcessing.getAvailable('archived')).toHaveLength(0)
  })
})
