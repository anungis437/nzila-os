/**
 * HTTP-layer proofs for SAGE institutional resource.commit.
 *
 * Exercises the Next route handler (auth headers, Idempotency-Key, schema
 * refusal of browser verification labels, org scoping). Service outcomes are
 * injected so this is LOCAL_TESTED HTTP/runtime route proof — not staging.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { InMemorySageAuditSink, InMemorySageRepository } from '@nzila/sage-core'

const h = vi.hoisted(() => ({
  repo: null as unknown as InMemorySageRepository,
  audit: null as unknown as InMemorySageAuditSink,
  userId: 'u-admin' as string | null,
  commit: vi.fn(),
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
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] as unknown[] }) }),
    }),
  },
}))
vi.mock('../institutional-service', () => ({
  commitSageResourceUnderMandateForScope: (...args: unknown[]) => h.commit(...args),
}))

const workspacesRoute = await import('../../../app/api/sage/workspaces/route')
const commitRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/institutional-actions/resource-commit/route'
)

const ORG = '00000000-0000-0000-0000-0000000000a1'
const OTHER = '00000000-0000-0000-0000-0000000000b2'

beforeEach(() => {
  h.repo = new InMemorySageRepository()
  h.audit = new InMemorySageAuditSink()
  h.userId = 'u-admin'
  h.commit.mockReset()
  process.env.PLATFORM_ADMIN_USER_IDS = 'u-admin'
})

function req(
  url: string,
  method: string,
  body?: unknown,
  opts: { orgId?: string; key?: string | null } = {},
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-org-id': opts.orgId ?? ORG,
  }
  if (method === 'POST' && opts.key !== null) {
    headers['Idempotency-Key'] = opts.key ?? crypto.randomUUID()
  }
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function createWorkspace(): Promise<string> {
  const res = await workspacesRoute.POST(
    req('/api/sage/workspaces', 'POST', {
      name: 'Alder Civic Services (fictional HTTP)',
      institutionType: 'other_public_institution',
      riskSurface: 'general_governance',
    }),
  )
  expect(res.status).toBe(201)
  const id = (await res.json()).data.id as string
  await h.repo.assignRole({
    workspaceId: id,
    orgId: ORG,
    actorId: 'u-admin',
    sageApplicationRole: 'decision_record_approver',
    workspaceScope: id,
    accessReason: 'test',
    approvedBy: 'u-admin',
    createdAt: '2026-07-12T00:00:00.000Z',
    revokedAt: null,
  })
  return id
}

describe('HTTP — institutional resource.commit (LOCAL_TESTED)', () => {
  it('requires Idempotency-Key before any institutional mutation', async () => {
    const ws = await createWorkspace()
    const res = await commitRoute.POST(
      req(
        `/api/sage/workspaces/${ws}/institutional-actions/resource-commit`,
        'POST',
        { mandateId: 'm1', resourceId: 'procurement.alder.workflow-redesign', requestedCommitMinor: 100 },
        { key: null },
      ),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
    expect(h.commit).not.toHaveBeenCalled()
  })

  it('rejects browser-supplied verification / currency / conflict labels', async () => {
    const ws = await createWorkspace()
    const res = await commitRoute.POST(
      req(`/api/sage/workspaces/${ws}/institutional-actions/resource-commit`, 'POST', {
        mandateId: 'm1',
        resourceId: 'procurement.alder.workflow-redesign',
        requestedCommitMinor: 100,
        verificationStatus: 'verified',
        currency: 'CAD',
        conflictOrRecusal: false,
        instrumentAuthority: 'board',
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(400)
    expect(h.commit).not.toHaveBeenCalled()
  })

  it('admits an authorized commit through the HTTP route', async () => {
    const ws = await createWorkspace()
    h.commit.mockResolvedValue({
      replayed: false,
      response: {
        actionId: 'act-1',
        commitmentId: 'cmt-1',
        totalCommittedMinorAfterAction: 1_000_000,
        instrumentRef: 'FICT-ALDER-MANDATE-2026',
        instrumentVersion: '2',
        reusedExisting: false,
        authorizationStatus: 'NEWLY_ADMITTED',
      },
    })
    const res = await commitRoute.POST(
      req(`/api/sage/workspaces/${ws}/institutional-actions/resource-commit`, 'POST', {
        mandateId: '22222222-2222-4222-8222-222222222202',
        resourceId: 'procurement.alder.workflow-redesign',
        requestedCommitMinor: 1_000_000,
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data.authorizationStatus).toBe('NEWLY_ADMITTED')
    expect(h.commit).toHaveBeenCalledOnce()
  })

  it('surfaces institutional refusal from the service as a governed HTTP error', async () => {
    const ws = await createWorkspace()
    const { SageServiceError } = await import('@nzila/sage-core')
    h.commit.mockRejectedValue(new SageServiceError('FORBIDDEN', 'CONFLICT_OR_RECUSAL'))
    const res = await commitRoute.POST(
      req(`/api/sage/workspaces/${ws}/institutional-actions/resource-commit`, 'POST', {
        mandateId: '22222222-2222-4222-8222-222222222202',
        resourceId: 'procurement.alder.workflow-redesign',
        requestedCommitMinor: 1_000_000,
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(h.commit).toHaveBeenCalledOnce()
  })

  it('refuses unauthenticated callers before service invocation', async () => {
    const ws = await createWorkspace()
    h.userId = null
    const res = await commitRoute.POST(
      req(`/api/sage/workspaces/${ws}/institutional-actions/resource-commit`, 'POST', {
        mandateId: 'm1',
        resourceId: 'procurement.alder.workflow-redesign',
        requestedCommitMinor: 100,
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBeGreaterThanOrEqual(401)
    expect(h.commit).not.toHaveBeenCalled()
  })

  it('does not leak cross-tenant workspace existence on forged org header alone', async () => {
    const ws = await createWorkspace()
    h.commit.mockRejectedValue(new Error('workspace not found'))
    const res = await commitRoute.POST(
      req(
        `/api/sage/workspaces/${ws}/institutional-actions/resource-commit`,
        'POST',
        {
          mandateId: 'm1',
          resourceId: 'procurement.alder.workflow-redesign',
          requestedCommitMinor: 100,
        },
        { orgId: OTHER },
      ),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    // Org guard or service miss — never a successful admit for the wrong tenant.
    expect(res.status).not.toBe(201)
    if (res.status === 201) throw new Error('cross-tenant admit must not succeed')
  })
})
