// ─── @nzila/sage-core — SQL-backed repository tests ──────────────────────────
// Uses a fake SageSqlClient that captures SQL text + parameters and returns
// controlled rows. Proves parameterized queries, org/workspace boundaries,
// membership-vs-role separation, revocation semantics, export status semantics,
// and snake_case → TypeScript mapping. No live database is required.

import { describe, expect, it } from 'vitest'
import { PostgresSageRepository } from './postgres-repository'
import type { SageSqlClient } from './sql-client'
import {
  mapDecisionRecord,
  mapEvidenceAuthorization,
  mapExportRequest,
  mapRoleAssignment,
  mapWorkspace,
  type SageDecisionRecordRow,
  type SageEvidenceAuthorizationRow,
  type SageExportRequestRow,
  type SageExportPackageRow,
  type SageRoleAssignmentRow,
  type SageWorkspaceRow,
} from './postgres-mappers'
import type { SageBoundaryProfile } from './types'
import { createSageWorkspace, activeSageRoles } from './services'
import { InMemorySageAuditSink } from './audit-sink'
import { SAGE_PERMISSIONS } from './permissions'
import { SAGE_AUDIT_ACTIONS } from './audit-events'
import type { SageServiceContext } from './service-context'

type Call = { text: string; params: readonly unknown[] }

/** Fake SQL client: records calls, returns queued responses (FIFO). */
class FakeSqlClient implements SageSqlClient {
  readonly calls: Call[] = []
  private responses: Array<{ rows: unknown[] }> = []

  enqueue(rows: unknown[]): this {
    this.responses.push({ rows })
    return this
  }

  async query<T = unknown>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: T[] }> {
    this.calls.push({ text, params })
    const next = this.responses.shift() ?? { rows: [] }
    return { rows: next.rows as T[] }
  }

  get lastCall(): Call {
    return this.calls[this.calls.length - 1]
  }
}

const BOUNDARY_PROFILE: SageBoundaryProfile = {
  institutionType: 'regulator',
  riskSurface: 'regulatory_boundary',
  excludedSourceClasses: [],
  prohibitedUses: ['no automated decisions'],
  requiredReviewers: [],
  exportRestrictions: [],
  notes: [],
}

function workspaceRow(overrides: Partial<SageWorkspaceRow> = {}): SageWorkspaceRow {
  return {
    id: 'ws-1',
    org_id: 'org-1',
    name: 'Test Workspace',
    status: 'draft',
    institution_type: 'regulator',
    risk_surface: 'regulatory_boundary',
    boundary_profile: BOUNDARY_PROFILE,
    created_by: 'actor-1',
    updated_by: 'actor-1',
    created_at: new Date('2026-07-12T00:00:00.000Z'),
    updated_at: new Date('2026-07-12T00:00:00.000Z'),
    ...overrides,
  }
}

// ─── Deliverable 4/12: parameterized queries only ────────────────────────────

describe('PostgresSageRepository — parameterized SQL', () => {
  it('uses $N placeholders and never inlines parameter values into SQL text', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([workspaceRow()])
    const repo = new PostgresSageRepository(sql)

    await repo.createWorkspace({
      orgId: 'org-1',
      name: "Robert'); DROP TABLE sage_workspace;--",
      status: 'draft',
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
      boundaryProfile: BOUNDARY_PROFILE,
      createdBy: 'actor-1',
      updatedBy: 'actor-1',
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    })

    for (const call of sql.calls) {
      if (call.params.length > 0) {
        expect(call.text).toContain('$1')
        // No string param value should ever appear inlined in the SQL text.
        for (const p of call.params) {
          if (typeof p === 'string' && p.length > 0) {
            expect(call.text).not.toContain(p)
          }
        }
      }
    }
  })
})

// ─── Deliverable 8: workspace create + boundary ──────────────────────────────

describe('PostgresSageRepository — workspace', () => {
  it('createWorkspace inserts org_id, institution_type, risk_surface, boundary_profile', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([workspaceRow()])
    const repo = new PostgresSageRepository(sql)

    const ws = await repo.createWorkspace({
      orgId: 'org-1',
      name: 'Test Workspace',
      status: 'draft',
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
      boundaryProfile: BOUNDARY_PROFILE,
      createdBy: 'actor-1',
      updatedBy: 'actor-1',
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    })

    const call = sql.lastCall
    expect(call.text).toContain('insert into sage_workspace')
    expect(call.text).toContain('boundary_profile')
    expect(call.text).toContain('$6::jsonb')
    expect(call.params[0]).toBe('org-1')
    expect(call.params[3]).toBe('regulator')
    expect(call.params[4]).toBe('regulatory_boundary')
    // boundary_profile passed as JSON text.
    expect(JSON.parse(call.params[5] as string)).toMatchObject({ institutionType: 'regulator' })
    expect(ws.orgId).toBe('org-1')
    expect(ws.institutionType).toBe('regulator')
  })

  it('getWorkspace filters by id AND org_id and maps the row', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([workspaceRow({ id: 'ws-42' })])
    const repo = new PostgresSageRepository(sql)

    const ws = await repo.getWorkspace('ws-42', 'org-1')

    expect(sql.lastCall.text).toContain('from sage_workspace where id = $1 and org_id = $2')
    expect(sql.lastCall.params).toEqual(['ws-42', 'org-1'])
    expect(ws?.id).toBe('ws-42')
    expect(ws?.orgId).toBe('org-1')
  })

  it('getWorkspace returns undefined when no row (e.g. cross-org id)', async () => {
    const sql = new FakeSqlClient()
    const repo = new PostgresSageRepository(sql)
    // Fake returns no rows: models a cross-org id filtered out by `and org_id = $2`.
    expect(await repo.getWorkspace('ws-1', 'other-org')).toBeUndefined()
    expect(sql.lastCall.text).toContain('and org_id = $2')
    expect(sql.lastCall.params).toEqual(['ws-1', 'other-org'])
  })

  it('listWorkspaces filters by org_id and orders by updated_at/created_at desc', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([workspaceRow({ id: 'ws-a' }), workspaceRow({ id: 'ws-b' })])
    const repo = new PostgresSageRepository(sql)

    const list = await repo.listWorkspaces('org-1')

    expect(sql.lastCall.text).toContain('from sage_workspace where org_id = $1')
    expect(sql.lastCall.text).toContain('order by updated_at desc, created_at desc')
    expect(sql.lastCall.params).toEqual(['org-1'])
    expect(list.map((w) => w.id)).toEqual(['ws-a', 'ws-b'])
    expect(list.every((w) => w.orgId === 'org-1')).toBe(true)
  })
})

