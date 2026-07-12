import { describe, expect, it, vi } from 'vitest'
import { SAGE_PERMISSIONS } from '@nzila/sage-core'

// `runtime` imports `org-scope-guard`, which pulls in next-auth; stub the
// session module so it doesn't load in the node test environment.
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => null }))

const { mapSagePermissions } = await import('../runtime')

describe('mapSagePermissions', () => {
  it('grants nothing to a plain viewer (workspace access comes from SAGE role)', () => {
    expect(mapSagePermissions('org_viewer')).toEqual([])
  })

  it('grants create (bootstrap) but not oversight to a write role', () => {
    const perms = mapSagePermissions('org_secretary')
    expect(perms).toContain(SAGE_PERMISSIONS.WORKSPACE_CREATE)
    expect(perms).not.toContain(SAGE_PERMISSIONS.WORKSPACE_ADMIN)
    expect(perms).not.toContain(SAGE_PERMISSIONS.WORKSPACE_READ)
  })

  it('grants create + explicit oversight to an org admin', () => {
    const perms = mapSagePermissions('org_admin')
    expect(perms).toContain(SAGE_PERMISSIONS.WORKSPACE_CREATE)
    expect(perms).toContain(SAGE_PERMISSIONS.WORKSPACE_ADMIN)
    // Oversight is read-only: never evidence or export authority.
    expect(perms).not.toContain(SAGE_PERMISSIONS.EVIDENCE_CREATE)
    expect(perms).not.toContain(SAGE_PERMISSIONS.EXPORT_APPROVE)
  })

  it('grants nothing to an unknown role', () => {
    expect(mapSagePermissions('none')).toEqual([])
  })
})
