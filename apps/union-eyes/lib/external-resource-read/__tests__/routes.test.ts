/** Route/middleware wiring only; actual SQL authorization and byte orchestration
 * have their own component suites. No authenticated HTTP-runtime claim. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ read: vi.fn(), legacy: vi.fn(), requireUser: vi.fn(), principal: vi.fn(), tenant: vi.fn(), auth: vi.fn() }))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: state.auth }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => true }))
vi.mock('@/lib/external-resource-read/reader', () => ({ readCanonicalExternalResource: state.read }))
vi.mock('@/lib/api-auth-guard', () => ({ requireUser: state.requireUser }))
vi.mock('@/lib/db/with-rls-context', () => ({ withPrincipalOnlyContext: state.principal, withRLSContext: state.tenant }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }))
vi.mock('@/lib/services/external-resource-authorization-service', () => ({ authorizeExternalMatterAccess: vi.fn(), authorizeExternalDocumentAccess: vi.fn(), holdsExternalAuthority: vi.fn() }))
vi.mock('@/lib/blob-client', () => ({ readBlobBounded: vi.fn(), BlobTooLargeError: class extends Error {} }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware'
import { GET as matter } from '@/app/api/external/grievances/[id]/route'
import { GET as documents } from '@/app/api/external/grievances/[id]/documents/route'
import { GET as document } from '@/app/api/external/documents/[id]/route'
import { GET as download } from '@/app/api/external/documents/[id]/download/route'

const org = '00000000-0000-4000-8000-000000000001', caseId = '00000000-0000-4000-8000-000000000002', doc = '00000000-0000-4000-8000-000000000003'
beforeEach(() => {
  vi.clearAllMocks()
  state.auth.mockResolvedValue({ userId: 'synthetic-representative' })
  state.read.mockImplementation(async () => new Response('Synthetic protected reader result', { status: 200 }))
})
describe('canonical external GET routes use the protected reader without target membership or legacy raw handlers', () => {
  it.each([
    ['matter', matter, caseId, `https://fixture.invalid/api/external/grievances/${caseId}?organizationId=${org}`],
    ['documents', documents, caseId, `https://fixture.invalid/api/external/grievances/${caseId}/documents?organizationId=${org}`],
    ['document', document, doc, `https://fixture.invalid/api/external/documents/${doc}?organizationId=${org}&matterId=${caseId}`],
    ['download', download, doc, `https://fixture.invalid/api/external/documents/${doc}/download?organizationId=${org}&matterId=${caseId}`],
  ] as const)('wires the existing %s endpoint to its fixed operation', async (operation, route, id, url) => {
    const response = await route(new Request(url), { params: Promise.resolve({ id }) })
    expect(response.status).toBe(200)
    expect(state.read).toHaveBeenCalledWith(operation, { organizationId: org, matterType: 'grievance', matterId: caseId,
      documentId: ['document', 'download'].includes(operation) ? doc : undefined })
    expect(state.requireUser).not.toHaveBeenCalled()
    expect(state.principal).not.toHaveBeenCalled()
    expect(state.tenant).not.toHaveBeenCalled()
  })

  it('answers an anonymous caller 401 before the protected reader or any database context', async () => {
    state.auth.mockResolvedValueOnce({ userId: null })
    const response = await matter(new Request(`https://fixture.invalid/api/external/grievances/${caseId}?organizationId=${org}`), { params: Promise.resolve({ id: caseId }) })
    expect(response.status).toBe(401)
    expect(state.read).not.toHaveBeenCalled(); expect(state.principal).not.toHaveBeenCalled(); expect(state.tenant).not.toHaveBeenCalled()
  })

  it('does not infer an external write from a read qualification', async () => {
    const route = withExternalMatterResourceAuth({ requiredPermission: 'upload_documents', resolve: () => ({ organizationId: org, matterType: 'grievance', matterId: caseId }) }, state.legacy)
    expect((await route(new Request('https://fixture.invalid/upload', { method: 'POST' }))).status).toBe(403)
    expect(state.read).not.toHaveBeenCalled(); expect(state.legacy).not.toHaveBeenCalled(); expect(state.tenant).not.toHaveBeenCalled()
  })

  it('does not let a POST reuse a fixed read operation', async () => {
    expect((await download(new Request(`https://fixture.invalid/download?organizationId=${org}&matterId=${caseId}`, { method: 'POST' }), { id: doc })).status).toBe(403)
    expect(state.read).not.toHaveBeenCalled()
  })

  it('returns the protected reader refusal for an unqualified subject without a legacy handler, target tenant or audit side effect', async () => {
    state.read.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
    expect((await matter(new Request(`https://fixture.invalid/case?organizationId=${org}`), { id: caseId })).status).toBe(403)
    expect(state.read).toHaveBeenCalledTimes(1)
    expect(state.requireUser).not.toHaveBeenCalled(); expect(state.principal).not.toHaveBeenCalled(); expect(state.tenant).not.toHaveBeenCalled()
  })
})