// ─── Deliverable 8: membership vs role separation ────────────────────────────

describe('PostgresSageRepository — membership vs role', () => {
  it('addWorkspaceMember inserts membership without a role column', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([
      {
        id: 'mem-1',
        workspace_id: 'ws-1',
        org_id: 'org-1',
        actor_id: 'actor-2',
        created_by: 'actor-1',
        created_at: new Date('2026-07-12T00:00:00.000Z'),
      },
    ])
    const repo = new PostgresSageRepository(sql)

    const member = await repo.addWorkspaceMember({
      workspaceId: 'ws-1',
      orgId: 'org-1',
      actorId: 'actor-2',
      createdBy: 'actor-1',
      createdAt: '2026-07-12T00:00:00.000Z',
    })

    expect(sql.lastCall.text).toContain('insert into sage_workspace_member')
    expect(sql.lastCall.text).not.toContain('sage_application_role')
    // membership is idempotent
    expect(sql.lastCall.text).toContain('on conflict (workspace_id, actor_id)')
    expect(member.actorId).toBe('actor-2')
  })

  it('getWorkspaceMember scopes by workspace_id and actor_id', async () => {
    const sql = new FakeSqlClient()
    const repo = new PostgresSageRepository(sql)
    await repo.getWorkspaceMember('ws-1', 'actor-2')
    expect(sql.lastCall.text).toContain('where workspace_id = $1 and actor_id = $2')
    expect(sql.lastCall.params).toEqual(['ws-1', 'actor-2'])
  })

  it('assignRole inserts a role assignment separately', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([roleRow()])
    const repo = new PostgresSageRepository(sql)

    await repo.assignRole({
      workspaceId: 'ws-1',
      orgId: 'org-1',
      actorId: 'actor-2',
      sageApplicationRole: 'evidence_steward',
      workspaceScope: 'ws-1',
      accessReason: 'onboarding',
      approvedBy: 'actor-1',
      createdAt: '2026-07-12T00:00:00.000Z',
      revokedAt: null,
    })

    expect(sql.lastCall.text).toContain('insert into sage_role_assignment')
    expect(sql.lastCall.params).toContain('evidence_steward')
    expect(sql.lastCall.params).toContain('org-1')
  })
})

function roleRow(overrides: Partial<SageRoleAssignmentRow> = {}): SageRoleAssignmentRow {
  return {
    id: 'role-1',
    workspace_id: 'ws-1',
    org_id: 'org-1',
    actor_id: 'actor-2',
    sage_application_role: 'evidence_steward',
    workspace_scope: 'ws-1',
    time_bound_access_expires_at: null,
    access_reason: 'onboarding',
    approved_by: 'actor-1',
    created_at: new Date('2026-07-12T00:00:00.000Z'),
    revoked_at: null,
    ...overrides,
  }
}

// ─── Deliverable 5/6: org boundary + revocation (roles) ──────────────────────

describe('PostgresSageRepository — role read/revoke semantics', () => {
  it('listRoleAssignments scopes by workspace_id and actor_id', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([roleRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.listRoleAssignments('ws-1', 'actor-2')
    expect(sql.lastCall.text).toContain(
      'from sage_role_assignment where workspace_id = $1 and actor_id = $2',
    )
    expect(sql.lastCall.params).toEqual(['ws-1', 'actor-2'])
  })

  it('revokeRole sets revoked_at and does not delete', async () => {
    const sql = new FakeSqlClient()
    const repo = new PostgresSageRepository(sql)
    await repo.revokeRole('role-1', '2026-07-12T01:00:00.000Z')
    expect(sql.lastCall.text).toContain('update sage_role_assignment set revoked_at = $2')
    expect(sql.lastCall.text).not.toContain('delete')
    expect(sql.lastCall.params).toEqual(['role-1', '2026-07-12T01:00:00.000Z'])
  })

  it('a revoked role no longer grants permission (service active filter)', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([
      roleRow({ id: 'role-active' }),
      roleRow({ id: 'role-revoked', revoked_at: new Date('2026-07-12T02:00:00.000Z') }),
    ])
    const repo = new PostgresSageRepository(sql)
    const audit = new InMemorySageAuditSink()

    const active = await activeSageRoles({ repo, audit }, 'ws-1', 'actor-2')
    // Two rows returned by SQL; only the non-revoked role is active.
    expect(active).toEqual(['evidence_steward'])
  })
})

// ─── Deliverable 6: evidence authorization revocation ────────────────────────

