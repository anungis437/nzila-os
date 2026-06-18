import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAuthenticateUser,
  mockWithRequestContext,
  mockWithSpan,
  mockQuoteFindById,
  mockQuoteUpdate,
  mockResolveOrgContext,
  mockExecuteCommand,
  mockAuditQuoteTransition,
  mockLogTransition,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockAuthenticateUser: vi.fn(),
  mockWithRequestContext: vi.fn(async (_req: Request, fn: () => Promise<unknown>) => fn()),
  mockWithSpan: vi.fn(async (_name: string, _attrs: Record<string, unknown>, fn: () => Promise<unknown>) => fn()),
  mockQuoteFindById: vi.fn(),
  mockQuoteUpdate: vi.fn(),
  mockResolveOrgContext: vi.fn(),
  mockExecuteCommand: vi.fn(),
  mockAuditQuoteTransition: vi.fn(),
  mockLogTransition: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

vi.mock('@/lib/api-guards', () => ({
  authenticateUser: mockAuthenticateUser,
  withRequestContext: mockWithRequestContext,
}))

vi.mock('@nzila/os-core/telemetry', () => ({
  withSpan: mockWithSpan,
}))

vi.mock('@/lib/db', () => ({
  quoteRepo: {
    findById: mockQuoteFindById,
    update: mockQuoteUpdate,
  },
}))

vi.mock('@/lib/evidence', () => ({
  auditQuoteTransition: mockAuditQuoteTransition,
}))

vi.mock('@/lib/commerce-telemetry', () => ({
  logTransition: mockLogTransition,
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: mockLoggerWarn },
}))

vi.mock('@/lib/resolve-org', () => ({
  resolveOrgContext: mockResolveOrgContext,
}))

vi.mock('@/lib/control/control-adapter', () => ({
  executeCommand: mockExecuteCommand,
}))

const params = { params: Promise.resolve({ id: 'q-1' }) }

