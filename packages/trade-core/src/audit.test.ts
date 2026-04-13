import { describe, it, expect } from 'vitest'
import { TradeDealStage, TradeOrgRole } from './enums'
import {
  buildActionAuditEntry,
  buildTransitionAuditEntry,
  hashAuditEntry,
  validateAuditEntry,
} from './audit'

describe('trade-core audit helpers', () => {
  const baseOpts = {
    id: 'audit-1',
    orgId: 'org-1',
    actorId: 'actor-1',
    role: TradeOrgRole.ADMIN,
    entityType: 'trade_deal',
    targetEntityId: 'deal-1',
  } as const

  it('builds transition audit entries from transition result', () => {
    const result = buildTransitionAuditEntry(
      {
        ok: true,
        from: TradeDealStage.LEAD,
        to: TradeDealStage.QUALIFIED,
        label: 'Qualify lead',
        eventsToEmit: [{ type: 'trade.deal.qualified' }, { type: 'trade.audit.created' }],
        actionsToSchedule: [{ type: 'create_quote' }],
        evidenceRequired: false,
      },
      baseOpts,
    )

    expect(result.action).toBe('transitioned')
    expect(result.fromState).toBe(TradeDealStage.LEAD)
    expect(result.toState).toBe(TradeDealStage.QUALIFIED)
    expect(result.eventsEmitted).toEqual(['trade.deal.qualified', 'trade.audit.created'])
    expect(result.actionsScheduled).toEqual(['create_quote'])
  })

  it('builds action audit entries with metadata fallback and explicit metadata', () => {
    const noMetadata = buildActionAuditEntry({
      ...baseOpts,
      action: 'manual_review',
      label: 'Manual review',
    })
    expect(noMetadata.metadata).toEqual({})
    expect(noMetadata.fromState).toBeNull()
    expect(noMetadata.toState).toBeNull()

    const withMetadata = buildActionAuditEntry({
      ...baseOpts,
      action: 'manual_review',
      label: 'Manual review',
      metadata: { reason: 'threshold' },
    })
    expect(withMetadata.metadata).toEqual({ reason: 'threshold' })
  })

  it('hashes deterministically and validates required fields', () => {
    const entry = buildActionAuditEntry({
      ...baseOpts,
      action: 'approve',
      label: 'Approve trade',
    })

    expect(hashAuditEntry(entry)).toBe(hashAuditEntry(entry))

    const invalid = {
      ...entry,
      orgId: '',
    }
    expect(validateAuditEntry(entry)).toBe(true)
    expect(validateAuditEntry(invalid)).toBe(false)
  })
})
