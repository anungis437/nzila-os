/**
 * Drives the real canonical chain and the real legacy insert. `auditLog()` is
 * not the writer under test: a resolved call from that helper is not a durable
 * legacy audit.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const auditLog = vi.fn()
vi.mock('@/lib/audit-logger', () => ({
  auditLog: (...args: unknown[]) => auditLog(...args),
}))

import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistDurableSegmentAudit } from '../durable-segment-audit'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const SEGMENT_ID = '33333333-3333-4333-8333-333333333333'
const STEWARD_A = 'user-steward-a'
const STEWARD_B = 'user-steward-b'

type Inserted = {
  action?: string
  outcome?: string
  resourceId?: string | null
  metadata?: {
    segments?: Array<{ segmentId: string; ownerUserId: string; isPublic: boolean }>
    outcome?: string
  }
}

function legacyTx(reject?: Error) {
  const inserted: Inserted[] = []
  const execute = vi.fn(async () => {
    throw new Error('canonical execute must not run in legacy mode')
  })
  const tx = {
    execute,
    insert: () => ({
      values: async (row: Inserted) => {
        inserted.push(row)
        if (reject) throw reject
      },
    }),
  }
  return { tx: tx as unknown as RLSTx, inserted, execute }
}

function canonicalTx(failOnCall: number | null) {
  let calls = 0
  const execute = vi.fn(async () => {
    calls += 1
    if (failOnCall !== null && calls === failOnCall) throw new Error('canonical_audit_down')
    return []
  })
  const insert = vi.fn(() => {
    throw new Error('legacy insert must not run in canonical mode')
  })
  return { tx: { execute, insert } as unknown as RLSTx, execute, insert }
}

const crossOwner = {
  actorUserId: STEWARD_A,
  organizationId: ORG_A,
  operation: 'update' as const,
  outcome: 'success' as const,
  segments: [
    {
      segmentId: SEGMENT_ID,
      ownerUserId: STEWARD_B,
      isPublic: true,
      filters: { status: ['active'] },
      members: [{ id: 'member-row' }],
    },
  ],
}

afterEach(() => {
  vi.unstubAllEnvs()
  auditLog.mockReset()
})

describe('persistDurableSegmentAudit', () => {
  it('propagates a legacy insert failure and does not call auditLog', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted, execute } = legacyTx(new Error('legacy_audit_down'))
    await expect(persistDurableSegmentAudit(tx, crossOwner)).rejects.toThrow('legacy_audit_down')
    expect(inserted).toHaveLength(1)
    expect(inserted[0].action).toBe('member_segment_update')
    expect(inserted[0].outcome).toBe('success')
    expect(execute).not.toHaveBeenCalled()
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('persists a legacy administrator mutation without filter or member payloads', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted } = legacyTx()
    await persistDurableSegmentAudit(tx, crossOwner)
    expect(inserted).toHaveLength(1)
    expect(inserted[0].resourceId).toBe(SEGMENT_ID)
    expect(inserted[0].metadata?.segments).toEqual([
      { segmentId: SEGMENT_ID, ownerUserId: STEWARD_B, isPublic: true },
    ])
    expect(JSON.stringify(inserted[0])).not.toContain('active')
    expect(JSON.stringify(inserted[0])).not.toContain('member-row')
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('skips a legacy write for the owner of the segment', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted, execute } = legacyTx()
    await persistDurableSegmentAudit(tx, {
      ...crossOwner,
      segments: [{ segmentId: SEGMENT_ID, ownerUserId: STEWARD_A, isPublic: false }],
    })
    expect(inserted).toEqual([])
    expect(execute).not.toHaveBeenCalled()
  })

  it('propagates a canonical chain insert failure and does not call auditLog', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    const { tx, execute, insert } = canonicalTx(3)
    await expect(persistDurableSegmentAudit(tx, crossOwner)).rejects.toThrow('canonical_audit_down')
    expect(execute).toHaveBeenCalledTimes(3)
    expect(insert).not.toHaveBeenCalled()
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('appends a canonical success record for an administrator mutation', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    const { tx, execute, insert } = canonicalTx(null)
    await persistDurableSegmentAudit(tx, crossOwner)
    expect(execute).toHaveBeenCalledTimes(3)
    expect(insert).not.toHaveBeenCalled()
    const insertCall = execute.mock.calls[2]?.[0] as { queryChunks?: unknown[] }
    expect(JSON.stringify(insertCall)).toContain('public.audit_logs')
    expect(JSON.stringify(insertCall)).not.toContain('member-row')
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('leaves a non-uuid segment id in metadata instead of the legacy uuid column', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted } = legacyTx()
    await persistDurableSegmentAudit(tx, {
      ...crossOwner,
      operation: 'delete',
      segments: [{ segmentId: 's-private', ownerUserId: STEWARD_B, isPublic: false }],
    })
    expect(inserted[0].action).toBe('member_segment_delete')
    expect(inserted[0].resourceId).toBeNull()
    expect(inserted[0].metadata?.segments?.[0].segmentId).toBe('s-private')
  })
})