describe('api quotes [id] route slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuthenticateUser.mockResolvedValue({ ok: true, userId: 'user-1' })
    mockResolveOrgContext.mockResolvedValue({ orgId: 'org-1' })
  })

  it('covers GET branches: unauthenticated, missing, org mismatch, success, and catch', async () => {
    const { GET } = await import('@/app/api/quotes/[id]/route')

    mockAuthenticateUser.mockResolvedValueOnce({ ok: false, response: new Response('forbidden', { status: 403 }) })
    const unauth = await GET(new Request('http://localhost/api/quotes/q-1'), params)
    expect(unauth.status).toBe(403)

    mockQuoteFindById.mockResolvedValueOnce(null)
    const missing = await GET(new Request('http://localhost/api/quotes/q-1'), params)
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toMatchObject({ ok: false, error: 'Quote not found' })

    mockQuoteFindById.mockResolvedValueOnce({ id: 'q-1', orgId: 'org-2' })
    const orgMismatch = await GET(new Request('http://localhost/api/quotes/q-1'), params)
    expect(orgMismatch.status).toBe(404)

    mockQuoteFindById.mockResolvedValueOnce({ id: 'q-1', orgId: 'org-1', status: 'draft' })
    const ok = await GET(new Request('http://localhost/api/quotes/q-1'), params)
    expect(ok.status).toBe(200)
    await expect(ok.json()).resolves.toMatchObject({ ok: true, data: { id: 'q-1' } })

    mockQuoteFindById.mockRejectedValueOnce(new Error('read failed'))
    const crashed = await GET(new Request('http://localhost/api/quotes/q-1'), params)
    expect(crashed.status).toBe(500)
    await expect(crashed.json()).resolves.toMatchObject({ ok: false, error: 'read failed' })

    mockQuoteFindById.mockRejectedValueOnce('boom')
    const unknownErr = await GET(new Request('http://localhost/api/quotes/q-1'), params)
    expect(unknownErr.status).toBe(500)
    await expect(unknownErr.json()).resolves.toMatchObject({ ok: false, error: 'Unknown error' })
  })

  it('covers PATCH non-status update and status transition validation branches', async () => {
    const { PATCH } = await import('@/app/api/quotes/[id]/route')

    mockQuoteUpdate.mockResolvedValueOnce({ id: 'q-1', title: 'updated' })
    const nonStatus = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'updated' }),
      }),
      params,
    )
    expect(nonStatus.status).toBe(200)
    await expect(nonStatus.json()).resolves.toMatchObject({ ok: true, data: { id: 'q-1', title: 'updated' } })

    mockQuoteFindById.mockResolvedValueOnce(null)
    const notFound = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'SENT_TO_CLIENT' }),
      }),
      params,
    )
    expect(notFound.status).toBe(404)

    mockQuoteFindById.mockResolvedValueOnce({ id: 'q-1', status: 'draft' })
    const directMutation = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      }),
      params,
    )
    expect(directMutation.status).toBe(400)
    await expect(directMutation.json()).resolves.toMatchObject({ ok: false, error: expect.stringContaining('Direct status mutation') })

    mockQuoteFindById.mockResolvedValueOnce({ id: 'q-1', status: 'sent' })
    const missingMessage = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'REVISION_REQUESTED', requestMessage: '   ' }),
      }),
      params,
    )
    expect(missingMessage.status).toBe(400)

    mockQuoteFindById.mockResolvedValueOnce({ id: 'q-1', status: 'sent' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: false, error: 'blocked by policy' })
    const commandFail = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'SENT_TO_CLIENT' }),
      }),
      params,
    )
    expect(commandFail.status).toBe(422)
    await expect(commandFail.json()).resolves.toMatchObject({ ok: false, error: 'blocked by policy' })

    mockQuoteFindById.mockResolvedValueOnce({ id: 'q-1', status: 'sent' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: false })
    const commandFailNoError = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'SENT_TO_CLIENT' }),
      }),
      params,
    )
    expect(commandFailNoError.status).toBe(422)
    await expect(commandFailNoError.json()).resolves.toMatchObject({
      ok: false,
      error: 'Failed to process quote status transition',
    })

    mockQuoteFindById
      .mockResolvedValueOnce({ id: 'q-1', status: 'draft' })
      .mockResolvedValueOnce({ id: 'q-1', status: 'internal_review' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: true })
    const internalReview = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'INTERNAL_REVIEW' }),
      }),
      params,
    )
    expect(internalReview.status).toBe(200)
    expect(mockExecuteCommand).toHaveBeenCalledWith({
      type: 'submit_for_review',
      quote_id: 'q-1',
      actor_id: 'user-1',
    })

    mockQuoteFindById
      .mockResolvedValueOnce({ id: 'q-1', status: 'sent_to_client' })
      .mockResolvedValueOnce({ id: 'q-1', status: 'revision_requested' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: true })
    const revision = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'REVISION_REQUESTED', requestMessage: 'Please update totals' }),
      }),
      params,
    )
    expect(revision.status).toBe(200)
    expect(mockExecuteCommand).toHaveBeenCalledWith({
      type: 'request_quote_revision',
      quote_id: 'q-1',
      actor_id: 'user-1',
      request_message: 'Please update totals',
    })
  })

  it('covers PATCH successful transitions, audit warning path, and catch branch', async () => {
    const { PATCH } = await import('@/app/api/quotes/[id]/route')

    mockQuoteFindById
      .mockResolvedValueOnce({ id: 'q-1', status: 'draft' })
      .mockResolvedValueOnce({ id: 'q-1', status: 'sent_to_client' })

    mockExecuteCommand.mockResolvedValueOnce({ ok: true })

    const sent = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'SENT_TO_CLIENT' }),
      }),
      params,
    )

    expect(sent.status).toBe(200)
    await expect(sent.json()).resolves.toMatchObject({ ok: true, data: { id: 'q-1', status: 'sent_to_client' } })
    expect(mockExecuteCommand).toHaveBeenCalledWith({ type: 'send_quote', quote_id: 'q-1', actor_id: 'user-1' })
    expect(mockAuditQuoteTransition).toHaveBeenCalled()
    expect(mockLogTransition).toHaveBeenCalledWith({ orgId: 'org-1' }, 'quote', 'draft', 'SENT_TO_CLIENT', true)

    mockQuoteFindById
      .mockResolvedValueOnce({ id: 'q-1', status: 'sent_to_client' })
      .mockResolvedValueOnce({ id: 'q-1', status: 'accepted' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: true })
    mockAuditQuoteTransition.mockImplementationOnce(() => {
      throw new Error('audit down')
    })

    const accepted = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'ACCEPTED',
          customerName: 'Ada',
          customerEmail: 'ada@example.com',
          message: 'LGTM',
        }),
      }),
      params,
    )

    expect(accepted.status).toBe(200)
    expect(mockExecuteCommand).toHaveBeenCalledWith({
      type: 'accept_quote',
      quote_id: 'q-1',
      actor_id: 'user-1',
      customer_name: 'Ada',
      customer_email: 'ada@example.com',
      message: 'LGTM',
    })
    expect(mockLoggerWarn).toHaveBeenCalled()

    const invalidJson = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      params,
    )
    expect(invalidJson.status).toBe(500)
    await expect(invalidJson.json()).resolves.toMatchObject({ ok: false, error: expect.any(String) })

    mockQuoteFindById
      .mockResolvedValueOnce({ id: 'q-1', status: 'sent_to_client' })
      .mockResolvedValueOnce({ id: 'q-1', status: 'accepted' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: true })
    const acceptedWithNonStringFields = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'ACCEPTED',
          customerName: 123,
          customerEmail: false,
          message: null,
        }),
      }),
      params,
    )
    expect(acceptedWithNonStringFields.status).toBe(200)
    expect(mockExecuteCommand).toHaveBeenCalledWith({
      type: 'accept_quote',
      quote_id: 'q-1',
      actor_id: 'user-1',
      customer_name: undefined,
      customer_email: undefined,
      message: undefined,
    })

    mockAuditQuoteTransition.mockImplementationOnce(() => {
      throw 'non-error'
    })
    mockQuoteFindById
      .mockResolvedValueOnce({ id: 'q-1', status: 'sent_to_client' })
      .mockResolvedValueOnce({ id: 'q-1', status: 'accepted' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: true })
    const nonErrorAudit = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'SENT_TO_CLIENT' }),
      }),
      params,
    )
    expect(nonErrorAudit.status).toBe(200)
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Audit/telemetry failed for quote transition',
      expect.objectContaining({ error: 'non-error' }),
    )

    mockQuoteUpdate.mockImplementationOnce(() => {
      throw 'non-error-patch'
    })
    const nonErrorCatch = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'will-throw' }),
      }),
      params,
    )
    expect(nonErrorCatch.status).toBe(500)
    await expect(nonErrorCatch.json()).resolves.toMatchObject({ ok: false, error: 'Unknown error' })
  })

  it('returns auth response for PATCH when unauthenticated', async () => {
    mockAuthenticateUser.mockResolvedValueOnce({ ok: false, response: new Response('forbidden', { status: 403 }) })
    const { PATCH } = await import('@/app/api/quotes/[id]/route')

    const response = await PATCH(
      new Request('http://localhost/api/quotes/q-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'x' }),
      }),
      params,
    )

    expect(response.status).toBe(403)
  })
})
