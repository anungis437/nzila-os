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
const flagsRoute = await import('../../../app/api/sage/workspaces/[workspaceId]/boundary-flags/route')
const resolveRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/boundary-flags/[flagId]/resolve/route'
)
const notesRoute = await import('../../../app/api/sage/workspaces/[workspaceId]/review-notes/route')
const decisionsRoute = await import('../../../app/api/sage/workspaces/[workspaceId]/decisions/route')
const decisionDetailRoute = await import(
  '../../../app/api/sage/workspaces/[workspaceId]/decisions/[decisionId]/route'
)

const governanceService = await import('../governance-service')

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
  const id = (await res.json()).data.id as string
  // Grant the creator the governance roles the flows require.
  for (const role of ['security_reviewer', 'decision_record_approver', 'evidence_steward'] as const) {
    await h.repo.assignRole({
      workspaceId: id,
      orgId: ORG,
      actorId: 'u-admin',
      sageApplicationRole: role,
      workspaceScope: id,
      accessReason: 'test',
      approvedBy: 'u-admin',
      createdAt: '2026-07-12T00:00:00.000Z',
      revokedAt: null,
    })
  }
  return id
}

function flagsUrl(ws: string) {
  return `/api/sage/workspaces/${ws}/boundary-flags`
}
async function openFlag(ws: string, key?: string) {
  return flagsRoute.POST(
    req(flagsUrl(ws), 'POST', { flagType: 'sensitivity', targetType: 'workspace' }, { key }),
    { params: Promise.resolve({ workspaceId: ws }) },
  )
}
function auditCount(action: string) {
  return h.audit.records.filter((r) => r.action === action).length
}

