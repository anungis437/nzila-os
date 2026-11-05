import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  canonical: false,
  legacyRows: [] as Record<string, unknown>[],
  canonicalRows: [] as Record<string, unknown>[],
  executed: [] as unknown[],
  legacyLimit: 0,
}))

vi.mock('@/db/schema/audit-security-schema', () => ({ auditLogs: { auditId: 'auditId', organizationId: 'organizationId', createdAt: 'createdAt' } }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => m.canonical }))
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), desc: vi.fn(() => 'desc') }
})

const tx = {
  select: () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({ limit: async (n: number) => { m.legacyLimit = n; return m.legacyRows } }),
        limit: async () => m.legacyRows,
      }),
    }),
  }),
  execute: async (query: unknown) => { m.executed.push(query); return m.canonicalRows },
}

import { listAuditEntries, readAuditEntry, AUDIT_LIST_LIMIT } from '../audit-reader'

const ID_L = '11111111-1111-4111-8111-111111111111'
const ID_C = '22222222-2222-4222-8222-222222222222'
const legacy = { auditId: ID_L, action: 'a.legacy', resourceType: 't', resourceId: null, userId: 'u1', severity: 'info', outcome: 'success', createdAt: new Date('2026-01-01T00:00:00Z'), ipAddress: '10.0.0.1', metadata: { secret: 1 } }
const canonical = { audit_id: ID_C, action: 'a.canonical', resource_type: 't', resource_id: 'r1', user_id: 'u2', created_at: '2026-02-01T00:00:00Z', details: { secret: 2 }, ip_address: '10.0.0.2' }

describe('audit reader', () => {
  beforeEach(() => {
    m.canonical = false
    m.legacyRows = [legacy]
    m.canonicalRows = [canonical]
    m.executed = []
    m.legacyLimit = 0
  })

  it('reads only the legacy store when the canonical state context is off, and never queries the canonical table', async () => {
    const entries = await listAuditEntries(tx as never, 'org_1')
    expect(entries.map((e) => [e.auditId, e.source])).toEqual([[ID_L, 'legacy']])
    expect(m.executed).toHaveLength(0)
  })

  it('shows the canonical records too, newest first, each labelled with its store, with no severity or outcome invented', async () => {
    m.canonical = true
    const entries = await listAuditEntries(tx as never, 'org_1')
    expect(entries.map((e) => [e.auditId, e.source])).toEqual([[ID_C, 'canonical'], [ID_L, 'legacy']])
    expect(entries[0]).toMatchObject({ severity: null, outcome: null, resourceId: 'r1', userId: 'u2' })
  })

  it('returns no details, changes, addresses or session data from either store', async () => {
    m.canonical = true
    const text = JSON.stringify(await listAuditEntries(tx as never, 'org_1'))
    expect(text).not.toMatch(/secret|10\.0\.0|ipAddress|details|metadata/)
  })

  it('bounds the page', async () => {
    await listAuditEntries(tx as never, 'org_1', 100000)
    expect(m.legacyLimit).toBe(AUDIT_LIST_LIMIT)
    await listAuditEntries(tx as never, 'org_1', 0)
    expect(m.legacyLimit).toBe(1)
  })

  it('finds a canonical record by id in canonical mode, falls back to legacy, and answers null for neither', async () => {
    m.canonical = true
    expect(await readAuditEntry(tx as never, 'org_1', ID_C)).toMatchObject({ source: 'canonical' })
    m.canonicalRows = []
    expect(await readAuditEntry(tx as never, 'org_1', ID_L)).toMatchObject({ source: 'legacy' })
    m.legacyRows = []
    expect(await readAuditEntry(tx as never, 'org_1', ID_L)).toBeNull()
  })

  it('does not look in the canonical store at all in legacy mode', async () => {
    expect(await readAuditEntry(tx as never, 'org_1', ID_C)).toMatchObject({ source: 'legacy' })
    expect(m.executed).toHaveLength(0)
  })
})
