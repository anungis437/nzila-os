import { afterEach, describe, expect, it, vi } from 'vitest'

const auditLog = vi.fn()
vi.mock('@/lib/audit-logger', () => ({
  auditLog: (...args: unknown[]) => auditLog(...args),
}))

import type { RLSTx } from '@/lib/db/with-rls-context'
import { assertMemberAuditMetadata, persistDurableMemberAudit } from '../durable-member-audit'

const ORG = '11111111-1111-4111-8111-111111111111'
const TARGET = '33333333-3333-4333-8333-333333333333'
const ACTOR = 'user-admin-a'

type Inserted = {
  action?: string
  outcome?: string
  resourceId?: string | null
  metadata?: { operation?: string; eventType?: string; targetId?: string | null; count?: number }
  email?: string
  name?: string
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
  targetId: TARGET,
}

afterEach(() => {
  vi.unstubAllEnvs()
  auditLog.mockReset()
})

describe('persistDurableMemberAudit', () => {
  it('propagates a legacy insert failure and does not call auditLog', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted, execute } = legacyTx(new Error('legacy_audit_down'))
    await expect(persistDurableMemberAudit(tx, mutation)).rejects.toThrow('legacy_audit_down')
    expect(inserted).toHaveLength(1)
    expect(inserted[0].action).toBe('organization_member_update')
    expect(execute).not.toHaveBeenCalled()
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('persists legacy provenance without personal details', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted } = legacyTx()
    await persistDurableMemberAudit(tx, { ...mutation, operation: 'merge', count: 2 })
    expect(inserted[0].resourceId).toBe(TARGET)
    expect(inserted[0].metadata).toEqual({
      operation: 'merge',
      outcome: 'success',
      eventType: 'data.update',
      targetId: TARGET,
      count: 2,
    })
    expect(JSON.stringify(inserted[0])).not.toContain('ada@')
    expect(JSON.stringify(inserted[0])).not.toContain('membershipNumber')
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('rejects personal and payload keys', () => {
    expect(() => assertMemberAuditMetadata({ email: 'ada@example.com' })).toThrow('Member audit metadata rejected')
    expect(() => assertMemberAuditMetadata({ name: 'Ada' })).toThrow('Member audit metadata rejected')
    expect(() => assertMemberAuditMetadata({ phone: '555' })).toThrow('Member audit metadata rejected')
    expect(() => assertMemberAuditMetadata({ payload: { role: 'admin' } })).toThrow('Member audit metadata rejected')
    expect(() => assertMemberAuditMetadata({ nested: { membershipNumber: 'MEM-1' } })).toThrow('Member audit metadata rejected')
  })

  it('propagates a canonical chain failure', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    const { tx, execute, insert } = canonicalTx(3)
    await expect(persistDurableMemberAudit(tx, mutation)).rejects.toThrow('canonical_audit_down')
    expect(execute).toHaveBeenCalledTimes(3)
    expect(insert).not.toHaveBeenCalled()
    expect(auditLog).not.toHaveBeenCalled()
  })

  it('records creation separately from an update', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted } = legacyTx()
    await persistDurableMemberAudit(tx, { ...mutation, operation: 'create' })
    expect(inserted[0].metadata).toMatchObject({ eventType: 'data.create', operation: 'create' })
    await persistDurableMemberAudit(tx, { ...mutation, operation: 'status_change' })
    expect(inserted[1].metadata).toMatchObject({ eventType: 'data.update', operation: 'status_change' })
    await persistDurableMemberAudit(tx, { ...mutation, operation: 'role_change' })
    expect(inserted[2].action).toBe('organization_member_role_change')
    await persistDurableMemberAudit(tx, { ...mutation, operation: 'soft_delete' })
    expect(inserted[3].action).toBe('organization_member_soft_delete')
  })

  it('keeps a non-uuid target in metadata', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    const { tx, inserted } = legacyTx()
    await persistDurableMemberAudit(tx, { ...mutation, targetId: 'm-1' })
    expect(inserted[0].resourceId).toBeNull()
    expect(inserted[0].metadata?.targetId).toBe('m-1')
  })
})
