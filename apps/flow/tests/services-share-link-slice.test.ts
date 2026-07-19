import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockEmitWorkflowAuditEvent,
  mockLogger,
  mockSelectLimit,
  mockSelectWhere,
  mockInsertReturning,
  mockUpdateReturning,
} = vi.hoisted(() => ({
  mockEmitWorkflowAuditEvent: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockSelectLimit: vi.fn(),
  mockSelectWhere: vi.fn(),
  mockInsertReturning: vi.fn(),
  mockUpdateReturning: vi.fn(),
}))

vi.mock('@/lib/services/workflow-audit-service', () => ({
  emitWorkflowAuditEvent: mockEmitWorkflowAuditEvent,
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  sql: vi.fn((x: TemplateStringsArray) => x.join('')),
}))

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_SETTINGS: { shareLinkExpiryDays: 7 },
}))

vi.mock('@nzila/db', () => {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => mockSelectWhere()),
    limit: mockSelectLimit,
  }
  const insertChain = {
    values: vi.fn(() => insertChain),
    returning: mockInsertReturning,
  }
  const updateChain = {
    set: vi.fn(() => updateChain),
    where: vi.fn(() => updateChain),
    returning: mockUpdateReturning,
  }
  return {
    db: {
      select: vi.fn(() => selectChain),
      insert: vi.fn(() => insertChain),
      update: vi.fn(() => updateChain),
    },
    commerceShareLinks: {
      id: 'id',
      quoteId: 'quoteId',
      tokenHash: 'tokenHash',
      status: 'status',
      accessCount: 'accessCount',
    },
  }
})

describe('share-link service slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectWhere.mockReturnValue({ limit: mockSelectLimit })
  })

  it('validates token format and not found/revoked/expired branches', async () => {
    const { validateShareLink } = await import('@/lib/services/share-link-service')

    const badFormat = await validateShareLink('short')
    expect(badFormat.ok).toBe(false)

    mockSelectLimit.mockResolvedValueOnce([])
    const notFound = await validateShareLink('a'.repeat(64))
    expect(notFound.ok).toBe(false)

    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'sl-1',
        quoteId: 'q-1',
        tokenHash: 'h',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        createdBy: 'u-1',
        status: 'REVOKED',
        accessCount: 0,
        lastAccessedAt: null,
      },
    ])
    const revoked = await validateShareLink('b'.repeat(64))
    expect(revoked.ok).toBe(false)

    mockSelectLimit.mockResolvedValueOnce([
      {
        id: 'sl-2',
        quoteId: 'q-2',
        tokenHash: 'h',
        expiresAt: new Date(Date.now() - 86400000),
        createdAt: new Date(),
        createdBy: 'u-1',
        status: 'ACTIVE',
        accessCount: 0,
        lastAccessedAt: null,
      },
    ])
    const expired = await validateShareLink('c'.repeat(64))
    expect(expired.ok).toBe(false)
  })

  it('supports create, successful validate, revoke, list and get', async () => {
    const {
      createShareLink,
      validateShareLink,
      revokeShareLink,
      markShareLinkUsed,
      findShareLinksForQuote,
      getShareLink,
    } = await import('@/lib/services/share-link-service')

    const now = new Date()
    const row = {
      id: 'sl-10',
      quoteId: '11111111-1111-4111-8111-111111111111',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: now,
      createdBy: 'u-1',
      status: 'ACTIVE',
      accessCount: 0,
      lastAccessedAt: null,
    }

    mockInsertReturning.mockResolvedValueOnce([row])
    const created = await createShareLink(
      {
        quoteId: '11111111-1111-4111-8111-111111111111',
        createdBy: 'u-1',
        expiresInDays: 3,
      },
      'org-1',
    )
    expect(created.link.id).toBe('sl-10')
    expect(created.rawToken.length).toBeGreaterThan(20)

    mockSelectLimit.mockResolvedValueOnce([row])
    mockUpdateReturning.mockResolvedValueOnce([{ ...row, accessCount: 1, lastAccessedAt: new Date() }])
    const valid = await validateShareLink(created.rawToken)
    expect(valid.ok).toBe(true)

    mockSelectLimit.mockResolvedValueOnce([])
    expect(await revokeShareLink('missing', 'u-1', 'org-1')).toBe(false)

    mockSelectLimit.mockResolvedValueOnce([{ id: 'sl-10', quoteId: row.quoteId }])
    expect(await revokeShareLink('sl-10', 'u-1', 'org-1')).toBe(true)

    await markShareLinkUsed('sl-10')

    const listRows = [{ ...row, createdAt: new Date(Date.now() - 1000) }, { ...row, id: 'sl-11', createdAt: new Date() }]
    mockSelectWhere.mockReturnValueOnce(listRows)
    const listed = await findShareLinksForQuote(row.quoteId)
    expect(listed[0]?.id).toBe('sl-11')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([row])
    const one = await getShareLink('sl-10')
    expect(one?.id).toBe('sl-10')

    mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit })
    mockSelectLimit.mockResolvedValueOnce([])
    const none = await getShareLink('missing')
    expect(none).toBeUndefined()
  })
})
