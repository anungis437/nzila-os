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

// Auth mocked at the session boundary; org role resolves to 'admin' via the
// PLATFORM_ADMIN_USER_IDS override so the REAL org-scope guard + SAGE service run
// without a database. The runtime is redirected to the in-memory repo/audit.
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

const workspacesRoute = await import('../../../app/api/sage/workspaces/route')
const sourcesRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/evidence-sources/route'
)
const classifyRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/evidence-sources/[sourceId]/classify/route'
)
const itemsRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/evidence-items/route'
)
const linkRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/evidence-items/[itemId]/link/route'
)

const ORG = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  h.repo = new InMemorySageRepository()
  h.audit = new InMemorySageAuditSink()
  h.userId = 'u-admin'
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
      name: 'Example Service Review Office',
      institutionType: 'crown_corporation',
      riskSurface: 'general_governance',
    }),
  )
  const json = await res.json()
  const id = json.data.id as string
  // Grant the creator an evidence role so the evidence flow can be exercised.
  await h.repo.assignRole({
    workspaceId: id,
    orgId: ORG,
    actorId: 'u-admin',
    sageApplicationRole: 'evidence_steward',
    workspaceScope: id,
    accessReason: 'test',
    approvedBy: 'u-admin',
    createdAt: '2026-07-12T00:00:00.000Z',
    revokedAt: null,
  })
  return id
}

function sourcesUrl(ws: string) {
  return `/api/sage/workspaces/${ws}/evidence-sources`
}

async function registerSource(ws: string, key?: string) {
  const res = await sourcesRoute.POST(
    req(sourcesUrl(ws), 'POST', { sourceType: 'public' }, { key }),
    { params: Promise.resolve({ workspaceId: ws }) },
  )
  return res
}

