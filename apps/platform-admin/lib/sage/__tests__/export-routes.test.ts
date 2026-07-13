import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  InMemorySageAuditSink,
  InMemorySageRepository,
} from '@nzila/sage-core'

const h = vi.hoisted(() => ({
  repo: null as unknown as InMemorySageRepository,
  audit: null as unknown as InMemorySageAuditSink,
  userId: 'u-admin' as string | null,
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: async () => (h.userId ? { userId: h.userId } : null),
}))
vi.mock('../runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime')>()
  return { ...actual, createSageRuntime: () => ({ repo: h.repo, audit: h.audit }) }
})
vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] as unknown[] }) }) }),
  },
}))

const workspacesRoute = await import('../../../app/api/sage/workspaces/route')
const requestsRoute = await import('../../../app/api/sage/workspaces/[workspaceId]/export-requests/route')
const approveRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/export-requests/[requestId]/approve/route'
)
const denyRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/export-requests/[requestId]/deny/route'
)
const generateRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/export-requests/[requestId]/generate/route'
)
const packagesRoute = await import('../../../app/api/sage/workspaces/[workspaceId]/export-packages/route')
const downloadRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/export-packages/[packageId]/download/route'
)

const ORG = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  h.repo = new InMemorySageRepository()
  h.audit = new InMemorySageAuditSink()
  h.userId = 'u-admin'
  // Both u-admin and u-approver clear the ORG guard; SAGE export authority is
  // still enforced separately (u-approver holds export_approver; u-admin does not).
  process.env.PLATFORM_ADMIN_USER_IDS = 'u-admin,u-approver'
})

function req(url: string, method: string, body?: unknown, opts: { key?: string | null } = {}): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-org-id': ORG }
  if (method === 'POST' && opts.key !== null) headers['Idempotency-Key'] = opts.key ?? crypto.randomUUID()
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function seed(): Promise<{ ws: string; itemId: string }> {
  const res = await workspacesRoute.POST(
    req('/api/sage/workspaces', 'POST', {
      name: 'Example Service Review Office',
      institutionType: 'crown_corporation',
      riskSurface: 'general_governance',
    }),
  )
  const ws = (await res.json()).data.id as string
  // Requester (u-admin) is bootstrapped workspace_owner (EXPORT_REQUEST + member).
  // Add an independent approver with the export_approver role.
  await h.repo.addWorkspaceMember({ workspaceId: ws, orgId: ORG, actorId: 'u-approver', createdBy: 'u-admin', createdAt: 't' })
  await h.repo.assignRole({
    workspaceId: ws,
    orgId: ORG,
    actorId: 'u-approver',
    sageApplicationRole: 'export_approver',
    workspaceScope: ws,
    accessReason: 'x',
    approvedBy: 'u-admin',
    createdAt: 't',
    revokedAt: null,
  })
  // Seed an accessible (internal) evidence item.
  const src = await h.repo.createEvidenceSource({
    workspaceId: ws,
    orgId: ORG,
    sourceType: 'public',
    sourceQuality: 'high',
    authorizationLevel: 'internal',
    containsPersonalInformation: false,
    containsSensitiveInformation: false,
    classified: true,
    createdBy: 'u-admin',
    createdAt: 't',
  })
  const item = await h.repo.createEvidenceItem({
    sourceId: src.id,
    workspaceId: ws,
    orgId: ORG,
    lifecycleState: 'accepted',
    confidenceLevel: 'moderate',
    excludedFromExternalReview: false,
    humanReviewRequired: true,
    createdBy: 'u-admin',
    updatedBy: null,
    createdAt: 't',
    updatedAt: 't',
  })
  return { ws, itemId: item.id }
}

async function createRequest(ws: string, itemId: string): Promise<string> {
  h.userId = 'u-admin'
  const res = await requestsRoute.POST(
    req(`/api/sage/workspaces/${ws}/export-requests`, 'POST', { purpose: 'internal review', evidenceItemIds: [itemId] }),
    { params: Promise.resolve({ workspaceId: ws }) },
  )
  expect(res.status).toBe(201)
  return (await res.json()).data.id as string
}

