import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  options: [] as Array<Record<string, unknown>>,
  rls: vi.fn(), audit: vi.fn(), select: vi.fn(),
  query: {} as any, rows: [] as any[],
}))
vi.mock('@/lib/api/framework', () => ({
  withApi: (options: Record<string, unknown>, handler: unknown) => { m.options.push(options); return handler },
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
  },
}))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.rls }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }))
vi.mock('@/lib/pension/pension-authority', () => ({ PENSION_ADMIN_ROLES: ['secretary_treasurer'] }))
vi.mock('@/db/schema', () => ({ pensionTrusteeMeetings: { id: 'id', organizationId: 'organizationId', createdAt: 'createdAt' } }))
vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
  and: (...conditions: unknown[]) => ({ conditions }),
  desc: (column: unknown) => ({ descending: column }),
}))

beforeEach(() => {
  vi.resetModules()
  m.options.length = 0
  m.rows = [{ id: 'meeting-a', organizationId: 'org-a', agenda: 'confidential' }]
  m.audit.mockReset().mockResolvedValue(undefined)
  m.select.mockReset().mockImplementation(() => m.query)
  m.query = {
    from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), offset: vi.fn(),
    then: (resolve: (rows: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(m.rows).then(resolve, reject),
  }
  m.query.from.mockReturnValue(m.query)
  m.query.where.mockReturnValue(m.query)
  m.query.orderBy.mockReturnValue(m.query)
  m.query.limit.mockReturnValue(m.query)
  m.query.offset.mockImplementation(async () => m.rows)
  m.rls.mockReset().mockImplementation(async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation({ select: m.select }))
})

describe('DEF-0B10-PEN-TRUSTEE-MEETING-READS confidential read containment', () => {
  it('restricts list GET to the pension financial administrator role', async () => {
    await import('../pension/trustee-meetings/route')
    expect(m.options[0]).toMatchObject({ auth: { required: true, roles: ['secretary_treasurer'] } })
    expect(m.options[0]).not.toMatchObject({ auth: { minRole: 'member' } })
  })

  it('restricts item GET to the pension financial administrator role', async () => {
    await import('../pension/trustee-meetings/[id]/route')
    expect(m.options[0]).toMatchObject({ auth: { required: true, roles: ['secretary_treasurer'] } })
    expect(m.options[0]).not.toMatchObject({ auth: { minRole: 'member' } })
  })


  it('refuses unversioned trustee meeting amendments rather than overwriting confidential minutes', async () => {
    const { PATCH } = await import('../pension/trustee-meetings/[id]/route')
    expect(m.options[1]).toMatchObject({ auth: { required: true, roles: ['secretary_treasurer'] } })
    const response = await (PATCH as any)({
      organizationId: 'org-a', userId: 'user-a', params: { id: 'meeting-a' },
      body: { minutes: 'replace existing approved minutes', attendees: [] },
    })
    expect(response.status).toBe(501)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(await response.json()).toMatchObject({ error: 'TRUSTEE_MEETING_REVISION_NOT_IMPLEMENTED' })
    expect(m.rls).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('refuses destructive trustee meeting deletion without an approved retention workflow', async () => {
    const { DELETE } = await import('../pension/trustee-meetings/[id]/route')
    expect(m.options[2]).toMatchObject({ auth: { required: true, roles: ['secretary_treasurer'] } })
    const response = await (DELETE as any)({
      organizationId: 'org-a', userId: 'user-a', params: { id: 'meeting-a' },
    })
    expect(response.status).toBe(501)
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(await response.json()).toMatchObject({ error: 'TRUSTEE_MEETING_REVISION_NOT_IMPLEMENTED' })
    expect(m.rls).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('binds list reads to the authenticated tenant, paginates, and atomically audits the reader', async () => {
    const { GET } = await import('../pension/trustee-meetings/route')
    const result = await (GET as any)({ organizationId: 'org-a', userId: 'user-a', request: { url: 'http://localhost/api/pension/trustee-meetings?page=2&pageSize=20&organizationId=org-b' } })
    expect(result).toEqual(m.rows)
    expect(m.rls.mock.calls[0][0]).toEqual({ organizationId: 'org-a', userId: 'user-a' })
    expect(m.query.where).toHaveBeenCalledWith({ column: 'organizationId', value: 'org-a' })
    expect(m.query.limit).toHaveBeenCalledWith(20)
    expect(m.query.offset).toHaveBeenCalledWith(20)
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ select: m.select }), expect.objectContaining({ organizationId: 'org-a', userId: 'user-a', action: 'pension.trustee_meeting.list_read' }))
  })

  it('requires actor and tenant and rejects unbounded or malformed pagination', async () => {
    const { GET } = await import('../pension/trustee-meetings/route')
    for (const [organizationId, userId, query] of [[null, 'user-a', ''], ['org-a', null, ''], ['org-a', 'user-a', '?page=-1'], ['org-a', 'user-a', '?pageSize=101'], ['org-a', 'user-a', '?page=abc'], ['org-a', 'user-a', '?page=01'], ['org-a', 'user-a', '?pageSize=0'], ['org-a', 'user-a', '?page=1.5'], ['org-a', 'user-a', '?page=1e2']]) {
      await expect((GET as any)({ organizationId, userId, request: { url: 'http://localhost/api/pension/trustee-meetings' + query } })).rejects.toMatchObject({ status: organizationId && userId ? 400 : 403 })
    }
    expect(m.rls).not.toHaveBeenCalled()
  })

  it('binds item reads to both tenant and item, and does not reveal foreign or missing meetings', async () => {
    const { GET } = await import('../pension/trustee-meetings/[id]/route')
    const result = await (GET as any)({ organizationId: 'org-a', userId: 'user-a', params: { id: 'meeting-a' } })
    expect(result).toEqual(m.rows[0])
    expect(m.rls.mock.calls[0][0]).toEqual({ organizationId: 'org-a', userId: 'user-a' })
    expect(m.query.where).toHaveBeenCalledWith({ conditions: [{ column: 'id', value: 'meeting-a' }, { column: 'organizationId', value: 'org-a' }] })
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: 'org-a', userId: 'user-a', action: 'pension.trustee_meeting.read', resourceId: 'meeting-a' }))
    m.rows = []
    await expect((GET as any)({ organizationId: 'org-a', userId: 'user-a', params: { id: 'meeting-foreign' } })).rejects.toMatchObject({ status: 404 })
  })

  it('fails closed when the mandatory read audit cannot be written', async () => {
    const { GET } = await import('../pension/trustee-meetings/route')
    m.audit.mockRejectedValueOnce(new Error('audit unavailable'))
    await expect((GET as any)({ organizationId: 'org-a', userId: 'user-a', request: { url: 'http://localhost/api/pension/trustee-meetings' } })).rejects.toThrow('audit unavailable')
  })
  it('binds trustee meeting creation to the authenticated actor and tenant, refusing spoofed body identities', async () => {
    const { POST } = await import('../pension/trustee-meetings/route')
    let inserted: Record<string, unknown> | undefined
    const insertingTx = (operation: (tx: unknown) => Promise<unknown>) => operation({
      insert: () => ({
        values: (value: Record<string, unknown>) => {
          inserted = value
          return { returning: async () => [{ id: 'meeting-new', ...value }] }
        },
      }),
    })
    // The scheduling schema is strict: a body that names another tenant or user is refused, and nothing is written.
    await expect((POST as any)({
      organizationId: 'org-a', userId: 'user-a',
      body: { title: 'Trustee review', scheduledDate: '2026-11-01', organizationId: 'org-b', userId: 'user-b' },
    })).rejects.toThrow('Invalid trustee meeting scheduling fields')
    expect(inserted).toBeUndefined()

    m.rls.mockImplementationOnce(async (context: unknown, operation: (tx: unknown) => Promise<unknown>) => {
      expect(context).toEqual({ organizationId: 'org-a', userId: 'user-a' })
      return insertingTx(operation)
    })
    const result = await (POST as any)({
      organizationId: 'org-a', userId: 'user-a',
      body: { title: 'Trustee review', scheduledDate: '2026-11-01' },
    })
    expect(inserted).toMatchObject({ organizationId: 'org-a', title: 'Trustee review' })
    expect(inserted).not.toHaveProperty('userId')
    expect(result).toMatchObject({ id: 'meeting-new', organizationId: 'org-a' })
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: 'org-a', userId: 'user-a',
        action: 'pension.trustee_meeting.schedule', resourceId: 'meeting-new',
      }),
    )
  })

  it('does not claim trustee meeting creation succeeded if mandatory audit persistence fails', async () => {
    const { POST } = await import('../pension/trustee-meetings/route')
    m.rls.mockImplementationOnce(async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) =>
      operation({
        insert: () => ({
          values: () => ({ returning: async () => [{ id: 'meeting-new' }] }),
        }),
      }),
    )
    m.audit.mockRejectedValueOnce(new Error('audit unavailable'))
    await expect((POST as any)({
      organizationId: 'org-a', userId: 'user-a',
      body: { title: 'Trustee review', scheduledDate: '2026-11-01' },
    })).rejects.toThrow('audit unavailable')
  })

})