describe('SAGE evidence routes', () => {
  it('registers a source, emits one audit event, and is org-scoped', async () => {
    const ws = await createWorkspace()
    const res = await registerSource(ws)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.classified).toBe(false)
    expect(
      h.audit.records.filter((r) => r.action === SAGE_AUDIT_ACTIONS.EVIDENCE_SOURCE_CREATED),
    ).toHaveLength(1)
  })

  it('requires an Idempotency-Key on create', async () => {
    const ws = await createWorkspace()
    const res = await sourcesRoute.POST(
      req(sourcesUrl(ws), 'POST', { sourceType: 'public' }, { key: null }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  it('replays an identical request without a second create or audit event', async () => {
    const ws = await createWorkspace()
    const key = crypto.randomUUID()
    const first = await registerSource(ws, key)
    expect(first.status).toBe(201)
    const second = await registerSource(ws, key)
    expect(second.status).toBe(200) // replayed
    const list = await sourcesRoute.GET(req(sourcesUrl(ws), 'GET'), {
      params: Promise.resolve({ workspaceId: ws }),
    })
    const listJson = await list.json()
    expect(listJson.data.sources).toHaveLength(1)
    expect(
      h.audit.records.filter((r) => r.action === SAGE_AUDIT_ACTIONS.EVIDENCE_SOURCE_CREATED),
    ).toHaveLength(1)
  })

  it('treats the same key with a different payload as a conflict', async () => {
    const ws = await createWorkspace()
    const key = crypto.randomUUID()
    await registerSource(ws, key)
    const conflict = await sourcesRoute.POST(
      req(sourcesUrl(ws), 'POST', { sourceType: 'administrative' }, { key }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(conflict.status).toBe(409)
  })

  it('rejects a server-derived field via strict validation', async () => {
    const ws = await createWorkspace()
    const res = await sourcesRoute.POST(
      req(sourcesUrl(ws), 'POST', { sourceType: 'public', authorizationLevel: 'sensitive' }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_FAILED')
  })

  it('enforces classify-before-item and links an item end to end', async () => {
    const ws = await createWorkspace()
    const srcRes = await registerSource(ws)
    const src = (await srcRes.json()).data.id as string

    // Item creation is blocked until the source is classified.
    const blocked = await itemsRoute.POST(
      req(`/api/sage/workspaces/${ws}/evidence-items`, 'POST', {
        sourceId: src,
        confidenceLevel: 'moderate',
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(blocked.status).toBe(422)

    const classified = await classifyRoute.POST(
      req(`/api/sage/workspaces/${ws}/evidence-sources/${src}/classify`, 'POST', {
        sourceQuality: 'moderate',
        authorizationLevel: 'internal',
      }),
      { params: Promise.resolve({ workspaceId: ws, sourceId: src }) },
    )
    expect(classified.status).toBe(200)
    expect((await classified.json()).data.classified).toBe(true)

    const itemRes = await itemsRoute.POST(
      req(`/api/sage/workspaces/${ws}/evidence-items`, 'POST', {
        sourceId: src,
        confidenceLevel: 'moderate',
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(itemRes.status).toBe(201)
    const itemId = (await itemRes.json()).data.id as string

    const linked = await linkRoute.POST(
      req(`/api/sage/workspaces/${ws}/evidence-items/${itemId}/link`, 'POST', {}),
      { params: Promise.resolve({ workspaceId: ws, itemId }) },
    )
    expect(linked.status).toBe(200)
    expect((await linked.json()).data.lifecycleState).toBe('linked')
  })

  it('does not disclose a non-existent / cross-org workspace (404)', async () => {
    await createWorkspace()
    const bogus = '00000000-0000-0000-0000-0000000000ff'
    const res = await sourcesRoute.GET(req(sourcesUrl(bogus), 'GET'), {
      params: Promise.resolve({ workspaceId: bogus }),
    })
    expect(res.status).toBe(404)
  })
})

describe('SAGE evidence routes — concurrent duplicate safety', () => {
  async function listSources(ws: string): Promise<Array<{ id: string }>> {
    const res = await sourcesRoute.GET(req(sourcesUrl(ws), 'GET'), {
      params: Promise.resolve({ workspaceId: ws }),
    })
    return (await res.json()).data.sources as Array<{ id: string }>
  }
  function postSource(ws: string, sourceType: string, key: string) {
    return sourcesRoute.POST(
      req(sourcesUrl(ws), 'POST', { sourceType }, { key }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
  }
  function sourceCreatedCount(): number {
    return h.audit.records.filter(
      (r) => r.action === SAGE_AUDIT_ACTIONS.EVIDENCE_SOURCE_CREATED,
    ).length
  }

  it('creates exactly one source and one audit event under concurrent identical requests', async () => {
    const ws = await createWorkspace()
    const key = crypto.randomUUID()
    // Two identical requests submitted together — they genuinely interleave; the
    // atomic acquisition elects a single writer.
    const [a, b] = await Promise.all([registerSource(ws, key), registerSource(ws, key)])

    expect([a.status, b.status].sort()).toEqual([200, 201]) // one created, one replayed
    expect(await listSources(ws)).toHaveLength(1) // no duplicate source
    expect(sourceCreatedCount()).toBe(1) // one audit event
    const idA = (await a.json()).data.id as string
    const idB = (await b.json()).data.id as string
    expect(idA).toBe(idB) // both callers resolve to the same source id
  })

  it('rejects a concurrent same-key request that carries a different payload (409)', async () => {
    const ws = await createWorkspace()
    const key = crypto.randomUUID()
    const results = await Promise.all([
      postSource(ws, 'public', key),
      postSource(ws, 'administrative', key),
    ])
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toContain(409) // the incompatible payload is a conflict
    expect(statuses.filter((s) => s === 200 || s === 201)).toHaveLength(1) // at most one accepted
    expect(await listSources(ws)).toHaveLength(1) // exactly one source persisted
    expect(sourceCreatedCount()).toBe(1) // one audit event
  })

  it('isolates the same idempotency key across different workspaces', async () => {
    const wsA = await createWorkspace()
    const wsB = await createWorkspace()
    const key = crypto.randomUUID()
    const [ra, rb] = await Promise.all([registerSource(wsA, key), registerSource(wsB, key)])

    expect([ra.status, rb.status]).toEqual([201, 201]) // independent scopes → both create
    expect(await listSources(wsA)).toHaveLength(1)
    expect(await listSources(wsB)).toHaveLength(1)
  })
})
