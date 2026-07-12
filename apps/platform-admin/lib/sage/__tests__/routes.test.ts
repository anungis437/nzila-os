import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  InMemorySageAuditSink,
  InMemorySageRepository,
  SAGE_AUDIT_ACTIONS,
} from '@nzila/sage-core'

const h = vi.hoisted(() => ({
  repo: null as unknown as InMemorySageRepository,
  audit: null as unknown as InMemorySageAuditSink,
  userId: 'u-admin' as string | null,
}))

// Auth is mocked at the session boundary. The org role resolves to 'admin' via
// the PLATFORM_ADMIN_USER_IDS override (no DB), so the REAL org-scope guard and
// SAGE service run without a live database.
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: async () => (h.userId ? { userId: h.userId } : null),
}))
vi.mock('../runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime')>()
  return { ...actual, createSageRuntime: () => ({ repo: h.repo, audit: h.audit }) }
})
// Membership lookup for non-platform-admin actors resolves to "no membership"
// (empty), so a forged x-org-id (actor not a member of that org) is rejected.
vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] as unknown[] }) }),
    }),
  },
}))

const { GET, POST } = await import('../../../app/api/sage/workspaces/route')
const detailRoute = await import('../../../app/api/sage/workspaces/[workspaceId]/route')

const ORG = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  h.repo = new InMemorySageRepository()
  h.audit = new InMemorySageAuditSink()
  h.userId = 'u-admin'
  process.env.PLATFORM_ADMIN_USER_IDS = 'u-admin'
})

function req(method: string, body?: unknown, orgId: string = ORG): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-org-id': orgId,
  }
  // Unique key per request so the shared global idempotency cache does not
  // replay across independent tests.
  if (method === 'POST') headers['Idempotency-Key'] = crypto.randomUUID()
  return new NextRequest('http://localhost/api/sage/workspaces', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('GET/POST /api/sage/workspaces', () => {
  it('rejects unauthenticated requests with 401', async () => {
    h.userId = null
    const res = await GET(req('GET'))
    expect(res.status).toBe(401)
  })

  it('lists workspaces for an authenticated org-scoped actor', async () => {
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok: boolean; data: { workspaces: unknown[] } }
    expect(json.ok).toBe(true)
    expect(json.data.workspaces).toEqual([])
  })

  it('creates a workspace and emits a workspace-created audit event', async () => {
    const res = await POST(
      req('POST', {
        name: 'Assurance WS',
        institutionType: 'regulator',
        riskSurface: 'regulatory_boundary',
      }),
    )
    expect(res.status).toBe(201)
    const json = (await res.json()) as { ok: boolean; data: { id: string } }
    expect(json.ok).toBe(true)
    expect(json.data.id).toBeTruthy()
    expect(h.audit.has(SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED)).toBe(true)
  })

  it('rejects a body that smuggles orgId (strict validation)', async () => {
    const res = await POST(
      req('POST', {
        name: 'Assurance WS',
        institutionType: 'regulator',
        riskSurface: 'regulatory_boundary',
        orgId: 'attacker-controlled',
      }),
    )
    expect(res.status).toBe(400)
    // orgId never reaches the repository.
    expect((await h.repo.listWorkspaces(ORG)).length).toBe(0)
  })

  it('rejects a POST without an Idempotency-Key header', async () => {
    const request = new NextRequest('http://localhost/api/sage/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-org-id': ORG },
      body: JSON.stringify({
        name: 'WS',
        institutionType: 'regulator',
        riskSurface: 'regulatory_boundary',
      }),
    })
    const res = await POST(request)
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  it('rejects a body that smuggles a boundaryProfile (strict validation)', async () => {
    const res = await POST(
      req('POST', {
        name: 'Assurance WS',
        institutionType: 'regulator',
        riskSurface: 'regulatory_boundary',
        boundaryProfile: { prohibitedUses: [] },
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('organization-header trust', () => {
  const OTHER_ORG = '00000000-0000-0000-0000-0000000000ff'

  it('rejects a forged x-org-id the actor is not a member of (403)', async () => {
    // Not a platform admin → membership is checked against the DB (mocked empty).
    h.userId = 'stranger'
    process.env.PLATFORM_ADMIN_USER_IDS = ''
    const res = await GET(req('GET', undefined, OTHER_ORG))
    expect(res.status).toBe(403)
  })

  it('allows an authorized actor to select an alternate org', async () => {
    // Platform admin may operate against any org (explicit override).
    h.userId = 'u-admin'
    process.env.PLATFORM_ADMIN_USER_IDS = 'u-admin'
    const res = await GET(req('GET', undefined, OTHER_ORG))
    expect(res.status).toBe(200)
  })

  it('rejects a request with no org selector (400)', async () => {
    const request = new NextRequest('http://localhost/api/sage/workspaces', {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
    })
    const res = await GET(request)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/sage/workspaces/[workspaceId]', () => {
  it('returns 404 for a missing/cross-org workspace (non-disclosure)', async () => {
    const request = new NextRequest('http://localhost/api/sage/workspaces/missing', {
      method: 'GET',
      headers: { 'x-org-id': ORG },
    })
    const res = await detailRoute.GET(request, {
      params: Promise.resolve({ workspaceId: 'ws-does-not-exist' }),
    })
    expect(res.status).toBe(404)
  })
})
