import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockExecuteCommand,
  mockQuoteRepo,
  mockResolveOrgContext,
  mockCreateShareLink,
  mockFindShareLinksForQuote,
} = vi.hoisted(() => ({
  mockExecuteCommand: vi.fn(),
  mockQuoteRepo: {
    findById: vi.fn(),
  },
  mockResolveOrgContext: vi.fn(),
  mockCreateShareLink: vi.fn(),
  mockFindShareLinksForQuote: vi.fn(),
}))

vi.mock('@/lib/control/control-adapter', () => ({
  executeCommand: mockExecuteCommand,
}))

vi.mock('@/lib/db', () => ({
  quoteRepo: mockQuoteRepo,
}))

vi.mock('@/lib/resolve-org', () => ({
  resolveOrgContext: mockResolveOrgContext,
}))

vi.mock('@/lib/services/share-link-service', () => ({
  createShareLink: mockCreateShareLink,
  findShareLinksForQuote: mockFindShareLinksForQuote,
}))

describe('send quote actions slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1', actorId: 'user-1' })
    mockQuoteRepo.findById.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' })
    mockExecuteCommand.mockResolvedValue({ ok: true })
    mockCreateShareLink.mockResolvedValue({ rawToken: 'tok-1' })
    mockFindShareLinksForQuote.mockResolvedValue([{ id: 'lnk-1' }])
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('covers submit-for-review success and command-failure branches', async () => {
    const mod = await import('@/lib/send-quote-actions')

    expect(await mod.submitForReviewAction('q-1')).toEqual({
      ok: true,
      data: { status: 'INTERNAL_REVIEW' },
    })

    mockExecuteCommand.mockResolvedValueOnce({ ok: false, error: 'blocked' })
    expect(await mod.submitForReviewAction('q-1')).toEqual({ ok: false, error: 'blocked' })

    mockExecuteCommand.mockResolvedValueOnce({ ok: false })
    expect(await mod.submitForReviewAction('q-1')).toEqual({ ok: false, error: 'Transition failed' })
  })

  it('covers send-quote parse/lookup/transition/share-link branches', async () => {
    const mod = await import('@/lib/send-quote-actions')

    const ok = await mod.sendQuoteToClientAction({
      quoteId: '11111111-1111-4111-8111-111111111111',
      expiresInDays: 7,
    })
    expect(ok).toEqual({
      ok: true,
      data: { shareLinkUrl: 'http://localhost:3007/quote/tok-1', status: 'SENT_TO_CLIENT' },
    })

    process.env.NEXT_PUBLIC_APP_URL = 'https://nzila.example'
    const okWithBase = await mod.sendQuoteToClientAction({
      quoteId: '11111111-1111-4111-8111-111111111111',
      expiresInDays: 7,
    })
    expect(okWithBase).toEqual({
      ok: true,
      data: { shareLinkUrl: 'https://nzila.example/quote/tok-1', status: 'SENT_TO_CLIENT' },
    })

    const invalid = await mod.sendQuoteToClientAction({
      quoteId: 'not-a-uuid',
      expiresInDays: 7,
    } as never)
    expect(invalid.ok).toBe(false)
    expect(invalid.error?.toLowerCase()).toContain('invalid uuid')

    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    expect(
      await mod.sendQuoteToClientAction({
        quoteId: '11111111-1111-4111-8111-111111111111',
        expiresInDays: 7,
      }),
    ).toEqual({ ok: false, error: 'Quote not found' })

    mockExecuteCommand.mockResolvedValueOnce({ ok: false, error: 'cannot send' })
    expect(
      await mod.sendQuoteToClientAction({
        quoteId: '11111111-1111-4111-8111-111111111111',
        expiresInDays: 7,
      }),
    ).toEqual({ ok: false, error: 'cannot send' })

    mockExecuteCommand.mockResolvedValueOnce({ ok: false })
    expect(
      await mod.sendQuoteToClientAction({
        quoteId: '11111111-1111-4111-8111-111111111111',
        expiresInDays: 7,
      }),
    ).toEqual({ ok: false, error: 'Transition failed' })

    mockCreateShareLink.mockRejectedValueOnce('boom')
    expect(
      await mod.sendQuoteToClientAction({
        quoteId: '11111111-1111-4111-8111-111111111111',
        expiresInDays: 7,
      }),
    ).toEqual({ ok: false, error: 'Failed to send quote' })
  })

  it('covers submit/send catch branches and share-links retrieval', async () => {
    const mod = await import('@/lib/send-quote-actions')

    mockResolveOrgContext.mockRejectedValueOnce(new Error('auth failed'))
    expect(await mod.submitForReviewAction('q-1')).toEqual({ ok: false, error: 'auth failed' })

    mockResolveOrgContext.mockRejectedValueOnce('no ctx')
    expect(
      await mod.sendQuoteToClientAction({
        quoteId: '11111111-1111-4111-8111-111111111111',
        expiresInDays: 7,
      }),
    ).toEqual({ ok: false, error: 'Failed to send quote' })

    expect(await mod.getQuoteShareLinksAction('q-1')).toEqual({
      ok: true,
      data: { links: [{ id: 'lnk-1' }] },
    })
  })
})
