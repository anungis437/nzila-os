import { describe, expect, it } from 'vitest'
import { CreateSageWorkspaceRequest } from '../schemas'

describe('CreateSageWorkspaceRequest', () => {
  const valid = {
    name: 'Ministry Assurance',
    institutionType: 'regulator',
    riskSurface: 'regulatory_boundary',
  }

  it('accepts a valid payload', () => {
    const parsed = CreateSageWorkspaceRequest.safeParse(valid)
    expect(parsed.success).toBe(true)
  })

  it('rejects a client-supplied orgId (strict)', () => {
    const parsed = CreateSageWorkspaceRequest.safeParse({ ...valid, orgId: 'org-x' })
    expect(parsed.success).toBe(false)
  })

  it('rejects a client-supplied boundaryProfile (strict)', () => {
    const parsed = CreateSageWorkspaceRequest.safeParse({
      ...valid,
      boundaryProfile: { prohibitedUses: [] },
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a client-supplied actorId/createdBy (strict)', () => {
    expect(CreateSageWorkspaceRequest.safeParse({ ...valid, actorId: 'a' }).success).toBe(false)
    expect(CreateSageWorkspaceRequest.safeParse({ ...valid, createdBy: 'a' }).success).toBe(false)
  })

  it('rejects an invalid institution type', () => {
    const parsed = CreateSageWorkspaceRequest.safeParse({ ...valid, institutionType: 'nope' })
    expect(parsed.success).toBe(false)
  })

  it('rejects an invalid risk surface', () => {
    const parsed = CreateSageWorkspaceRequest.safeParse({ ...valid, riskSurface: 'nope' })
    expect(parsed.success).toBe(false)
  })

  it('rejects an empty name', () => {
    const parsed = CreateSageWorkspaceRequest.safeParse({ ...valid, name: '   ' })
    expect(parsed.success).toBe(false)
  })
})