describe('SAGE export routes — request → approve → generate → download', () => {
  it('creates a request, then a different approver approves and generates a package', async () => {
    const { ws, itemId } = await seed()
    const requestId = await createRequest(ws, itemId)

    // Approve as the independent approver.
    h.userId = 'u-approver'
    const approveRes = await approveRoute.POST(
      req(`/api/sage/workspaces/${ws}/export-requests/${requestId}/approve`, 'POST', { rationale: 'looks correct' }),
      { params: Promise.resolve({ workspaceId: ws, requestId }) },
    )
    expect(approveRes.status).toBe(200)

    // Generate the package.
    const genRes = await generateRoute.POST(
      req(`/api/sage/workspaces/${ws}/export-requests/${requestId}/generate`, 'POST', {}),
      { params: Promise.resolve({ workspaceId: ws, requestId }) },
    )
    expect(genRes.status).toBe(201)
    const pkg = (await genRes.json()).data
    expect(pkg.contentHash).toBeTruthy()

    // Concurrent/replayed generation returns the same package (one storage object).
    const genRes2 = await generateRoute.POST(
      req(`/api/sage/workspaces/${ws}/export-requests/${requestId}/generate`, 'POST', {}),
      { params: Promise.resolve({ workspaceId: ws, requestId }) },
    )
    const pkg2 = (await genRes2.json()).data
    expect(pkg2.id).toBe(pkg.id)

    // Download streams bytes with an attachment disposition — no public URL.
    const dl = await downloadRoute.GET(
      req(`/api/sage/workspaces/${ws}/export-packages/${pkg.id}/download`, 'GET'),
      { params: Promise.resolve({ workspaceId: ws, packageId: pkg.id }) },
    )
    expect(dl.status).toBe(200)
    expect(dl.headers.get('Content-Disposition')).toContain('attachment')
    expect(dl.headers.get('Cache-Control')).toContain('no-store')
  })

  it('returns a non-success integrity response (500) when stored bytes are tampered', async () => {
    const { ws, itemId } = await seed()
    const requestId = await createRequest(ws, itemId)
    h.userId = 'u-approver'
    await approveRoute.POST(
      req(`/api/sage/workspaces/${ws}/export-requests/${requestId}/approve`, 'POST', { rationale: 'ok' }),
      { params: Promise.resolve({ workspaceId: ws, requestId }) },
    )
    const genRes = await generateRoute.POST(
      req(`/api/sage/workspaces/${ws}/export-requests/${requestId}/generate`, 'POST', {}),
      { params: Promise.resolve({ workspaceId: ws, requestId }) },
    )
    const pkg = (await genRes.json()).data
    // Tamper the stored object bytes → the download must fail integrity (500),
    // stream no bytes, and never disclose storage details.
    const original = h.repo.getExportPackageObject.bind(h.repo)
    h.repo.getExportPackageObject = async (ref: string) => {
      const o = await original(ref)
      return o ? { ...o, bytes: new TextEncoder().encode('tampered') } : o
    }
    const dl = await downloadRoute.GET(
      req(`/api/sage/workspaces/${ws}/export-packages/${pkg.id}/download`, 'GET'),
      { params: Promise.resolve({ workspaceId: ws, packageId: pkg.id }) },
    )
    expect(dl.status).toBe(500)
    expect(dl.headers.get('Content-Disposition')).toBeNull()
  })

  it('blocks a requester from approving their own request', async () => {
    const { ws, itemId } = await seed()
    const requestId = await createRequest(ws, itemId)
    // u-admin (requester) attempts to approve — self-approval is blocked.
    h.userId = 'u-admin'
    const res = await approveRoute.POST(
      req(`/api/sage/workspaces/${ws}/export-requests/${requestId}/approve`, 'POST', { rationale: 'x' }),
      { params: Promise.resolve({ workspaceId: ws, requestId }) },
    )
    // Requester lacks export_approver → 403.
    expect(res.status).toBe(403)
  })

  it('denial is terminal — a second decision conflicts', async () => {
    const { ws, itemId } = await seed()
    const requestId = await createRequest(ws, itemId)
    h.userId = 'u-approver'
    const deny = await denyRoute.POST(
      req(`/api/sage/workspaces/${ws}/export-requests/${requestId}/deny`, 'POST', { rationale: 'out of scope' }),
      { params: Promise.resolve({ workspaceId: ws, requestId }) },
    )
    expect(deny.status).toBe(200)
    const approveAfter = await approveRoute.POST(
      req(`/api/sage/workspaces/${ws}/export-requests/${requestId}/approve`, 'POST', { rationale: 'x' }),
      { params: Promise.resolve({ workspaceId: ws, requestId }) },
    )
    expect(approveAfter.status).toBe(409)
  })

  it('requires an Idempotency-Key on mutations', async () => {
    const { ws, itemId } = await seed()
    const res = await requestsRoute.POST(
      req(`/api/sage/workspaces/${ws}/export-requests`, 'POST', { purpose: 'x', evidenceItemIds: [itemId] }, { key: null }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(400)
  })

  it('does not disclose export packages across orgs (list)', async () => {
    const { ws } = await seed()
    // A different org header cannot see packages (non-disclosing 404).
    h.userId = 'u-other'
    const res = await packagesRoute.GET(
      new NextRequest(`http://localhost/api/sage/workspaces/${ws}/export-packages`, {
        method: 'GET',
        headers: { 'x-org-id': '00000000-0000-0000-0000-0000000000ff' },
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect([403, 404]).toContain(res.status)
  })
})
