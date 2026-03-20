import { describe, it, expect, beforeEach } from 'vitest'
import type { ControlPlaneContext, AdminActionRequest } from './types'
import { AuditSeverity, SystemEventType } from './types'
import { clearEventLog, getEventLog } from './system-events'
import {
  registerPolicy,
  listPolicies,
  validateGovernancePolicy,
  executeAdminAction,
  payoutPolicy,
  releasePolicy,
  eventPolicy,
  type GovernancePolicy,
} from './governance-enforcer'

function makeContext(overrides?: Partial<ControlPlaneContext>): ControlPlaneContext {
  return {
    orgId: 'org-test',
    actorId: 'actor-test',
    actorRole: 'admin',
    correlationId: 'corr-test',
    requestId: 'req-test',
    timestamp: new Date(),
    ...overrides,
  }
}

describe('@nzila/zonga-control-plane — Governance Enforcer', () => {
  beforeEach(() => {
    clearEventLog()
  })

  // ── Policy Registry ───────────────────────────────────────────────

  describe('listPolicies', () => {
    it('includes built-in policies (payout, release, event)', () => {
      const policies = listPolicies()
      const ids = policies.map((p) => p.id)
      expect(ids).toContain('payout_policy')
      expect(ids).toContain('release_publish_policy')
      expect(ids).toContain('event_publish_policy')
    })
  })

  // ── Payout Policy ─────────────────────────────────────────────────

  describe('payoutPolicy', () => {
    it('passes for valid payout', () => {
      const ctx = makeContext()
      const entity = { id: 'pay-1', amount: 50, hasActiveDispute: false }
      const violations = payoutPolicy.evaluate(ctx, 'payout', entity)
      expect(violations).toHaveLength(0)
    })

    it('blocks payout below minimum threshold', () => {
      const ctx = makeContext()
      const entity = { id: 'pay-2', amount: 0.5, hasActiveDispute: false }
      const violations = payoutPolicy.evaluate(ctx, 'payout', entity)
      expect(violations).toHaveLength(1)
      expect(violations[0]!.rule).toBe('minimum_payout_threshold')
    })

    it('blocks payout with active dispute', () => {
      const ctx = makeContext()
      const entity = { id: 'pay-3', amount: 100, hasActiveDispute: true }
      const violations = payoutPolicy.evaluate(ctx, 'payout', entity)
      expect(violations).toHaveLength(1)
      expect(violations[0]!.rule).toBe('dispute_payout_freeze')
    })

    it('accumulates multiple violations', () => {
      const ctx = makeContext()
      const entity = { id: 'pay-4', amount: 0.01, hasActiveDispute: true }
      const violations = payoutPolicy.evaluate(ctx, 'payout', entity)
      expect(violations).toHaveLength(2)
    })

    it('ignores non-payout entities', () => {
      const ctx = makeContext()
      const entity = { id: 'x', amount: 0.01 }
      const violations = payoutPolicy.evaluate(ctx, 'release', entity)
      expect(violations).toHaveLength(0)
    })
  })

  // ── Release Policy ────────────────────────────────────────────────

  describe('releasePolicy', () => {
    it('passes for release with valid rights and 100% splits', () => {
      const ctx = makeContext()
      const entity = { id: 'rel-1', hasValidRights: true, splitTotal: 100 }
      const violations = releasePolicy.evaluate(ctx, 'release', entity)
      expect(violations).toHaveLength(0)
    })

    it('blocks release without valid rights', () => {
      const ctx = makeContext()
      const entity = { id: 'rel-2', hasValidRights: false, splitTotal: 100 }
      const violations = releasePolicy.evaluate(ctx, 'release', entity)
      expect(violations.some((v) => v.rule === 'valid_rights_required')).toBe(true)
    })

    it('blocks release with splits not summing to 100', () => {
      const ctx = makeContext()
      const entity = { id: 'rel-3', hasValidRights: true, splitTotal: 85 }
      const violations = releasePolicy.evaluate(ctx, 'release', entity)
      expect(violations.some((v) => v.rule === 'splits_sum_100')).toBe(true)
    })
  })

  // ── Event Policy ──────────────────────────────────────────────────

  describe('eventPolicy', () => {
    it('passes for valid event', () => {
      const ctx = makeContext()
      const entity = { id: 'evt-1', capacity: 500, hasTicketTypes: true }
      const violations = eventPolicy.evaluate(ctx, 'event', entity)
      expect(violations).toHaveLength(0)
    })

    it('blocks event with zero capacity', () => {
      const ctx = makeContext()
      const entity = { id: 'evt-2', capacity: 0, hasTicketTypes: true }
      const violations = eventPolicy.evaluate(ctx, 'event', entity)
      expect(violations.some((v) => v.rule === 'valid_capacity')).toBe(true)
    })

    it('blocks event without ticket types', () => {
      const ctx = makeContext()
      const entity = { id: 'evt-3', capacity: 100, hasTicketTypes: false }
      const violations = eventPolicy.evaluate(ctx, 'event', entity)
      expect(violations.some((v) => v.rule === 'ticket_types_required')).toBe(true)
    })
  })

  // ── validateGovernancePolicy ──────────────────────────────────────

  describe('validateGovernancePolicy', () => {
    it('returns passed when no violations found', () => {
      const ctx = makeContext()
      const entity = { id: 'pay-ok', amount: 10, hasActiveDispute: false }
      const result = validateGovernancePolicy(ctx, 'payout', entity)
      expect(result.passed).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('returns violations and emits event when policy violated', () => {
      const ctx = makeContext()
      const entity = { id: 'pay-bad', amount: 0.01, hasActiveDispute: true }
      const result = validateGovernancePolicy(ctx, 'payout', entity)
      expect(result.passed).toBe(false)
      expect(result.violations.length).toBeGreaterThan(0)

      const events = getEventLog()
      const violation = events.find((e) => e.type === SystemEventType.POLICY_VIOLATION_DETECTED)
      expect(violation).toBeDefined()
    })
  })

  // ── Admin Action Guard ────────────────────────────────────────────

  describe('executeAdminAction', () => {
    it('allows admin with valid reason', () => {
      const request: AdminActionRequest = {
        action: 'freeze_payout',
        targetEntityId: 'pay-1',
        targetEntityType: 'payout',
        reason: 'Suspicious activity detected on this creator account',
        context: makeContext({ actorRole: 'admin' }),
      }
      const result = executeAdminAction(request)
      expect(result.allowed).toBe(true)
      expect(result.executed).toBe(true)
      expect(result.auditEventId).toBeTruthy()
    })

    it('allows finance role', () => {
      const request: AdminActionRequest = {
        action: 'approve_payout',
        targetEntityId: 'pay-1',
        targetEntityType: 'payout',
        reason: 'Payout approved after review period',
        context: makeContext({ actorRole: 'finance' }),
      }
      const result = executeAdminAction(request)
      expect(result.allowed).toBe(true)
    })

    it('allows compliance role', () => {
      const request: AdminActionRequest = {
        action: 'flag_content',
        targetEntityId: 'rel-1',
        targetEntityType: 'release',
        reason: 'Content flagged for compliance review process',
        context: makeContext({ actorRole: 'compliance' }),
      }
      const result = executeAdminAction(request)
      expect(result.allowed).toBe(true)
    })

    it('denies when reason is too short', () => {
      const request: AdminActionRequest = {
        action: 'delete_release',
        targetEntityId: 'rel-1',
        targetEntityType: 'release',
        reason: 'short',
        context: makeContext({ actorRole: 'admin' }),
      }
      const result = executeAdminAction(request)
      expect(result.allowed).toBe(false)
      expect(result.denialReason).toContain('at least 10 characters')
    })

    it('denies when reason is empty', () => {
      const request: AdminActionRequest = {
        action: 'delete_release',
        targetEntityId: 'rel-1',
        targetEntityType: 'release',
        reason: '',
        context: makeContext({ actorRole: 'admin' }),
      }
      const result = executeAdminAction(request)
      expect(result.allowed).toBe(false)
    })

    it('denies non-admin roles and emits denial event', () => {
      const request: AdminActionRequest = {
        action: 'freeze_payout',
        targetEntityId: 'pay-1',
        targetEntityType: 'payout',
        reason: 'Suspicious activity detected on this creator account',
        context: makeContext({ actorRole: 'creator' }),
      }
      const result = executeAdminAction(request)
      expect(result.allowed).toBe(false)
      expect(result.denialReason).toContain('creator')
      expect(result.auditEventId).toBeTruthy()

      const events = getEventLog()
      expect(events.some((e) => e.type === SystemEventType.ADMIN_ACTION_EXECUTED)).toBe(true)
    })

    it('emits audit event for allowed admin action', () => {
      const request: AdminActionRequest = {
        action: 'update_splits',
        targetEntityId: 'rel-1',
        targetEntityType: 'release',
        reason: 'Split adjustment per signed contract amendment',
        context: makeContext({ actorRole: 'superadmin' }),
      }
      executeAdminAction(request)

      const events = getEventLog()
      const adminEvents = events.filter((e) => e.type === SystemEventType.ADMIN_ACTION_EXECUTED)
      expect(adminEvents).toHaveLength(1)
      expect(adminEvents[0]!.payload['denied']).toBe(false)
    })
  })
})
