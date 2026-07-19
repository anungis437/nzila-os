import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  InMemorySageAuditSink,
  InMemorySageRepository,
  SAGE_AUDIT_ACTIONS,
} from '@nzila/sage-core'
import { InMemoryIdempotencyCache } from '@nzila/os-core/idempotency'

// Mock the composition boundary only: swap the SQL/audit runtime for in-memory
// implementations. The REAL SAGE service layer (permissions, org boundary,
// membership + role authorization, invariants, audit emission) still runs.
const h = vi.hoisted(() => ({
  repo: null as unknown as InMemorySageRepository,
  audit: null as unknown as InMemorySageAuditSink,
}))

vi.mock('../runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime')>()
  return { ...actual, createSageRuntime: () => ({ repo: h.repo, audit: h.audit }) }
})
// `org-scope-guard` (imported transitively by the runtime) pulls in next-auth;
// stub the session module so it doesn't load in the node test environment.
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => null }))

const {
  createSageWorkspaceForScope,
  getSageWorkspaceForScope,
  getSageWorkspaceSummaryForScope,
  listSageWorkspacesForScope,
} = await import('../workspace-service')

// org_admin     → WORKSPACE_CREATE + WORKSPACE_ADMIN (read-only oversight)
// org_secretary → WORKSPACE_CREATE only (no oversight)
// org_viewer    → no SAGE permissions (access only via SAGE membership + role)
const admin = (orgId = 'org-1') =>
  ({ actorId: 'admin-1', orgId, orgRole: 'org_admin', authenticationType: 'interactive_user' }) as const
const writer = (orgId = 'org-1') =>
  ({ actorId: 'sec-1', orgId, orgRole: 'org_secretary', authenticationType: 'interactive_user' }) as const
const viewer = (orgId = 'org-1') =>
  ({ actorId: 'viewer-1', orgId, orgRole: 'org_viewer', authenticationType: 'interactive_user' }) as const

const input = {
  name: 'Workspace A',
  institutionType: 'regulator' as const,
  riskSurface: 'regulatory_boundary' as const,
}

let cache: InMemoryIdempotencyCache

beforeEach(() => {
  h.repo = new InMemorySageRepository()
  h.audit = new InMemorySageAuditSink()
  cache = new InMemoryIdempotencyCache()
})

function idem(key = 'key-1') {
  return { idempotencyKey: key, cache }
}

describe('workspace-service — create', () => {
  it('derives the boundary profile server-side and emits a workspace-created audit', async () => {
    const { response, replayed } = await createSageWorkspaceForScope(admin(), input, idem())
    expect(replayed).toBe(false)
    const stored = await h.repo.getWorkspace(response.id, 'org-1')
    expect(stored?.boundaryProfile.prohibitedUses.length).toBeGreaterThan(0)
    expect(h.audit.has(SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED)).toBe(true)
  })
})

describe('workspace-service — RBAC (membership + role, no org-role bypass)', () => {
  it('the creator (bootstrapped owner) can read and list their own workspace', async () => {
    const created = await createSageWorkspaceForScope(writer(), input, idem())
    const detail = await getSageWorkspaceForScope(writer(), created.response.id)
    expect(detail?.id).toBe(created.response.id)
    const list = await listSageWorkspacesForScope(writer())
    expect(list.workspaces.map((w) => w.id)).toContain(created.response.id)
  })

  it('a non-member viewer cannot read, summarize, or list another actor\u2019s workspace', async () => {
    const created = await createSageWorkspaceForScope(writer(), input, idem())
    expect(await getSageWorkspaceForScope(viewer(), created.response.id)).toBeNull()
    expect(await getSageWorkspaceSummaryForScope(viewer(), created.response.id)).toBeNull()
    expect((await listSageWorkspacesForScope(viewer())).workspaces).toHaveLength(0)
  })

  it('an org-admin oversight role may read any org workspace (read-only)', async () => {
    const created = await createSageWorkspaceForScope(writer(), input, idem())
    const detail = await getSageWorkspaceForScope(admin(), created.response.id)
    expect(detail?.id).toBe(created.response.id)
  })

  it('does not disclose a cross-org workspace', async () => {
    const created = await createSageWorkspaceForScope(writer('org-1'), input, idem())
    expect(await getSageWorkspaceForScope(admin('org-2'), created.response.id)).toBeNull()
    expect(await getSageWorkspaceSummaryForScope(admin('org-2'), created.response.id)).toBeNull()
  })
})

describe('workspace-service — idempotency', () => {
  it('same key + same payload creates one workspace and replays the result', async () => {
    const first = await createSageWorkspaceForScope(writer(), input, idem('same'))
    expect(first.replayed).toBe(false)

    const replay = await createSageWorkspaceForScope(writer(), input, idem('same'))
    expect(replay.replayed).toBe(true)
    expect(replay.response.id).toBe(first.response.id)

    // Exactly one workspace and one workspace-created audit mutation.
    expect(await h.repo.listWorkspaces('org-1')).toHaveLength(1)
    expect(
      h.audit.records.filter((r) => r.action === SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED),
    ).toHaveLength(1)
  })

  it('same key + a different payload is a conflict', async () => {
    await createSageWorkspaceForScope(writer(), input, idem('conflict'))
    await expect(
      createSageWorkspaceForScope(writer(), { ...input, name: 'Different Name' }, idem('conflict')),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await h.repo.listWorkspaces('org-1')).toHaveLength(1)
  })

  it('scopes the idempotency key per organization', async () => {
    const a = await createSageWorkspaceForScope(writer('org-1'), input, idem('shared'))
    const b = await createSageWorkspaceForScope(writer('org-2'), input, idem('shared'))
    expect(b.replayed).toBe(false)
    expect(b.response.id).not.toBe(a.response.id)
  })

  it('scopes the idempotency key per actor', async () => {
    const a = await createSageWorkspaceForScope(writer(), input, idem('per-actor'))
    const other = {
      actorId: 'sec-2',
      orgId: 'org-1',
      orgRole: 'org_secretary',
      authenticationType: 'interactive_user',
    } as const
    const b = await createSageWorkspaceForScope(other, input, idem('per-actor'))
    expect(b.replayed).toBe(false)
    expect(b.response.id).not.toBe(a.response.id)
  })
})
