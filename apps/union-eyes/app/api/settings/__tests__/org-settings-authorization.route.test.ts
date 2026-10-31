import { beforeEach, describe, expect, it, vi } from 'vitest'

// Policy regression: organization-level settings are administrator-only. A member must never be able to
// read the organization's configuration, and nothing below admin may change sharing settings.
const captured = vi.hoisted(() => ({ withApi: [] as Array<Record<string, any>>, crud: [] as Array<Record<string, any>> }))

vi.mock('@/db/db', () => ({ db: {} }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: vi.fn() }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }))
vi.mock('@/db/schema-organizations', () => ({ organizations: {} }))
vi.mock('@/db/schema', () => ({ organizationMembers: {}, organizations: {} }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), sql: vi.fn(), count: vi.fn() }))
vi.mock('@/lib/api/framework', () => ({
  withApi: (options: Record<string, any>, handler: unknown) => { captured.withApi.push(options); return handler },
}))
vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: (options: Record<string, any>) => { captured.crud.push(options); return { GET: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() } },
}))
vi.mock('@/lib/api/require-own-organization-item', () => ({ requireOwnOrganizationItem: (_key: string, handler: unknown) => handler }))

beforeEach(() => { captured.withApi.length = 0; captured.crud.length = 0; vi.resetModules() })

describe('organization settings API authorization policy', () => {
  it('requires the admin role to read organization settings, as it does to write them', async () => {
    await import('../organization/route')
    expect(captured.withApi).toHaveLength(2)
    for (const options of captured.withApi) {
      expect(options.auth).toEqual({ required: true, minRole: 'admin' })
    }
  })

  it('denies the former generic organization-row sharing-settings facade and fails closed', async () => {
    const route = await import('../../organizations/[id]/sharing-settings/route')
    expect(captured.crud).toHaveLength(0)
    expect(captured.withApi).toHaveLength(1)
    expect(captured.withApi[0].auth).toEqual({ required: true, minRole: 'admin' })
    expect('PATCH' in route).toBe(false)
    expect('DELETE' in route).toBe(false)
    const foreign = await (route.GET as any)({ organizationId: 'org-a', params: { id: 'org-b' } })
    expect(foreign.status).toBe(403)
    const own = await (route.GET as any)({ organizationId: 'org-a', params: { id: 'org-a' } })
    expect(own.status).toBe(501)
    expect(own.headers.get('cache-control')).toContain('no-store')
    expect((await own.json()).error).toBe('GOVERNED_SHARING_SETTINGS_NOT_IMPLEMENTED')
  })
})