describe('PostgresSageRepository — evidence authorization semantics', () => {
  it('grantEvidenceAuthorization inserts an authorization with org_id', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([evAuthRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.grantEvidenceAuthorization({
      workspaceId: 'ws-1',
      orgId: 'org-1',
      actorId: 'actor-2',
      evidenceAuthorizationLevel: 'authorized_only',
      accessReason: 'review',
      approvedBy: 'actor-1',
      createdAt: '2026-07-12T00:00:00.000Z',
      revokedAt: null,
    })
    expect(sql.lastCall.text).toContain('insert into sage_evidence_authorization')
    expect(sql.lastCall.params).toContain('authorized_only')
    expect(sql.lastCall.params).toContain('org-1')
  })

  it('revokeEvidenceAuthorization sets revoked_at and does not delete', async () => {
    const sql = new FakeSqlClient()
    const repo = new PostgresSageRepository(sql)
    await repo.revokeEvidenceAuthorization('evauth-1', '2026-07-12T03:00:00.000Z')
    expect(sql.lastCall.text).toContain(
      'update sage_evidence_authorization set revoked_at = $2',
    )
    expect(sql.lastCall.text).not.toContain('delete')
    expect(sql.lastCall.params).toEqual(['evauth-1', '2026-07-12T03:00:00.000Z'])
  })

  it('listEvidenceAuthorizations preserves revoked_at so the service can ignore revoked grants', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([
      evAuthRow({ id: 'g-active', revoked_at: null }),
      evAuthRow({ id: 'g-revoked', revoked_at: new Date('2026-07-12T04:00:00.000Z') }),
    ])
    const repo = new PostgresSageRepository(sql)
    const grants = await repo.listEvidenceAuthorizations('ws-1', 'actor-2')
    expect(sql.lastCall.text).toContain('where workspace_id = $1 and actor_id = $2')
    const activeLevels = grants.filter((g) => !g.revokedAt).map((g) => g.evidenceAuthorizationLevel)
    expect(activeLevels).toEqual(['authorized_only'])
  })
})

function evAuthRow(
  overrides: Partial<SageEvidenceAuthorizationRow> = {},
): SageEvidenceAuthorizationRow {
  return {
    id: 'evauth-1',
    workspace_id: 'ws-1',
    org_id: 'org-1',
    actor_id: 'actor-2',
    evidence_authorization_level: 'authorized_only',
    access_reason: 'review',
    approved_by: 'actor-1',
    created_at: new Date('2026-07-12T00:00:00.000Z'),
    revoked_at: null,
    ...overrides,
  }
}

// ─── Deliverable 7: export request/approval + package SQL semantics ──────────

