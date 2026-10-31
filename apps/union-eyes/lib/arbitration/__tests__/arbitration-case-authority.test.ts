import { beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => vi.fn())
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: access }))

import { mayWriteArbitrationFor } from '../arbitration-case-authority'

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
