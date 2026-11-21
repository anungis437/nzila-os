/**
 * Step 1 S1-A06 / C15: transcript revision (PUT /api/documents/[id]/transcript) and evidence publication
 * (POST /api/documents/[id]/transcript/publish) are refused to anyone the document authority does not grant, before any write.
 * A document the caller cannot read answers 404, indistinguishable from one that does not exist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  authed: true, loadContext: vi.fn(), decide: vi.fn(), save: vi.fn(), publish: vi.fn(), hasMinRole: vi.fn(),
}))
const ctxBound = { userId: 'actor-1', organizationId: 'org-1' }
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (req: Request, ctx: typeof ctxBound, params?: { id: string }) => Promise<Response>) =>
    async (req: Request, params: { id: string }) => m.authed ? handler(req, ctxBound, params)
      : new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401 }),
}))
vi.mock('@/lib/api/framework', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/framework')>()
  return { ...actual, withApi: (_config: unknown, handler: (c: Record<string, unknown>) => Promise<Response>) =>
    async (request: Request, route: { params: Promise<{ id: string }> }) => m.authed
      ? handler({ request, params: await route.params, ...ctxBound })
      : new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401 }) }
})
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: (_o: unknown, fn: (tx: unknown) => unknown) => fn({}) }))
vi.mock('@/lib/documents/ocr-authority', () => ({ loadDocumentAuthorityContext: m.loadContext }))
vi.mock('@/lib/documents/transcripts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/documents/transcripts')>()),
  decideTranscriptAccess: m.decide, saveHumanRevision: m.save, publishTranscriptAsEvidence: m.publish,
}))

const DOC = '0b7c5a3e-1f2d-4c3b-9a8e-0000000000a1'
const put = async (body: unknown, id = DOC) => {
  const { PUT } = await import('../documents/[id]/transcript/route')
  return (PUT as unknown as (r: Request, p: { id: string }) => Promise<Response>)(
    new Request(`http://localhost/api/documents/${id}/transcript`, { method: 'PUT', body: JSON.stringify(body) }), { id })
}
const publish = async (body: unknown, id = DOC) => {
  const { POST } = await import('../documents/[id]/transcript/publish/route')
  return (POST as unknown as (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>)(
    new Request(`http://localhost/api/documents/${id}/transcript/publish`, { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
}
const revision = { action: 'draft', expectedRevisionNo: 1, text: 'Synthetic transcript text.' }
const ctx = { documentId: DOC, privacyLabel: 'internal', linkedCaseId: 'case-1' }

describe('transcript revision and publication authority', () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.authed = true; m.hasMinRole.mockResolvedValue(true); m.loadContext.mockResolvedValue(ctx)
  })

  it('refuses an unauthenticated caller with 401 before loading the document', async () => {
    m.authed = false
    expect((await put(revision)).status).toBe(401)
    expect((await publish({ revisionNo: 2, purpose: 'Evidence for the case' })).status).toBe(401)
    expect(m.loadContext).not.toHaveBeenCalled()
  })
  it('answers 404 for a document the caller cannot read, for revision and publication alike', async () => {
    m.decide.mockReturnValue({ canRead: false, canWrite: false, canPublish: false })
    expect((await put(revision)).status).toBe(404)
    expect((await publish({ revisionNo: 2, purpose: 'Evidence for the case' })).status).toBe(404)
    m.loadContext.mockResolvedValue(null)
    expect((await put(revision)).status).toBe(404)
    expect(m.save).not.toHaveBeenCalled(); expect(m.publish).not.toHaveBeenCalled()
  })
  it('refuses a reader without the write right with 403 before any revision is saved', async () => {
    m.decide.mockReturnValue({ canRead: true, canWrite: false, canPublish: false })
    expect((await put(revision)).status).toBe(403)
    expect(m.save).not.toHaveBeenCalled()
  })
  it('refuses publication without the publish right, or without a linked case, with 403', async () => {
    m.decide.mockReturnValue({ canRead: true, canWrite: true, canPublish: false })
    expect((await publish({ revisionNo: 2, purpose: 'Evidence for the case' })).status).toBe(403)
    m.decide.mockReturnValue({ canRead: true, canWrite: true, canPublish: true })
    m.loadContext.mockResolvedValue({ ...ctx, linkedCaseId: null })
    expect((await publish({ revisionNo: 2, purpose: 'Evidence for the case' })).status).toBe(403)
    expect(m.publish).not.toHaveBeenCalled()
  })
  it('refuses an invalid document id with 400', async () => {
    expect((await put(revision, 'not-a-document')).status).toBe(400)
    expect((await publish({ revisionNo: 2, purpose: 'Evidence for the case' }, 'not-a-document')).status).toBe(400)
    expect(m.loadContext).not.toHaveBeenCalled()
  })
})