describe('SAGE governance routes — boundary flags', () => {
  it('opens a flag, emits one audit event, and lists it', async () => {
    const ws = await createWorkspace()
    const res = await openFlag(ws)
    expect(res.status).toBe(201)
    expect((await res.json()).data.status).toBe('open')
    expect(auditCount(SAGE_AUDIT_ACTIONS.BOUNDARY_FLAGGED)).toBe(1)

    const list = await flagsRoute.GET(req(flagsUrl(ws), 'GET'), {
      params: Promise.resolve({ workspaceId: ws }),
    })
    expect((await list.json()).data.flags).toHaveLength(1)
  })

  it('requires an Idempotency-Key on create', async () => {
    const ws = await createWorkspace()
    const res = await flagsRoute.POST(
      req(flagsUrl(ws), 'POST', { flagType: 'sensitivity', targetType: 'workspace' }, { key: null }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  it('replays an identical create without a second flag or audit event', async () => {
    const ws = await createWorkspace()
    const key = crypto.randomUUID()
    expect((await openFlag(ws, key)).status).toBe(201)
    expect((await openFlag(ws, key)).status).toBe(200) // replayed
    const list = await flagsRoute.GET(req(flagsUrl(ws), 'GET'), {
      params: Promise.resolve({ workspaceId: ws }),
    })
    expect((await list.json()).data.flags).toHaveLength(1)
    expect(auditCount(SAGE_AUDIT_ACTIONS.BOUNDARY_FLAGGED)).toBe(1)
  })

  it('resolves a flag once; a concurrent resolver conflicts (one audit event)', async () => {
    const ws = await createWorkspace()
    const flag = (await (await openFlag(ws)).json()).data.id as string
    const resolveUrl = `/api/sage/workspaces/${ws}/boundary-flags/${flag}/resolve`
    const params = { params: Promise.resolve({ workspaceId: ws, flagId: flag }) }
    const results = await Promise.all([
      resolveRoute.POST(req(resolveUrl, 'POST', { resolution: 'resolved', resolutionNote: 'a' }), params),
      resolveRoute.POST(req(resolveUrl, 'POST', { resolution: 'retained', resolutionNote: 'b' }), params),
    ])
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409])
    expect(auditCount(SAGE_AUDIT_ACTIONS.BOUNDARY_RESOLVED)).toBe(1)
  })

  it('requires a resolution note (strict schema)', async () => {
    const ws = await createWorkspace()
    const flag = (await (await openFlag(ws)).json()).data.id as string
    const res = await resolveRoute.POST(
      req(`/api/sage/workspaces/${ws}/boundary-flags/${flag}/resolve`, 'POST', {
        resolution: 'resolved',
        resolutionNote: '',
      }),
      { params: Promise.resolve({ workspaceId: ws, flagId: flag }) },
    )
    expect(res.status).toBe(400)
  })
})

describe('SAGE governance routes — review notes + decisions', () => {
  it('derives the reviewer server-side and rejects a smuggled reviewerId', async () => {
    const ws = await createWorkspace()
    const res = await notesRoute.POST(
      req(`/api/sage/workspaces/${ws}/review-notes`, 'POST', {
        noteType: 'observation',
        targetType: 'workspace',
        note: 'human note',
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(201)
    expect((await res.json()).data.reviewerId).toBe('u-admin')
    expect(auditCount(SAGE_AUDIT_ACTIONS.REVIEW_NOTED)).toBe(1)

    // A browser-supplied reviewerId is rejected by strict validation.
    const forged = await notesRoute.POST(
      req(`/api/sage/workspaces/${ws}/review-notes`, 'POST', {
        noteType: 'observation',
        targetType: 'workspace',
        note: 'x',
        reviewerId: 'someone-else',
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(forged.status).toBe(400)
  })

  it('creates an immutable decision record with the authenticated named reviewer', async () => {
    const ws = await createWorkspace()
    const res = await decisionsRoute.POST(
      req(`/api/sage/workspaces/${ws}/decisions`, 'POST', {
        decision: 'proceed',
        rationale: 'human-authored',
        uncertainty: 'limited sample',
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(201)
    const decision = (await res.json()).data
    expect(decision.humanReviewerId).toBe('u-admin') // derived from the session
    expect(auditCount(SAGE_AUDIT_ACTIONS.DECISION_RECORDED)).toBe(1)

    // The decision is readable tenant-scoped; there is no edit route (immutable).
    const detail = await decisionDetailRoute.GET(
      req(`/api/sage/workspaces/${ws}/decisions/${decision.id}`, 'GET'),
      { params: Promise.resolve({ workspaceId: ws, decisionId: decision.id }) },
    )
    expect(detail.status).toBe(200)

    // A cross-workspace read is a non-disclosing 404.
    const bogus = '00000000-0000-0000-0000-0000000000ff'
    const denied = await decisionDetailRoute.GET(
      req(`/api/sage/workspaces/${bogus}/decisions/${decision.id}`, 'GET'),
      { params: Promise.resolve({ workspaceId: bogus, decisionId: decision.id }) },
    )
    expect(denied.status).toBe(404)
  })

  it('rejects a decision missing the uncertainty statement (strict schema)', async () => {
    const ws = await createWorkspace()
    const res = await decisionsRoute.POST(
      req(`/api/sage/workspaces/${ws}/decisions`, 'POST', { decision: 'proceed' }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(400)
  })
})

describe('SAGE governance routes — derivative-data authorization envelope', () => {
  it('surfaces the derived authorization envelope on a workspace decision', async () => {
    const ws = await createWorkspace()
    const res = await decisionsRoute.POST(
      req(`/api/sage/workspaces/${ws}/decisions`, 'POST', {
        decision: 'proceed',
        uncertainty: 'limited sample',
      }),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(res.status).toBe(201)
    const decision = (await res.json()).data
    // A workspace-level decision defaults to the internal floor and is in review.
    expect(decision.authorizationLevel).toBe('internal')
    expect(decision.authorizationBasis).toBe('workspace_default')
    expect(decision.excludedFromExternalReview).toBe(false)
  })

  it('lets an author RAISE a flag level but rejects a downgrade below the floor', async () => {
    const ws = await createWorkspace()
    const raised = await flagsRoute.POST(
      req(
        flagsUrl(ws),
        'POST',
        { flagType: 'sensitivity', targetType: 'workspace', requestedAuthorizationLevel: 'sensitive' },
        {},
      ),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(raised.status).toBe(201)
    const flag = (await raised.json()).data
    expect(flag.authorizationLevel).toBe('sensitive')
    expect(flag.authorizationBasis).toBe('reviewer_restricted')

    // Requesting a level below the internal floor is forbidden (no downgrade).
    const downgrade = await flagsRoute.POST(
      req(
        flagsUrl(ws),
        'POST',
        { flagType: 'sensitivity', targetType: 'workspace', requestedAuthorizationLevel: 'public' },
        {},
      ),
      { params: Promise.resolve({ workspaceId: ws }) },
    )
    expect(downgrade.status).toBe(403)
  })
})

describe('SAGE governance runtime composition — authenticated-human assurance', () => {
  // A trusted service-principal scope carries the SAME actorId + roles as the
  // human admin, so the ONLY reason these named-human ops fail is the derived
  // actorKind ('service'). This exercises route → runtime → service composition.
  function serviceScope() {
    return {
      actorId: 'u-admin',
      orgId: ORG,
      orgRole: 'admin',
      authenticationType: 'service_principal' as const,
    }
  }

  it('rejects a service principal from creating a decision record', async () => {
    const ws = await createWorkspace()
    await expect(
      governanceService.createSageDecisionRecordForScope(
        serviceScope(),
        ws,
        { decision: 'proceed', uncertainty: 'limited' },
        { idempotencyKey: crypto.randomUUID() },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a service principal from adding a review note', async () => {
    const ws = await createWorkspace()
    await expect(
      governanceService.createSageReviewNoteForScope(
        serviceScope(),
        ws,
        { note: 'x', noteType: 'observation', targetType: 'workspace' },
        { idempotencyKey: crypto.randomUUID() },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a service principal from resolving a boundary flag', async () => {
    const ws = await createWorkspace()
    const flag = (await (await openFlag(ws)).json()).data
    await expect(
      governanceService.resolveSageBoundaryFlagForScope(
        serviceScope(),
        ws,
        flag.id,
        { resolution: 'resolved', resolutionNote: 'x' },
        { idempotencyKey: crypto.randomUUID() },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a conflicting identity scope (service_principal + human) before any mutation', async () => {
    const ws = await createWorkspace()
    // A service-principal authentication claiming human actorKind is a
    // contradiction and must be rejected outright by the identity resolver.
    await expect(
      governanceService.createSageDecisionRecordForScope(
        { actorId: 'u-admin', orgId: ORG, orgRole: 'admin', authenticationType: 'service_principal', actorKind: 'human' },
        ws,
        { decision: 'proceed', uncertainty: 'limited' },
        { idempotencyKey: crypto.randomUUID() },
      ),
    ).rejects.toThrow(/conflicts with the authenticated identity/i)
  })
})
