import { describe, expect, it, vi } from 'vitest'
import { SAGE_PERMISSIONS } from '@nzila/sage-core'

// `runtime` imports `org-scope-guard`, which pulls in next-auth; stub the
// session module so it doesn't load in the node test environment.
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => null }))

const { mapSagePermissions } = await import('../runtime')
const { createSageServiceContext, resolveSageActorKind } = await import('../runtime')

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

describe('resolveSageActorKind (fail-closed trusted identity)', () => {
  const base = { actorId: 'u', orgId: 'o', orgRole: 'org_admin' }

  it('maps a verified interactive user to human', () => {
    expect(resolveSageActorKind({ ...base, authenticationType: 'interactive_user' })).toBe('human')
  })

  it('maps a verified service principal to service', () => {
    expect(resolveSageActorKind({ ...base, authenticationType: 'service_principal' })).toBe('service')
  })

  it('maps verified internal system execution to system', () => {
    expect(resolveSageActorKind({ ...base, authenticationType: 'internal_system' })).toBe('system')
  })

  it('honours an explicit server-set actorKind override', () => {
    expect(resolveSageActorKind({ ...base, actorKind: 'service' })).toBe('service')
  })

  it('accepts matching dual fields (interactive_user + human)', () => {
    expect(
      resolveSageActorKind({ ...base, authenticationType: 'interactive_user', actorKind: 'human' }),
    ).toBe('human')
  })

  it('accepts matching dual fields (service_principal + service)', () => {
    expect(
      resolveSageActorKind({ ...base, authenticationType: 'service_principal', actorKind: 'service' }),
    ).toBe('service')
  })

  it('accepts matching dual fields (internal_system + system)', () => {
    expect(
      resolveSageActorKind({ ...base, authenticationType: 'internal_system', actorKind: 'system' }),
    ).toBe('system')
  })

  it('rejects conflicting dual fields (interactive_user + service)', () => {
    expect(() =>
      resolveSageActorKind({ ...base, authenticationType: 'interactive_user', actorKind: 'service' }),
    ).toThrow(/conflicts with the authenticated identity/i)
  })

  it('rejects conflicting dual fields (service_principal + human)', () => {
    expect(() =>
      resolveSageActorKind({ ...base, authenticationType: 'service_principal', actorKind: 'human' }),
    ).toThrow(/conflicts with the authenticated identity/i)
  })

  it('rejects conflicting dual fields (internal_system + human)', () => {
    expect(() =>
      resolveSageActorKind({ ...base, authenticationType: 'internal_system', actorKind: 'human' }),
    ).toThrow(/conflicts with the authenticated identity/i)
  })

  it('rejects a missing classification (never defaults to human)', () => {
    expect(() => resolveSageActorKind({ ...base })).toThrow(/actor kind is required/i)
  })

  it('rejects an unknown authentication type', () => {
    expect(() =>
      resolveSageActorKind({ ...base, authenticationType: 'phished' as never }),
    ).toThrow(/missing or unknown/i)
  })
})

describe('createSageServiceContext (identity composition, fail-closed)', () => {
  it('derives a human actor from an interactive session', () => {
    const ctx = createSageServiceContext({
      actorId: 'u',
      orgId: 'o',
      orgRole: 'org_admin',
      authenticationType: 'interactive_user',
    })
    expect(ctx.actor.actorKind).toBe('human')
  })

  it('derives a service actor from a verified service principal', () => {
    const ctx = createSageServiceContext({
      actorId: 'svc',
      orgId: 'o',
      orgRole: 'org_admin',
      authenticationType: 'service_principal',
    })
    expect(ctx.actor.actorKind).toBe('service')
  })

  it('rejects a context with no identity classification', () => {
    expect(() =>
      createSageServiceContext({ actorId: 'u', orgId: 'o', orgRole: 'org_admin' }),
    ).toThrow(/actor kind is required/i)
  })
})
