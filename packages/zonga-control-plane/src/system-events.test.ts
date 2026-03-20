/**
 * @nzila/zonga-control-plane — System Events Tests
 *
 * Tests event emission, handler registration, audit queries,
 * and the immutable event log.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  onSystemEvent,
  emitSystemEvent,
  buildSystemEvent,
  queryAuditEvents,
  getEventCountByType,
  clearEventLog,
  getEventLog,
  getEventLogSize,
} from './system-events'
import { SystemEventType, AuditSeverity } from './types'

type BuildSystemEventParams = Parameters<typeof buildSystemEvent>[0]

function makeEvent(overrides?: Partial<BuildSystemEventParams>) {
  return buildSystemEvent({
    type: SystemEventType.REVENUE_RECORDED,
    orgId: 'org-1',
    actorId: 'actor-1',
    entityId: 'entity-1',
    entityType: 'revenue',
    correlationId: 'corr-1',
    payload: { amount: 100 },
    severity: AuditSeverity.INFO,
    ...overrides,
  })
}

describe('@nzila/zonga-control-plane — system events', () => {
  beforeEach(() => {
    clearEventLog()
  })

  // ── Event Emission ────────────────────────────────────────────────────

  describe('emitSystemEvent', () => {
    it('stores events in the log', () => {
      const event = makeEvent()
      emitSystemEvent(event)
      expect(getEventLogSize()).toBe(1)
      expect(getEventLog()[0]!.type).toBe(SystemEventType.REVENUE_RECORDED)
    })

    it('delivers events to registered handlers', () => {
      const handler = vi.fn()
      onSystemEvent(handler)
      const event = makeEvent()
      emitSystemEvent(event)
      expect(handler).toHaveBeenCalledWith(event)
    })

    it('does not crash when a handler throws', () => {
      onSystemEvent(() => { throw new Error('Handler crash') })
      const event = makeEvent()
      expect(() => emitSystemEvent(event)).not.toThrow()
      expect(getEventLogSize()).toBe(1)
    })
  })

  // ── Handler Registration ──────────────────────────────────────────────

  describe('onSystemEvent', () => {
    it('returns an unsubscribe function', () => {
      const handler = vi.fn()
      const unsub = onSystemEvent(handler)
      unsub()
      emitSystemEvent(makeEvent())
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ── Build Event ───────────────────────────────────────────────────────

  describe('buildSystemEvent', () => {
    it('generates an id and timestamp', () => {
      const event = makeEvent()
      expect(event.id).toBeTruthy()
      expect(event.timestamp).toBeInstanceOf(Date)
    })

    it('carries all provided fields', () => {
      const event = makeEvent({
        type: SystemEventType.PAYOUT_COMPLETED,
        orgId: 'org-42',
        actorId: 'admin-7',
      })
      expect(event.orgId).toBe('org-42')
      expect(event.actorId).toBe('admin-7')
    })
  })

  // ── Audit Queries ─────────────────────────────────────────────────────

  describe('queryAuditEvents', () => {
    beforeEach(() => {
      emitSystemEvent(makeEvent({ entityId: 'e-1', entityType: 'revenue' }))
      emitSystemEvent(makeEvent({ entityId: 'e-2', entityType: 'payout' }))
      emitSystemEvent(makeEvent({ entityId: 'e-3', entityType: 'revenue' }))
    })

    it('returns all events when filter is empty', () => {
      const result = queryAuditEvents({})
      expect(result.totalCount).toBe(3)
    })

    it('filters by entityType', () => {
      const result = queryAuditEvents({ entityType: 'payout' })
      expect(result.totalCount).toBe(1)
      expect(result.events[0]!.entityType).toBe('payout')
    })

    it('supports pagination with limit and offset', () => {
      const page1 = queryAuditEvents({ limit: 2, offset: 0 })
      expect(page1.events).toHaveLength(2)
      expect(page1.hasMore).toBe(true)

      const page2 = queryAuditEvents({ limit: 2, offset: 2 })
      expect(page2.events).toHaveLength(1)
      expect(page2.hasMore).toBe(false)
    })
  })

  // ── Event Count ───────────────────────────────────────────────────────

  describe('getEventCountByType', () => {
    it('counts events by type', () => {
      emitSystemEvent(makeEvent())
      emitSystemEvent(makeEvent())
      emitSystemEvent(buildSystemEvent({
        type: SystemEventType.PAYOUT_COMPLETED,
        orgId: 'o', actorId: 'a', entityId: 'e', entityType: 't',
        correlationId: 'c', payload: {}, severity: AuditSeverity.INFO,
      }))

      const counts = getEventCountByType()
      expect(counts.get(SystemEventType.REVENUE_RECORDED)).toBe(2)
      expect(counts.get(SystemEventType.PAYOUT_COMPLETED)).toBe(1)
    })
  })

  // ── Clear ─────────────────────────────────────────────────────────────

  describe('clearEventLog', () => {
    it('empties the event log', () => {
      emitSystemEvent(makeEvent())
      expect(getEventLogSize()).toBe(1)
      clearEventLog()
      expect(getEventLogSize()).toBe(0)
    })
  })
})
