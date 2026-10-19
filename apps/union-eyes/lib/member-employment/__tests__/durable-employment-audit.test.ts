import { afterEach, describe, expect, it, vi } from 'vitest'

const auditLog = vi.fn()
vi.mock('@/lib/audit-logger', () => ({
  auditLog: (...args: unknown[]) => auditLog(...args),
}))

import type { RLSTx } from '@/lib/db/with-rls-context'
import { assertEmploymentAuditMetadata, persistDurableEmploymentAudit } from '../durable-employment-audit'

const ORG = '11111111-1111-4111-8111-111111111111'
const TARGET = '33333333-3333-4333-8333-333333333333'
const ACTOR = 'user-admin-a'

type Inserted = {
  action?: string
  outcome?: string
  resourceId?: string | null
  metadata?: { changeCategory?: string; targetId?: string | null }
  hourlyRate?: string
  reason?: string
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

const mutation = {
  actorUserId: ACTOR,
  organizationId: ORG,
  operation: 'update' as const,
  outcome: 'success' as const,
  targetId: TARGET,
}

afterEach(() => {
  vi.unstubAllEnvs()
  auditLog.mockReset()
})

describe('persistDurableEmploymentAudit', () => {
  it('propagates a legacy insert failure and does not call auditLog', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted, execute } = legacyTx(new Error('legacy_audit_down'))
    await expect(persistDurableEmploymentAudit(tx, mutation)).rejects.toThrow('legacy_audit_down')
    expect(inserted).toHaveLength(1)
    expect(inserted[0].action).toBe('member_employment_update')
    expect(execute).not.toHaveBeenCalled()
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('persists legacy provenance without wage or leave narrative', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted } = legacyTx()
    await persistDurableEmploymentAudit(tx, {
      ...mutation,
      operation: 'leave_approve',
    })
    expect(inserted[0].resourceId).toBe(TARGET)
    expect(inserted[0].metadata).toEqual({
      operation: 'leave_approve',
      outcome: 'success',
      changeCategory: 'leave_approval',
      targetId: TARGET,
    })
    expect(JSON.stringify(inserted[0])).not.toContain('hourly')
    expect(JSON.stringify(inserted[0])).not.toContain('medical')
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('rejects wage and leave narrative keys', () => {
    expect(() => assertEmploymentAuditMetadata({ hourlyRate: '99.50' })).toThrow('Employment audit metadata rejected')
    expect(() => assertEmploymentAuditMetadata({ reason: 'medical leave' })).toThrow('Employment audit metadata rejected')
  })

  it('propagates a canonical chain failure', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    const { tx, execute, insert } = canonicalTx(3)
    await expect(persistDurableEmploymentAudit(tx, mutation)).rejects.toThrow('canonical_audit_down')
    expect(execute).toHaveBeenCalledTimes(3)
    expect(insert).not.toHaveBeenCalled()
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('appends a canonical success record', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    const { tx, execute, insert } = canonicalTx(null)
    await persistDurableEmploymentAudit(tx, mutation)
    expect(execute).toHaveBeenCalledTimes(3)
    expect(insert).not.toHaveBeenCalled()
    const insertCall = execute.mock.calls[2]?.[0] as { queryChunks?: unknown[] }
    expect(JSON.stringify(insertCall)).toContain('public.audit_logs')
    expect(JSON.stringify(insertCall)).not.toContain('99.50')
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('keeps a non-uuid target in metadata', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted } = legacyTx()
    await persistDurableEmploymentAudit(tx, { ...mutation, targetId: 'emp-1' })
    expect(inserted[0].resourceId).toBeNull()
    expect(inserted[0].metadata?.targetId).toBe('emp-1')
  })
})
