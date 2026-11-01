/**
 * F06 R3 — pseudonymous access evidence for an unclaimed workbook, without inventing an organization, an actor or a consent.
 *
 * The native PostgreSQL suite (db/__tests__/migration-0054-public-intake-audit-events.postgres.test.ts) proves the store and its chain;
 * these tests pin the writer's contract and how the workbook helpers use it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ append: vi.fn(), persist: vi.fn() }))
vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persist }))
vi.mock('@/lib/public-intake/intake-audit', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/public-intake/intake-audit')>()), appendPublicIntakeAudit: m.append }))

import { PublicIntakeAuditUnavailableError, pseudonymousSubjectRef } from '../intake-audit'
import { auditClaimedWorkbookWrite, auditWorkbookRead } from '@/lib/workbook/claimed-write-audit'

const KEY = 'x'.repeat(40)
const WORKBOOK = '5b7a3a47-0a6f-4a5b-9f3c-2d3a8f0e7c11'
const preclaim = { kind: 'preclaim' as const, workbookId: WORKBOOK, claimedByUserId: null, claimedOrgId: null, actorUserId: null }
const claimed = { kind: 'claimant' as const, workbookId: WORKBOOK, claimedByUserId: 'user_1', claimedOrgId: 'org_1', actorUserId: 'user_1' }

describe('pseudonymous subject reference', () => {
  const original = process.env.PUBLIC_INTAKE_AUDIT_KEY
  beforeEach(() => { process.env.PUBLIC_INTAKE_AUDIT_KEY = KEY })

  it('is a keyed one-way reference: stable, key-dependent, and never the identifier', () => {
    const a = pseudonymousSubjectRef('unclaimed_workbook', WORKBOOK)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).toBe(pseudonymousSubjectRef('unclaimed_workbook', WORKBOOK))
    expect(a).not.toContain(WORKBOOK)
    process.env.PUBLIC_INTAKE_AUDIT_KEY = 'y'.repeat(40)
    expect(pseudonymousSubjectRef('unclaimed_workbook', WORKBOOK)).not.toBe(a)
    process.env.PUBLIC_INTAKE_AUDIT_KEY = original
  })

  it.each([undefined, '', '   ', 'short', 'changeme', 'replace-me'.padEnd(40, ' ')])('fails closed without a usable key (%j)', (value) => {
    if (value === undefined) delete process.env.PUBLIC_INTAKE_AUDIT_KEY
    else process.env.PUBLIC_INTAKE_AUDIT_KEY = value
    expect(() => pseudonymousSubjectRef('unclaimed_workbook', WORKBOOK)).toThrow(PublicIntakeAuditUnavailableError)
    process.env.PUBLIC_INTAKE_AUDIT_KEY = original
  })
})

describe('workbook audit helpers', () => {
  beforeEach(() => {
    m.append.mockReset().mockResolvedValue({ subjectRef: 'r', contentHash: 'h' })
    m.persist.mockReset().mockResolvedValue(undefined)
  })

  it('records an unclaimed write under the pseudonymous authority with no organization and no actor, and never the workbook id as a resource', async () => {
    await auditClaimedWorkbookWrite(preclaim, { action: 'workbook.memory_holder.create', resourceType: 'workbook_memory_holders', resourceId: 'holder-1', details: { role: 'Treasurer', responsibility: 'Payroll', fields: ['role'] } })

    expect(m.persist).not.toHaveBeenCalled()
    const entry = m.append.mock.calls[0][1]
    expect(entry).toEqual({
      surface: 'workbook.memory_holder',
      action: 'workbook.memory_holder.create',
      operation: 'create',
      subjectKind: 'unclaimed_workbook',
      subjectId: WORKBOOK,
      resourceRef: 'holder-1',
      details: { fields: ['role'] },
    })

    await auditClaimedWorkbookWrite(preclaim, { action: 'workbook.export', resourceType: 'workbooks', resourceId: WORKBOOK, details: { format: 'pdf', secret: 'x' } })
    expect(m.append.mock.calls[1][1]).toMatchObject({ operation: 'read', resourceRef: null, details: { format: 'pdf' } })
  })

  it.each([
    ['workbook.memory_holder.update', 'update'],
    ['workbook.memory_holder.update_not_found', 'update'],
    ['workbook.memory_holder.delete', 'delete'],
    ['workbook.memory_holder.delete_not_found', 'delete'],
  ])('classifies %s as %s', async (action, operation) => {
    await auditClaimedWorkbookWrite(preclaim, { action, resourceType: 'workbook_memory_holders', resourceId: 'h', details: {} })
    expect(m.append.mock.calls[0][1].operation).toBe(operation)
  })

  it('records a claimed access under the claiming organization and the acting person, and nothing pseudonymous', async () => {
    await auditClaimedWorkbookWrite(claimed, { action: 'workbook.memory_holder.update', resourceType: 'workbook_memory_holders', resourceId: 'h', details: { fields: ['role'] } })
    await auditWorkbookRead(claimed, { action: 'workbook.memory_holder.read', resourceType: 'workbook_memory_holders', resourceId: WORKBOOK, details: {} })

    expect(m.append).not.toHaveBeenCalled()
    expect(m.persist.mock.calls.map((c) => c[1])).toEqual([
      expect.objectContaining({ organizationId: 'org_1', userId: 'user_1', action: 'workbook.memory_holder.update' }),
      expect.objectContaining({ organizationId: 'org_1', userId: 'user_1', action: 'workbook.memory_holder.read' }),
    ])
  })

  it('refuses a claimed access that has no organization to attribute, as before', async () => {
    await expect(auditWorkbookRead({ ...claimed, claimedOrgId: null }, { action: 'workbook.memory_holder.read', resourceType: 'x', resourceId: WORKBOOK, details: {} })).rejects.toThrow(/no organization/)
  })

  it('lets a failed record propagate so the protected operation does not proceed', async () => {
    m.append.mockRejectedValueOnce(new PublicIntakeAuditUnavailableError())
    await expect(auditWorkbookRead(preclaim, { action: 'workbook.memory_holder.read', resourceType: 'x', resourceId: WORKBOOK, details: {} })).rejects.toBeInstanceOf(PublicIntakeAuditUnavailableError)
  })
})
