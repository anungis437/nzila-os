import { beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => vi.fn())
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: access }))

import { arbitrationRowReadable, mayReadArbitrationFor, mayWriteArbitrationFor } from '../arbitration-case-authority'

const who = { organizationId: 'org-1', grievanceId: 'g-1', userId: 'u-1' }

describe('mayWriteArbitrationFor', () => {
  beforeEach(() => access.mockReset())

  it('admits the primary owner and a collaborator who may edit the case', async () => {
    access.mockResolvedValue({ canViewCase: true, isPrimaryOwner: true, canEditCaseNotes: false })
    expect(await mayWriteArbitrationFor(who)).toBe(true)
    access.mockResolvedValue({ canViewCase: true, isPrimaryOwner: false, canEditCaseNotes: true })
    expect(await mayWriteArbitrationFor(who)).toBe(true)
  })

  it('refuses a steward who does not hold the case, and one who may only read or comment', async () => {
    access.mockResolvedValue({ canViewCase: false, isPrimaryOwner: false, canEditCaseNotes: false })
    expect(await mayWriteArbitrationFor(who)).toBe(false)
    access.mockResolvedValue({ canViewCase: true, isPrimaryOwner: false, canEditCaseNotes: false })
    expect(await mayWriteArbitrationFor(who)).toBe(false)
  })
})

// DEF-0B3-ARBITRATION-RECORD-NO-CASE-AUTHORITY: reading an arbitration needs the kernel's read verdict on its grievance.
describe('mayReadArbitrationFor / arbitrationRowReadable', () => {
  beforeEach(() => access.mockReset())

  it('admits a caller the kernel lets read the case, including a read-only collaborator', async () => {
    access.mockResolvedValue({ canViewCase: true, isPrimaryOwner: false, canEditCaseNotes: false })
    expect(await mayReadArbitrationFor(who)).toBe(true)
    expect(await arbitrationRowReadable({ id: 'a-1', grievanceId: 'g-1' }, { userId: 'u-1', organizationId: 'org-1' })).toBe(true)
    expect(access).toHaveBeenLastCalledWith({ organizationId: 'org-1', grievanceId: 'g-1', userId: 'u-1' })
  })

  it('refuses a steward of the organization who has no standing with the case', async () => {
    access.mockResolvedValue({ canViewCase: false, isPrimaryOwner: false, canEditCaseNotes: false })
    expect(await mayReadArbitrationFor(who)).toBe(false)
    expect(await arbitrationRowReadable({ id: 'a-1', grievanceId: 'g-1' }, { userId: 'u-1', organizationId: 'org-1' })).toBe(false)
  })

  it('refuses without asking the kernel when the row names no grievance or there is no organization', async () => {
    expect(await arbitrationRowReadable({ id: 'a-1', grievanceId: null }, { userId: 'u-1', organizationId: 'org-1' })).toBe(false)
    expect(await arbitrationRowReadable({ id: 'a-1', grievanceId: 'g-1' }, { userId: 'u-1', organizationId: null })).toBe(false)
    expect(access).not.toHaveBeenCalled()
  })
})
