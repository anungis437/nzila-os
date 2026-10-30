import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  options: [] as Array<Record<string, unknown>>,
  execute: vi.fn(),
  rls: vi.fn(),
}))

vi.mock('@/lib/api/framework', () => ({
  withApi: (options: Record<string, unknown>, handler: unknown) => {
    m.options.push(options)
    return handler
  },
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
}))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.rls }))
vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings: [...strings], values }),
}))

beforeEach(() => {
  m.options.length = 0
  vi.resetModules()
  m.execute.mockReset().mockResolvedValue([{ date: '2026-10-01', minor: '1', major: '0', critical: '0', total: '1' }])
  m.rls.mockReset().mockImplementation(async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation({ execute: m.execute }))
})

describe('incident trend tenant boundary (DEF-0B8-HS-TRENDS-ORGANIZATION-FROM-QUERY-AND-NO-PREDICATE-WHEN-ABSENT)', () => {
  it('requires authenticated membership', async () => {
    await import('../health-safety/incidents/trends/route')
    expect(m.options).toHaveLength(1)
    expect(m.options[0]).toMatchObject({ auth: { required: true, minRole: 'member' } })
  })

  it.each(['30d', '12m'])('binds the authenticated tenant in RLS and SQL for %s, ignoring a foreign query organization', async (period) => {
    const { GET } = await import('../health-safety/incidents/trends/route')
    const rows = await (GET as any)({
      organizationId: 'org-authenticated',
      request: { url: `http://localhost/api/health-safety/incidents/trends?period=${period}&organizationId=org-foreign` },
    })
    expect(m.rls).toHaveBeenCalledTimes(1)
    expect(m.rls.mock.calls[0][0]).toEqual({ organizationId: 'org-authenticated' })
    expect(m.execute).toHaveBeenCalledTimes(1)
    const query = m.execute.mock.calls[0][0] as { strings: string[]; values: unknown[] }
    expect(query.strings.join('')).toContain('WHERE organization_id = ')
    expect(query.values).toContain('org-authenticated')
    expect(query.values).not.toContain('org-foreign')
    expect(rows).toEqual([{ date: '2026-10-01', minor: 1, major: 0, critical: 0, total: 1 }])
  })

  it('refuses a missing active organization without touching the database', async () => {
    const { GET } = await import('../health-safety/incidents/trends/route')
    await expect((GET as any)({
      organizationId: null,
      request: { url: 'http://localhost/api/health-safety/incidents/trends' },
    })).rejects.toMatchObject({ status: 403 })
    expect(m.rls).not.toHaveBeenCalled()
    expect(m.execute).not.toHaveBeenCalled()
  })

  it('rejects unsupported time periods rather than silently changing the requested window', async () => {
    const { GET } = await import('../health-safety/incidents/trends/route')
    await expect((GET as any)({
      organizationId: 'org-authenticated',
      request: { url: 'http://localhost/api/health-safety/incidents/trends?period=all-time' },
    })).rejects.toMatchObject({ status: 400 })
    expect(m.rls).not.toHaveBeenCalled()
  })
})