describe('PostgresSageRepository — export status semantics', () => {
  it('createExportRequest starts non-approved (requested) and persists scope hash', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([exportRequestRow()])
    const repo = new PostgresSageRepository(sql)
    const req = await repo.createExportRequest({
      workspaceId: 'ws-1',
      orgId: 'org-1',
      requestedBy: 'actor-2',
      scope: null,
      purpose: 'internal review',
      packageType: 'internal_review_bundle',
      requestedScopeJson: '{"items":[]}',
      requestedScopeHash: 'hash-1',
      policyVersion: 'sage-export-v1',
      status: 'requested',
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    })
    expect(sql.lastCall.text).toContain('insert into sage_export_request')
    expect(sql.lastCall.text).toContain('requested_scope_hash')
    expect(sql.lastCall.params).toContain('requested')
    expect(sql.lastCall.params).toContain('hash-1')
    expect(sql.lastCall.params).not.toContain('approved')
    expect(req.status).toBe('requested')
  })

  it('decideExportRequest is a single-statement CAS from requested → approved + approval insert', async () => {
    const sql = new FakeSqlClient()
    sql
      .enqueue([
        {
          id: 'appr-1',
          export_request_id: 'exp-1',
          org_id: 'org-1',
          export_authority_level: 'approve',
          approver_id: 'actor-3',
          decision: 'approved',
          decision_at: new Date('2026-07-12T05:00:00.000Z'),
          reason: 'ok',
          approved_scope_hash: 'hash-1',
        },
      ])
      .enqueue([exportRequestRow({ status: 'approved' })])
    const repo = new PostgresSageRepository(sql)
    const decided = await repo.decideExportRequest({
      exportRequestId: 'exp-1',
      workspaceId: 'ws-1',
      orgId: 'org-1',
      decision: 'approved',
      updatedAt: '2026-07-12T05:00:00.000Z',
      approval: {
        exportRequestId: 'exp-1',
        orgId: 'org-1',
        exportAuthorityLevel: 'approve',
        approverId: 'actor-3',
        decision: 'approved',
        decisionAt: '2026-07-12T05:00:00.000Z',
        reason: 'ok',
        approvedScopeHash: 'hash-1',
      },
      auditEvent: {
        eventId: 'ev-approve-1',
        actorId: 'actor-3',
        action: 'sage.export.approved',
        resourceType: 'sage_export_approval',
        safePayload: { exportRequestId: 'exp-1' },
      },
    })
    // The CAS + approval insert + durable audit outbox are ONE statement (a CTE).
    expect(sql.calls[0].text).toContain('with decided as')
    expect(sql.calls[0].text).toContain("status = 'requested'")
    expect(sql.calls[0].text).toContain('insert into sage_export_approval')
    expect(sql.calls[0].text).toContain('insert into sage_audit_outbox')
    expect(decided?.approval.decision).toBe('approved')
  })

  it('decideExportRequest returns undefined (conflict) when no requested row matches', async () => {
    const sql = new FakeSqlClient() // zero rows → the guarded CTE inserts nothing
    const repo = new PostgresSageRepository(sql)
    const result = await repo.decideExportRequest({
      exportRequestId: 'exp-1',
      workspaceId: 'ws-1',
      orgId: 'org-1',
      decision: 'denied',
      updatedAt: '2026-07-12T05:00:00.000Z',
      approval: {
        exportRequestId: 'exp-1',
        orgId: 'org-1',
        exportAuthorityLevel: 'deny',
        approverId: 'actor-3',
        decision: 'denied',
        decisionAt: '2026-07-12T05:00:00.000Z',
        reason: 'x',
        approvedScopeHash: null,
      },
      auditEvent: {
        eventId: 'ev-deny-1',
        actorId: 'actor-3',
        action: 'sage.export.denied',
        resourceType: 'sage_export_approval',
        safePayload: { exportRequestId: 'exp-1' },
      },
    })
    expect(result).toBeUndefined()
  })

  it('commitExportPackage commits object + package + audit outbox in ONE atomic statement', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([exportPackageRow()])
    const repo = new PostgresSageRepository(sql)
    const result = await repo.commitExportPackage({
      package: {
        orgId: 'org-1',
        workspaceId: 'ws-1',
        exportRequestId: 'exp-1',
        status: 'generated',
        packageType: 'internal_review_bundle',
        manifestJson: '{"items":[]}',
        manifestHash: 'mh',
        contentHash: 'ch',
        storageReference: 'sage-internal://k',
        mediaType: 'application/json',
        sizeBytes: 10,
        policyVersion: 'sage-export-v1',
        itemCount: 1,
        excludedCount: 0,
        generatedBy: 'actor-3',
        generatedAt: '2026-07-12T06:00:00.000Z',
        createdAt: '2026-07-12T06:00:00.000Z',
      },
      object: {
        storageReference: 'sage-internal://k',
        mediaType: 'application/json',
        bytes: new TextEncoder().encode('{"manifest":{}}'),
        contentHash: 'ch',
        sizeBytes: 10,
      },
      auditEvent: {
        eventId: 'ev-pkg-1',
        actorId: 'actor-3',
        action: 'sage.export.package_generated',
        resourceType: 'sage_export_package',
        safePayload: { exportRequestId: 'exp-1' },
      },
    })
    // One statement, claim-gated inserts, guarded idempotency on both keys.
    expect(sql.calls[0].text).toContain('with existing_pkg as')
    expect(sql.calls[0].text).toContain('insert into sage_export_package_object')
    expect(sql.calls[0].text).toContain('insert into sage_export_package')
    expect(sql.calls[0].text).toContain('insert into sage_audit_outbox')
    // The object insert is gated on NOT already having a package for the request
    // (winning the generation claim) — never merely sharing the statement.
    expect(sql.calls[0].text).toContain('where not exists (select 1 from existing_pkg)')
    // The package insert is gated on a matching object row being present.
    expect(sql.calls[0].text).toContain('from object_row')
    // The outbox insert is gated on the package row being inserted.
    expect(sql.calls[0].text).toMatch(/select .* from pkg/s)
    expect(sql.calls[0].text).toContain('on conflict (storage_reference) do nothing')
    expect(sql.calls[0].text).toContain('on conflict (export_request_id) do nothing')
    expect(sql.calls[0].text).toContain('on conflict (event_id) do nothing')
    expect(result.created).toBe(true)

    sql.enqueue([exportPackageRow()])
    await repo.getExportPackage('pkg-1', 'ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where id = $1 and workspace_id = $2 and org_id = $3')
    expect(sql.lastCall.params).toEqual(['pkg-1', 'ws-1', 'org-1'])

    sql.enqueue([exportRequestRow()])
    await repo.getExportRequest('exp-1', 'ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where id = $1 and workspace_id = $2 and org_id = $3')
    expect(sql.lastCall.params).toEqual(['exp-1', 'ws-1', 'org-1'])
  })

  it('listExportRequests / listExportPackages filter by workspace_id + org_id', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([exportRequestRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.listExportRequests('ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where workspace_id = $1 and org_id = $2')
    expect(sql.lastCall.params).toEqual(['ws-1', 'org-1'])

    sql.enqueue([exportPackageRow()])
    await repo.listExportPackages('ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where workspace_id = $1 and org_id = $2')
    expect(sql.lastCall.params).toEqual(['ws-1', 'org-1'])
  })

  it('claimPendingAuditOutbox uses a leased FOR UPDATE SKIP LOCKED claim', async () => {
    const sql = new FakeSqlClient()
    const repo = new PostgresSageRepository(sql)
    await repo.claimPendingAuditOutbox({
      owner: 'own-1',
      leaseExpiresAt: 'lease-ts',
      limit: 25,
      now: 'now-ts',
    })
    const text = sql.lastCall.text
    expect(text).toContain('update sage_audit_outbox')
    expect(text).toContain("set status = 'dispatching'")
    expect(text).toContain('dispatch_owner = $1')
    expect(text).toContain('attempt_count = o.attempt_count + 1')
    expect(text).toContain('for update skip locked')
    // Reclaims pending OR events whose lease has expired.
    expect(text).toContain("status = 'pending'")
    expect(text).toContain("status = 'dispatching' and lease_expires_at < $3")
    expect(sql.lastCall.params).toEqual(['own-1', 'lease-ts', 'now-ts', 25])
  })

  it('markAuditOutboxDispatched is owner-fenced and returns whether it won', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([{ event_id: 'ev-1' }])
    const repo = new PostgresSageRepository(sql)
    const won = await repo.markAuditOutboxDispatched('ev-1', 'own-1', 'ts')
    expect(won).toBe(true)
    const text = sql.lastCall.text
    expect(text).toContain("set status = 'dispatched'")
    expect(text).toContain('where event_id = $1 and dispatch_owner = $2')
    expect(text).toContain("status = 'dispatching'")
    expect(sql.lastCall.params).toEqual(['ev-1', 'own-1', 'ts'])

    // No row updated (lost lease) → returns false.
    const lost = await repo.markAuditOutboxDispatched('ev-1', 'own-2', 'ts')
    expect(lost).toBe(false)
  })

  it('releaseAuditOutbox is owner-fenced and returns the claim to pending', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([{ event_id: 'ev-1' }])
    const repo = new PostgresSageRepository(sql)
    const released = await repo.releaseAuditOutbox('ev-1', 'own-1', 'ERR')
    expect(released).toBe(true)
    const text = sql.lastCall.text
    expect(text).toContain("set status = 'pending'")
    expect(text).toContain('where event_id = $1 and dispatch_owner = $2')
    expect(text).toContain("status = 'dispatching'")
    expect(sql.lastCall.params).toEqual(['ev-1', 'own-1', 'ERR'])
  })

  it('countWorkspaceOpenExportRequests counts only requested status', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([{ count: 2 }])
    const repo = new PostgresSageRepository(sql)
    const n = await repo.countWorkspaceOpenExportRequests('ws-1')
    expect(sql.lastCall.text).toContain("where workspace_id = $1 and status = 'requested'")
    expect(n).toBe(2)
  })
})

