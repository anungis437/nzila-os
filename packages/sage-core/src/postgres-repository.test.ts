// ─── @nzila/sage-core — SQL-backed repository tests ──────────────────────────
// Uses a fake SageSqlClient that captures SQL text + parameters and returns
// controlled rows. Proves parameterized queries, org/workspace boundaries,
// membership-vs-role separation, revocation semantics, export status semantics,
// and snake_case → TypeScript mapping. No live database is required.

import { describe, expect, it } from 'vitest'
import { PostgresSageRepository } from './postgres-repository.js'
import type { SageSqlClient } from './sql-client.js'
import {
  mapDecisionRecord,
  mapEvidenceAuthorization,
  mapExportRequest,
  mapRoleAssignment,
  mapWorkspace,
  type SageDecisionRecordRow,
  type SageEvidenceAuthorizationRow,
  type SageExportRequestRow,
  type SageRoleAssignmentRow,
  type SageWorkspaceRow,
} from './postgres-mappers.js'
import type { SageBoundaryProfile } from './types.js'
import { createSageWorkspace, activeSageRoles } from './services.js'
import { InMemorySageAuditSink } from './audit-sink.js'
import { SAGE_PERMISSIONS } from './permissions.js'
import { SAGE_AUDIT_ACTIONS } from './audit-events.js'
import type { SageServiceContext } from './service-context.js'

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

// ─── Deliverable 7: export request/approval status semantics ─────────────────

describe('PostgresSageRepository — export status semantics', () => {
  it('createExportRequest starts non-approved (requested)', async () => {
    const sql = new FakeSqlClient()
    sql.enqueue([exportRequestRow()])
    const repo = new PostgresSageRepository(sql)
    const req = await repo.createExportRequest({
      workspaceId: 'ws-1',
      orgId: 'org-1',
      requestedBy: 'actor-2',
      scope: '{"evidenceItemIds":[]}',
      status: 'requested',
      createdAt: '2026-07-12T00:00:00.000Z',
    })
    expect(sql.lastCall.text).toContain('insert into sage_export_request')
    expect(sql.lastCall.params).toContain('requested')
    expect(sql.lastCall.params).not.toContain('approved')
    expect(req.status).toBe('requested')
  })

  it('approve flow updates request status to approved and inserts an approval row', async () => {
    const sql = new FakeSqlClient()
    // 1) status update returns nothing; 2) approval insert returns a row.
    sql.enqueue([]).enqueue([
      {
        id: 'appr-1',
        export_request_id: 'exp-1',
        org_id: 'org-1',
        export_authority_level: 'approve',
        approver_id: 'actor-3',
        decision: 'approved',
        decision_at: new Date('2026-07-12T05:00:00.000Z'),
        reason: null,
      },
    ])
    const repo = new PostgresSageRepository(sql)

    await repo.setExportRequestStatus('exp-1', 'approved')
    expect(sql.calls[0].text).toContain('update sage_export_request set status = $2')
    expect(sql.calls[0].params).toEqual(['exp-1', 'approved'])

    const approval = await repo.createExportApproval({
      exportRequestId: 'exp-1',
      orgId: 'org-1',
      exportAuthorityLevel: 'approve',
      approverId: 'actor-3',
      decision: 'approved',
      decisionAt: '2026-07-12T05:00:00.000Z',
      reason: null,
    })
    expect(sql.lastCall.text).toContain('insert into sage_export_approval')
    expect(approval.decision).toBe('approved')
  })

  it('deny flow updates request status to denied', async () => {
    const sql = new FakeSqlClient()
    const repo = new PostgresSageRepository(sql)
    await repo.setExportRequestStatus('exp-1', 'denied')
    expect(sql.lastCall.text).toContain('update sage_export_request set status = $2')
    expect(sql.lastCall.params).toEqual(['exp-1', 'denied'])
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

function exportRequestRow(
  overrides: Partial<SageExportRequestRow> = {},
): SageExportRequestRow {
  return {
    id: 'exp-1',
    workspace_id: 'ws-1',
    org_id: 'org-1',
    requested_by: 'actor-2',
    scope: '{"evidenceItemIds":[]}',
    status: 'requested',
    created_at: new Date('2026-07-12T00:00:00.000Z'),
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
      human_reviewer_id: 'reviewer-9',
      created_by: 'actor-1',
      created_at: new Date('2026-07-12T00:00:00.000Z'),
    }
    const record = mapDecisionRecord(row)
    expect(record).toMatchObject({
      workspaceId: 'ws-1',
      decision: 'proceed',
      humanReviewerId: 'reviewer-9',
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
    sql.enqueue([workspaceRow()])
    const repo = new PostgresSageRepository(sql)
    const audit = new InMemorySageAuditSink()

    const ws = await createSageWorkspace({ repo, audit }, ctxFor(), {
      name: 'Test Workspace',
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
    })

    expect(ws.id).toBe('ws-1')
    expect(sql.calls[0].text).toContain('insert into sage_workspace')
    expect(audit.has(SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED)).toBe(true)
  })
})
