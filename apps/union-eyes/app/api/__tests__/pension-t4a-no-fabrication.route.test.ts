import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ options: [] as Array<Record<string, unknown>>, rls: vi.fn() }))
vi.mock('@/lib/api/framework', () => ({
  withApi: (options: Record<string, unknown>, handler: unknown) => { m.options.push(options); return handler },
  ApiError: { forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }) },
}))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.rls }))
vi.mock('@/lib/pension/pension-authority', () => ({
  isPensionAdministrator: () => false,
  ownPensionIdentities: vi.fn(),
  PENSION_ADMIN_ROLES: ['secretary_treasurer'],
}))
vi.mock('@/db/schema', () => ({ pensionT4aRecords: {} }))

beforeEach(() => { vi.resetModules(); m.options.length = 0; m.rls.mockReset() })

describe('DEF-0B10-PEN-T4A-POST must not fabricate generated tax records', () => {
  it('keeps the financial administrator role gate on POST', async () => {
    await import('../pension/t4a/route')
    expect(m.options[1]).toMatchObject({ auth: { required: true, roles: ['secretary_treasurer'] } })
  })

  it('refuses missing actor or organization without accessing the database', async () => {
    const { POST } = await import('../pension/t4a/route')
    await expect((POST as any)({ organizationId: null, userId: 'user-a' })).rejects.toMatchObject({ status: 403 })
    await expect((POST as any)({ organizationId: 'org-a', userId: null })).rejects.toMatchObject({ status: 403 })
    expect(m.rls).not.toHaveBeenCalled()
  })

  it('returns honest no-store 501 and never inserts caller-provided pension income', async () => {
    const { POST } = await import('../pension/t4a/route')
    const response = await (POST as any)({
      organizationId: 'org-a', userId: 'treasurer-a',
      body: { memberId: 'member-b', taxYear: 2026, pensionIncome: '-99999', status: 'generated' },
    })
    expect(response.status).toBe(501)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toMatchObject({
      error: 'PENSION_T4A_GENERATION_NOT_IMPLEMENTED',
      capability: 'pension.t4a.generate', capabilityState: 'NOT_IMPLEMENTED',
    })
    expect(m.rls).not.toHaveBeenCalled()
  })
})