describe('PostgresSageRepository — evidence read models (tenant-scoped)', () => {
  function sourceRow() {
    return {
      id: 'src-1',
      workspace_id: 'ws-1',
      org_id: 'org-1',
      source_type: 'public',
      source_quality: 'moderate',
      authorization_level: 'internal',
      contains_personal_information: false,
      contains_sensitive_information: false,
      created_by: 'actor-1',
      created_at: new Date('2026-07-12T00:00:00.000Z'),
    }
  }
  function itemRow() {
    return {
      id: 'item-1',
      source_id: 'src-1',
      workspace_id: 'ws-1',
      org_id: 'org-1',
      lifecycle_state: 'registered',
      confidence_level: 'moderate',
      excluded_from_external_review: false,
      human_review_required: true,
      created_by: 'actor-1',
      updated_by: 'actor-1',
      created_at: new Date('2026-07-12T00:00:00.000Z'),
      updated_at: new Date('2026-07-12T00:00:00.000Z'),
    }
  }

  it('listEvidenceSources filters by workspace_id + org_id', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([sourceRow()])
    const repo = new PostgresSageRepository(sql)
    const list = await repo.listEvidenceSources('ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where workspace_id = $1 and org_id = $2')
    expect(sql.lastCall.params).toEqual(['ws-1', 'org-1'])
    expect(list[0].id).toBe('src-1')
  })

  it('getEvidenceSource filters by id + workspace_id + org_id', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([sourceRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.getEvidenceSource('src-1', 'ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where id = $1 and workspace_id = $2 and org_id = $3')
    expect(sql.lastCall.params).toEqual(['src-1', 'ws-1', 'org-1'])
  })

  it('getEvidenceSource returns undefined for a cross-workspace/org id', async () => {
    const sql = new FakeSqlClient()
    const repo = new PostgresSageRepository(sql)
    expect(await repo.getEvidenceSource('src-1', 'other-ws', 'other-org')).toBeUndefined()
    expect(sql.lastCall.params).toEqual(['src-1', 'other-ws', 'other-org'])
  })

  it('listEvidenceItems filters by workspace_id + org_id (+ source_id when given)', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([itemRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.listEvidenceItems('ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where workspace_id = $1 and org_id = $2')
    expect(sql.lastCall.params).toEqual(['ws-1', 'org-1'])

    sql.enqueue([itemRow()])
    await repo.listEvidenceItems('ws-1', 'org-1', 'src-1')
    expect(sql.lastCall.text).toContain('and source_id = $3')
    expect(sql.lastCall.params).toEqual(['ws-1', 'org-1', 'src-1'])
  })

  it('getEvidenceItem filters by id + workspace_id + org_id', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([itemRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.getEvidenceItem('item-1', 'ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where id = $1 and workspace_id = $2 and org_id = $3')
    expect(sql.lastCall.params).toEqual(['item-1', 'ws-1', 'org-1'])
  })
})

describe('PostgresSageRepository — lifecycle compare-and-set', () => {
  function sourceRow(sourceQuality: string | null = 'moderate') {
    return {
      id: 'src-1',
      workspace_id: 'ws-1',
      org_id: 'org-1',
      source_type: 'public',
      source_quality: sourceQuality,
      authorization_level: 'internal',
      contains_personal_information: false,
      contains_sensitive_information: false,
      created_by: 'actor-1',
      created_at: new Date('2026-07-12T00:00:00.000Z'),
    }
  }
  function itemRow(state = 'linked') {
    return {
      id: 'item-1',
      source_id: 'src-1',
      workspace_id: 'ws-1',
      org_id: 'org-1',
      lifecycle_state: state,
      confidence_level: 'moderate',
      excluded_from_external_review: false,
      human_review_required: true,
      created_by: 'actor-1',
      updated_by: 'actor-1',
      created_at: new Date('2026-07-12T00:00:00.000Z'),
      updated_at: new Date('2026-07-12T00:00:00.000Z'),
    }
  }

  it('classifyEvidenceSource guards on source_quality is null (compare-and-set)', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([sourceRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.classifyEvidenceSource('src-1', {
      sourceQuality: 'moderate',
      authorizationLevel: 'internal',
    })
    expect(sql.lastCall.text).toContain('source_quality is null')
    expect(sql.lastCall.params).toEqual(['src-1', 'moderate', 'internal'])
  })

  it('classifyEvidenceSource raises CONFLICT when the guarded update matches no row', async () => {
    const sql = new FakeSqlClient() // no rows enqueued → zero-row update
    const repo = new PostgresSageRepository(sql)
    await expect(
      repo.classifyEvidenceSource('src-1', { sourceQuality: 'moderate', authorizationLevel: 'internal' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it("linkEvidenceItem guards on lifecycle_state = 'registered' (compare-and-set)", async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([itemRow('linked')])
    const repo = new PostgresSageRepository(sql)
    await repo.linkEvidenceItem('item-1', '2026-07-12T00:00:00.000Z')
    expect(sql.lastCall.text).toContain("lifecycle_state = 'registered'")
    expect(sql.lastCall.params).toEqual(['item-1', '2026-07-12T00:00:00.000Z'])
  })

  it('linkEvidenceItem raises CONFLICT when the guarded update matches no row', async () => {
    const sql = new FakeSqlClient() // zero-row update
    const repo = new PostgresSageRepository(sql)
    await expect(
      repo.linkEvidenceItem('item-1', '2026-07-12T00:00:00.000Z'),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('PostgresSageRepository — governance reads + boundary CAS (tenant-scoped)', () => {
  function boundaryRow(status = 'open') {
    return {
      id: 'flag-1',
      workspace_id: 'ws-1',
      org_id: 'org-1',
      target_type: 'workspace',
      target_id: null,
      flag_type: 'review_required',
      note: null,
      status,
      authorization_level: 'internal',
      authorization_basis: 'workspace_default',
      resolved_at: null,
      resolved_by: null,
      resolution_note: null,
      created_by: 'actor-1',
      created_at: new Date('2026-07-12T00:00:00.000Z'),
      updated_at: new Date('2026-07-12T00:00:00.000Z'),
    }
  }
  function decisionRow() {
    return {
      id: 'dec-1',
      workspace_id: 'ws-1',
      org_id: 'org-1',
      decision: 'proceed',
      rationale: null,
      uncertainty: 'n/a',
      human_reviewer_id: 'actor-1',
      referenced_evidence_item_ids: [],
      referenced_boundary_flag_ids: [],
      authorization_level: 'internal',
      authorization_basis: 'workspace_default',
      excluded_from_external_review: false,
      created_by: 'actor-1',
      created_at: new Date('2026-07-12T00:00:00.000Z'),
    }
  }

  it('listBoundaryFlags filters by workspace_id + org_id with deterministic ordering', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([boundaryRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.listBoundaryFlags('ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where workspace_id = $1 and org_id = $2')
    expect(sql.lastCall.text).toContain('order by created_at desc, id desc')
    expect(sql.lastCall.params).toEqual(['ws-1', 'org-1'])
  })

  it('listBoundaryFlags parameterizes optional status/target filters', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([boundaryRow('resolved')])
    const repo = new PostgresSageRepository(sql)
    await repo.listBoundaryFlags('ws-1', 'org-1', {
      status: 'resolved',
      targetType: 'evidence_source',
      targetId: 'src-1',
    })
    expect(sql.lastCall.text).toContain('target_type = $3')
    expect(sql.lastCall.text).toContain('target_id = $4')
    expect(sql.lastCall.text).toContain('status = $5')
    expect(sql.lastCall.params).toEqual(['ws-1', 'org-1', 'evidence_source', 'src-1', 'resolved'])
  })

  it('reviewBoundaryFlag compare-and-sets from status = open', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([boundaryRow('under_review')])
    const repo = new PostgresSageRepository(sql)
    await repo.reviewBoundaryFlag('flag-1', 'ws-1', 'org-1', '2026-07-12T00:00:00.000Z')
    expect(sql.lastCall.text).toContain("status = 'open'")
    expect(sql.lastCall.text).toContain('where id = $1 and workspace_id = $2 and org_id = $3')
  })

  it('resolveBoundaryFlag compare-and-sets from open/under_review and fences tenant', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([boundaryRow('resolved')])
    const repo = new PostgresSageRepository(sql)
    await repo.resolveBoundaryFlag('flag-1', 'ws-1', 'org-1', {
      status: 'resolved',
      resolvedBy: 'actor-1',
      resolutionNote: 'done',
      resolvedAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    })
    expect(sql.lastCall.text).toContain('where id = $1 and workspace_id = $2 and org_id = $3')
    expect(sql.lastCall.text).toContain("status in ('open', 'under_review')")
    expect(sql.lastCall.params[0]).toBe('flag-1')
    expect(sql.lastCall.params[3]).toBe('resolved')
  })

  it('resolveBoundaryFlag preserves authorization_level unless the resolver raises it', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([boundaryRow('resolved')])
    const repo = new PostgresSageRepository(sql)
    // No override → coalesce keeps the persisted level (last param is null).
    await repo.resolveBoundaryFlag('flag-1', 'ws-1', 'org-1', {
      status: 'resolved',
      resolvedBy: 'actor-1',
      resolutionNote: 'done',
      resolvedAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    })
    expect(sql.lastCall.text).toContain('authorization_level = coalesce($9, authorization_level)')
    expect(sql.lastCall.params[8]).toBeNull()

    // Explicit raise → the new (stricter) level is passed through.
    sql.enqueue([boundaryRow('resolved')])
    await repo.resolveBoundaryFlag('flag-1', 'ws-1', 'org-1', {
      status: 'resolved',
      resolvedBy: 'actor-1',
      resolutionNote: 'references sensitive evidence',
      resolvedAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
      authorizationLevel: 'sensitive',
    })
    expect(sql.lastCall.params[8]).toBe('sensitive')
  })

  it('addBoundaryFlag / addReviewNote persist the authorization envelope columns', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([boundaryRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.addBoundaryFlag({
      workspaceId: 'ws-1',
      orgId: 'org-1',
      targetType: 'evidence_source',
      targetId: 'src-1',
      flagType: 'review_required',
      note: null,
      status: 'open',
      authorizationLevel: 'sensitive',
      authorizationBasis: 'target_inherited',
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      createdBy: 'actor-1',
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    })
    expect(sql.lastCall.text).toContain('authorization_level')
    expect(sql.lastCall.text).toContain('authorization_basis')
    expect(sql.lastCall.params).toContain('sensitive')
    expect(sql.lastCall.params).toContain('target_inherited')

    sql.enqueue([
      {
        id: 'note-1',
        workspace_id: 'ws-1',
        org_id: 'org-1',
        target_type: 'evidence_source',
        target_id: 'src-1',
        reviewer_id: 'actor-1',
        note_type: 'observation',
        note: 'seen',
        authorization_level: 'authorized_only',
        authorization_basis: 'target_inherited',
        created_at: new Date('2026-07-12T00:00:00.000Z'),
      },
    ])
    await repo.addReviewNote({
      workspaceId: 'ws-1',
      orgId: 'org-1',
      targetType: 'evidence_source',
      targetId: 'src-1',
      reviewerId: 'actor-1',
      noteType: 'observation',
      note: 'seen',
      authorizationLevel: 'authorized_only',
      authorizationBasis: 'target_inherited',
      createdAt: '2026-07-12T00:00:00.000Z',
    })
    expect(sql.lastCall.text).toContain('authorization_level')
    expect(sql.lastCall.params).toContain('authorized_only')
  })

  it('resolveBoundaryFlag raises CONFLICT when the guarded update matches no row', async () => {
    const sql = new FakeSqlClient() // zero-row update
    const repo = new PostgresSageRepository(sql)
    await expect(
      repo.resolveBoundaryFlag('flag-1', 'ws-1', 'org-1', {
        status: 'resolved',
        resolvedBy: 'actor-1',
        resolutionNote: 'done',
        resolvedAt: '2026-07-12T00:00:00.000Z',
        updatedAt: '2026-07-12T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('listReviewNotes / listDecisionRecords / getDecisionRecord are tenant-scoped', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([])
    const repo = new PostgresSageRepository(sql)
    await repo.listReviewNotes('ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where workspace_id = $1 and org_id = $2')
    expect(sql.lastCall.params).toEqual(['ws-1', 'org-1'])

    sql.enqueue([])
    await repo.listDecisionRecords('ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where workspace_id = $1 and org_id = $2')
    expect(sql.lastCall.text).toContain('order by created_at desc, id desc')

    sql.enqueue([decisionRow()])
    await repo.getDecisionRecord('dec-1', 'ws-1', 'org-1')
    expect(sql.lastCall.text).toContain('where id = $1 and workspace_id = $2 and org_id = $3')
    expect(sql.lastCall.params).toEqual(['dec-1', 'ws-1', 'org-1'])
  })

  it('createDecisionRecord persists uncertainty + reference arrays as jsonb', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([decisionRow()])
    const repo = new PostgresSageRepository(sql)
    await repo.createDecisionRecord({
      workspaceId: 'ws-1',
      orgId: 'org-1',
      decision: 'proceed',
      rationale: null,
      uncertainty: 'limited',
      humanReviewerId: 'actor-1',
      referencedEvidenceItemIds: ['item-1'],
      referencedBoundaryFlagIds: ['flag-1'],
      authorizationLevel: 'internal',
      authorizationBasis: 'evidence_inherited',
      excludedFromExternalReview: false,
      createdBy: 'actor-1',
      createdAt: '2026-07-12T00:00:00.000Z',
    })
    expect(sql.lastCall.text).toContain('$7::jsonb')
    expect(sql.lastCall.text).toContain('$8::jsonb')
    expect(sql.lastCall.params[6]).toBe(JSON.stringify(['item-1']))
    expect(sql.lastCall.params[7]).toBe(JSON.stringify(['flag-1']))
    expect(sql.lastCall.text).toContain('authorization_level')
    expect(sql.lastCall.text).toContain('excluded_from_external_review')
    expect(sql.lastCall.params[8]).toBe('internal')
    expect(sql.lastCall.params[9]).toBe('evidence_inherited')
    expect(sql.lastCall.params[10]).toBe(false)
  })
})

function exportRequestRow(
  overrides: Partial<SageExportRequestRow> = {},
): SageExportRequestRow {
  return {
    id: 'exp-1',
    workspace_id: 'ws-1',
    org_id: 'org-1',
    requested_by: 'actor-2',
    scope: null,
    purpose: 'internal review',
    package_type: 'internal_review_bundle',
    requested_scope_json: { policyVersion: 'sage-export-v1', packageType: 'internal_review_bundle', items: [] },
    requested_scope_hash: 'hash-1',
    policy_version: 'sage-export-v1',
    status: 'requested',
    created_at: new Date('2026-07-12T00:00:00.000Z'),
    updated_at: new Date('2026-07-12T00:00:00.000Z'),
    ...overrides,
  }
}

function exportPackageRow(overrides: Partial<SageExportPackageRow> = {}): SageExportPackageRow {
  return {
    id: 'pkg-1',
    org_id: 'org-1',
    workspace_id: 'ws-1',
    export_request_id: 'exp-1',
    status: 'generated',
    package_type: 'internal_review_bundle',
    manifest_json: { items: [] },
    manifest_hash: 'mh',
    content_hash: 'ch',
    storage_reference: 'sage-internal://k',
    media_type: 'application/json',
    size_bytes: 10,
    policy_version: 'sage-export-v1',
    item_count: 1,
    excluded_count: 0,
    generated_by: 'actor-3',
    generated_at: new Date('2026-07-12T06:00:00.000Z'),
    created_at: new Date('2026-07-12T06:00:00.000Z'),
    ...overrides,
  }
}

// ─── Deliverable 3: snake_case → TypeScript mapping ──────────────────────────

describe('postgres-mappers — snake_case → camelCase', () => {
  it('maps a workspace row (institution_type, risk_surface, boundary_profile, created_by, timestamps)', () => {
    const ws = mapWorkspace(workspaceRow({ id: 'ws-9' }))
    expect(ws).toMatchObject({
      id: 'ws-9',
      orgId: 'org-1',
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
      createdBy: 'actor-1',
      updatedBy: 'actor-1',
      createdAt: '2026-07-12T00:00:00.000Z',
      updatedAt: '2026-07-12T00:00:00.000Z',
    })
    expect(ws.boundaryProfile.institutionType).toBe('regulator')
  })

  it('maps boundary_profile when the driver returns it as a JSON string', () => {
    const ws = mapWorkspace(workspaceRow({ boundary_profile: JSON.stringify(BOUNDARY_PROFILE) }))
    expect(ws.boundaryProfile.prohibitedUses).toContain('no automated decisions')
  })

  it('maps a role assignment row including revoked_at', () => {
    const role = mapRoleAssignment(
      roleRow({ revoked_at: new Date('2026-07-12T06:00:00.000Z'), approved_by: 'actor-1' }),
    )
    expect(role).toMatchObject({
      workspaceId: 'ws-1',
      actorId: 'actor-2',
      sageApplicationRole: 'evidence_steward',
      approvedBy: 'actor-1',
      revokedAt: '2026-07-12T06:00:00.000Z',
    })
  })

  it('maps an evidence authorization row', () => {
    const grant = mapEvidenceAuthorization(evAuthRow())
    expect(grant).toMatchObject({
      workspaceId: 'ws-1',
      actorId: 'actor-2',
      evidenceAuthorizationLevel: 'authorized_only',
      revokedAt: null,
    })
  })

  it('maps an export request row', () => {
    const req = mapExportRequest(exportRequestRow({ requested_by: 'actor-7' }))
    expect(req).toMatchObject({
      workspaceId: 'ws-1',
      requestedBy: 'actor-7',
      status: 'requested',
    })
  })

  it('maps a decision record row including human_reviewer_id', () => {
    const row: SageDecisionRecordRow = {
      id: 'dec-1',
      workspace_id: 'ws-1',
      org_id: 'org-1',
      decision: 'proceed',
      rationale: 'documented',
      uncertainty: 'limited sample',
      human_reviewer_id: 'reviewer-9',
      referenced_evidence_item_ids: ['item-1', 'item-2'],
      referenced_boundary_flag_ids: [],
      authorization_level: 'internal',
      authorization_basis: 'evidence_inherited',
      excluded_from_external_review: false,
      created_by: 'actor-1',
      created_at: new Date('2026-07-12T00:00:00.000Z'),
    }
    const record = mapDecisionRecord(row)
    expect(record).toMatchObject({
      workspaceId: 'ws-1',
      decision: 'proceed',
      uncertainty: 'limited sample',
      humanReviewerId: 'reviewer-9',
      referencedEvidenceItemIds: ['item-1', 'item-2'],
      referencedBoundaryFlagIds: [],
      createdBy: 'actor-1',
    })
  })
})

// ─── Deliverable 9: one service test using the SQL-backed repository ──────────

describe('service integration with PostgresSageRepository', () => {
  function ctxFor(): SageServiceContext {
    return {
      actor: {
        actorId: 'actor-1',
        orgId: 'org-1',
        permissions: [SAGE_PERMISSIONS.WORKSPACE_CREATE],
      },
      now: () => new Date('2026-07-12T00:00:00.000Z'),
    }
  }

  it('createSageWorkspace persists via the SQL repository and emits an audit event', async () => {
    const sql = new FakeSqlClient()
    // 1) workspace insert, 2) bootstrap member insert, 3) bootstrap role insert.
    sql
      .enqueue([workspaceRow()])
      .enqueue([
        {
          id: 'mem-1',
          workspace_id: 'ws-1',
          org_id: 'org-1',
          actor_id: 'actor-1',
          created_by: 'actor-1',
          created_at: new Date('2026-07-12T00:00:00.000Z'),
        },
      ])
      .enqueue([roleRow({ actor_id: 'actor-1', sage_application_role: 'workspace_owner' })])
    const repo = new PostgresSageRepository(sql)
    const audit = new InMemorySageAuditSink()

    const ws = await createSageWorkspace({ repo, audit }, ctxFor(), {
      name: 'Test Workspace',
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
    })

    expect(ws.id).toBe('ws-1')
    expect(sql.calls[0].text).toContain('insert into sage_workspace')
    // Creator is bootstrapped as a member + workspace_owner.
    expect(sql.calls[1].text).toContain('insert into sage_workspace_member')
    expect(sql.calls[2].text).toContain('insert into sage_role_assignment')
    expect(audit.has(SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED)).toBe(true)
  })
})
