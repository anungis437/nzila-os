import { describe, it, expect, beforeEach } from 'vitest'
import { InMemorySageRepository } from './repository'
import { InMemorySageAuditSink } from './audit-sink'
import { SAGE_PERMISSIONS } from './permissions'
import { SAGE_AUDIT_ACTIONS } from './audit-events'
import { SageServiceError } from './service-errors'
import type { SageServiceContext, SageServiceActor } from './service-context'
import type { SageApplicationRole } from './types'
import {
  addSageBoundaryFlag,
  addSageReviewNote,
  addSageWorkspaceMember,
  approveSageExport,
  assignSageRole,
  classifySageEvidenceSource,
  createSageDecisionRecord,
  createSageEvidenceItem,
  createSageEvidenceSource,
  createSageWorkspace,
  denySageExport,
  getSageWorkspaceSummary,
  getSageWorkspace,
  grantSageEvidenceAuthorization,
  linkSageEvidenceItem,
  listSageWorkspaces,
  requestSageExport,
  revokeSageRole,
  type SageServiceDeps,
} from './services'

const ALL_PERMS = Object.values(SAGE_PERMISSIONS)

function actor(overrides: Partial<SageServiceActor> = {}): SageServiceActor {
  return { actorId: 'actor_1', orgId: 'org_1', permissions: [...ALL_PERMS], ...overrides }
}

function ctxFor(a: SageServiceActor): SageServiceContext {
  return { actor: a, now: () => new Date('2026-07-12T00:00:00.000Z') }
}

let deps: SageServiceDeps
let sink: InMemorySageAuditSink

beforeEach(() => {
  sink = new InMemorySageAuditSink()
  deps = { repo: new InMemorySageRepository(), audit: sink }
})

async function makeWorkspace(a = actor()) {
  return createSageWorkspace(deps, ctxFor(a), {
    name: 'Example Service Review Office',
    institutionType: 'crown_corporation',
    riskSurface: 'general_governance',
  })
}

describe('createSageWorkspace', () => {
  it('creates a usable workspace with a derived boundary profile', async () => {
    const ws = await makeWorkspace()
    expect(ws.institutionType).toBe('crown_corporation')
    expect(ws.boundaryProfile.prohibitedUses).toContain('no automated decisions')
    expect(ws.boundaryProfile.exportRestrictions).toContain('export gated')
  })

  it('emits sage.workspace.created', async () => {
    await makeWorkspace()
    expect(sink.has(SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED)).toBe(true)
  })

  it('cannot be created without workspace.create permission', async () => {
    const a = actor({ permissions: [] })
    await expect(makeWorkspace(a)).rejects.toBeInstanceOf(SageServiceError)
  })

  it('rejects missing institution type', async () => {
    await expect(
      createSageWorkspace(deps, ctxFor(actor()), {
        name: 'x',
        institutionType: undefined as never,
        riskSurface: 'general_governance',
      }),
    ).rejects.toThrow(/institutionType/)
  })

  it('rejects missing risk surface', async () => {
    await expect(
      createSageWorkspace(deps, ctxFor(actor()), {
        name: 'x',
        institutionType: 'regulator',
        riskSurface: undefined as never,
      }),
    ).rejects.toThrow(/riskSurface/)
  })

  it('derives a regulator-specific boundary profile', async () => {
    const ws = await createSageWorkspace(deps, ctxFor(actor()), {
      name: 'Reg',
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
    })
    expect(ws.boundaryProfile.excludedSourceClasses).toContain('enforcement')
  })
})

describe('membership and role assignment', () => {
  it('adds a member without granting permissions (membership is not permission)', async () => {
    const ws = await makeWorkspace()
    const member = await addSageWorkspaceMember(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'user_2',
    })
    expect(member.workspaceId).toBe(ws.id)
    // No role column on membership.
    expect(Object.keys(member)).not.toContain('role')
    expect(sink.has(SAGE_AUDIT_ACTIONS.MEMBER_ADDED)).toBe(true)
  })

  it('rejects role assignment without membership', async () => {
    const ws = await makeWorkspace()
    await expect(
      assignSageRole(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        actorId: 'no_member',
        role: 'evidence_contributor',
        accessReason: 'r',
        approvedBy: 'admin',
      }),
    ).rejects.toThrow(/membership/)
  })

  it('assigns a role when membership exists', async () => {
    const ws = await makeWorkspace()
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'user_2' })
    const role = await assignSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'user_2',
      role: 'evidence_contributor',
      accessReason: 'contribute',
      approvedBy: 'admin',
    })
    expect(role.sageApplicationRole).toBe('evidence_contributor')
    expect(sink.has(SAGE_AUDIT_ACTIONS.ROLE_ASSIGNED)).toBe(true)
  })

  it('requires an access reason and approver', async () => {
    const ws = await makeWorkspace()
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'user_2' })
    await expect(
      assignSageRole(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        actorId: 'user_2',
        role: 'evidence_contributor',
        accessReason: '',
        approvedBy: 'admin',
      }),
    ).rejects.toThrow(/accessReason/)
  })

  it('revokes a role and emits an audit event', async () => {
    const ws = await makeWorkspace()
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'user_2' })
    const role = await assignSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'user_2',
      role: 'evidence_contributor',
      accessReason: 'x',
      approvedBy: 'admin',
    })
    await revokeSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      roleAssignmentId: role.id,
      reason: 'no longer needed',
    })
    expect(sink.has(SAGE_AUDIT_ACTIONS.ROLE_REVOKED)).toBe(true)
  })

  it('rejects member management without permission', async () => {
    const ws = await makeWorkspace()
    const limited = actor({ permissions: [SAGE_PERMISSIONS.WORKSPACE_CREATE] })
    await expect(
      addSageWorkspaceMember(deps, ctxFor(limited), { workspaceId: ws.id, actorId: 'user_2' }),
    ).rejects.toThrow(/permission/i)
  })
})

describe('org boundary', () => {
  it('blocks cross-org access to a workspace (non-disclosure: NOT_FOUND)', async () => {
    const ws = await makeWorkspace()
    const otherOrg = actor({ actorId: 'x', orgId: 'org_2' })
    await expect(
      addSageWorkspaceMember(deps, ctxFor(otherOrg), { workspaceId: ws.id, actorId: 'user_2' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('getWorkspace is tenant-scoped: returns undefined for a mismatched org', async () => {
    const ws = await makeWorkspace()
    expect(await deps.repo.getWorkspace(ws.id, 'org_1')).toBeDefined()
    expect(await deps.repo.getWorkspace(ws.id, 'org_2')).toBeUndefined()
  })
})

describe('listSageWorkspaces', () => {
  it('returns only same-org workspaces', async () => {
    await makeWorkspace()
    await makeWorkspace()
    const list = await listSageWorkspaces(deps, ctxFor(actor()))
    expect(list).toHaveLength(2)
    expect(list.every((w) => w.orgId === 'org_1')).toBe(true)
  })

  it('excludes another organization\u2019s workspaces', async () => {
    await makeWorkspace()
    // Create a workspace in a different org via a writer in org_2.
    await createSageWorkspace(deps, ctxFor(actor({ orgId: 'org_2' })), {
      name: 'Other Org WS',
      institutionType: 'regulator',
      riskSurface: 'regulatory_boundary',
    })
    const org1List = await listSageWorkspaces(deps, ctxFor(actor()))
    expect(org1List).toHaveLength(1)
    expect(org1List[0].orgId).toBe('org_1')

    const org2List = await listSageWorkspaces(deps, ctxFor(actor({ orgId: 'org_2' })))
    expect(org2List).toHaveLength(1)
    expect(org2List[0].orgId).toBe('org_2')
  })

  it('returns an empty list for an actor without membership or oversight', async () => {
    await makeWorkspace()
    const stranger = actor({ actorId: 'stranger', permissions: [] })
    expect(await listSageWorkspaces(deps, ctxFor(stranger))).toEqual([])
  })
})

describe('getSageWorkspace', () => {
  it('returns a same-org workspace', async () => {
    const ws = await makeWorkspace()
    const loaded = await getSageWorkspace(deps, ctxFor(actor()), { workspaceId: ws.id })
    expect(loaded.id).toBe(ws.id)
  })

  it('returns NOT_FOUND for a cross-org workspace (non-disclosure)', async () => {
    const ws = await makeWorkspace()
    await expect(
      getSageWorkspace(deps, ctxFor(actor({ orgId: 'org_2' })), { workspaceId: ws.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('denies a same-org non-member without oversight (FORBIDDEN)', async () => {
    const ws = await makeWorkspace()
    const stranger = actor({ actorId: 'stranger', permissions: [] })
    await expect(
      getSageWorkspace(deps, ctxFor(stranger), { workspaceId: ws.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('SAGE workspace RBAC (membership + role assignment)', () => {
  const NOW = '2026-07-12T00:00:00.000Z'

  async function addMember(workspaceId: string, actorId: string) {
    await deps.repo.addWorkspaceMember({
      workspaceId,
      orgId: 'org_1',
      actorId,
      createdBy: 'actor_1',
      createdAt: NOW,
    })
  }

  async function assign(
    workspaceId: string,
    actorId: string,
    role: SageApplicationRole,
    extra: { revokedAt?: string | null; timeBoundAccessExpiresAt?: string | null } = {},
  ) {
    await deps.repo.assignRole({
      workspaceId,
      orgId: 'org_1',
      actorId,
      sageApplicationRole: role,
      workspaceScope: workspaceId,
      accessReason: 'test',
      approvedBy: 'actor_1',
      createdAt: NOW,
      revokedAt: extra.revokedAt ?? null,
      timeBoundAccessExpiresAt: extra.timeBoundAccessExpiresAt ?? null,
    })
  }

  it('membership alone (no active role) does not grant read', async () => {
    const ws = await makeWorkspace()
    await addMember(ws.id, 'm1')
    await expect(
      getSageWorkspace(deps, ctxFor(actor({ actorId: 'm1', permissions: [] })), {
        workspaceId: ws.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('an active read-granting role permits read', async () => {
    const ws = await makeWorkspace()
    await addMember(ws.id, 'm1')
    await assign(ws.id, 'm1', 'internal_reviewer')
    const loaded = await getSageWorkspace(
      deps,
      ctxFor(actor({ actorId: 'm1', permissions: [] })),
      { workspaceId: ws.id },
    )
    expect(loaded.id).toBe(ws.id)
    // The member also appears in their scoped workspace list.
    const list = await listSageWorkspaces(deps, ctxFor(actor({ actorId: 'm1', permissions: [] })))
    expect(list.map((w) => w.id)).toContain(ws.id)
  })

  it('a revoked role denies read', async () => {
    const ws = await makeWorkspace()
    await addMember(ws.id, 'm1')
    await assign(ws.id, 'm1', 'internal_reviewer', { revokedAt: NOW })
    await expect(
      getSageWorkspace(deps, ctxFor(actor({ actorId: 'm1', permissions: [] })), {
        workspaceId: ws.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('an expired time-bound role denies read', async () => {
    const ws = await makeWorkspace()
    await addMember(ws.id, 'm1')
    await assign(ws.id, 'm1', 'internal_reviewer', {
      timeBoundAccessExpiresAt: '2020-01-01T00:00:00.000Z',
    })
    await expect(
      getSageWorkspace(deps, ctxFor(actor({ actorId: 'm1', permissions: [] })), {
        workspaceId: ws.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('oversight (WORKSPACE_ADMIN) grants read but not evidence creation', async () => {
    const ws = await makeWorkspace()
    const oversight = actor({ actorId: 'ov', permissions: [SAGE_PERMISSIONS.WORKSPACE_ADMIN] })
    const loaded = await getSageWorkspace(deps, ctxFor(oversight), { workspaceId: ws.id })
    expect(loaded.id).toBe(ws.id)
    // Oversight is read-only: no automatic sensitive-evidence access.
    await expect(
      createSageEvidenceSource(deps, ctxFor(oversight), {
        workspaceId: ws.id,
        sourceType: 'public',
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })

  it('oversight (WORKSPACE_ADMIN) confers no export approval authority', async () => {
    const ws = await makeWorkspace()
    const oversight = actor({ actorId: 'ov', permissions: [SAGE_PERMISSIONS.WORKSPACE_ADMIN] })
    await expect(
      approveSageExport(deps, ctxFor(oversight), {
        workspaceId: ws.id,
        exportRequestId: 'nope',
      }),
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })
})

describe('evidence authorization', () => {
  it('grants an authorization only for a member', async () => {
    const ws = await makeWorkspace()
    await expect(
      grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        actorId: 'ghost',
        level: 'authorized_only',
        accessReason: 'x',
        approvedBy: 'admin',
      }),
    ).rejects.toThrow(/membership/)
  })

  it('grants and emits an authorization for a member', async () => {
    const ws = await makeWorkspace()
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'user_2' })
    const grant = await grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'user_2',
      level: 'sensitive',
      accessReason: 'review',
      approvedBy: 'admin',
    })
    expect(grant.evidenceAuthorizationLevel).toBe('sensitive')
    expect(sink.has(SAGE_AUDIT_ACTIONS.EVIDENCE_AUTHORIZATION_GRANTED)).toBe(true)
  })
})

describe('evidence source + item lifecycle', () => {
  it('requires a classified source before an item can be linked', async () => {
    const ws = await makeWorkspace()
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'public',
    })
    await expect(
      createSageEvidenceItem(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        sourceId: src.id,
        confidenceLevel: 'moderate',
      }),
    ).rejects.toThrow(/classification|classified/)
  })

  it('creates an item after the source is classified', async () => {
    const ws = await makeWorkspace()
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'public',
    })
    await classifySageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'high',
      authorizationLevel: 'public',
    })
    const item = await createSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'moderate',
    })
    expect(item.humanReviewRequired).toBe(true)
    expect(sink.has(SAGE_AUDIT_ACTIONS.EVIDENCE_ITEM_CREATED)).toBe(true)
  })

  it('blocks linking authorized-only evidence without explicit authorization', async () => {
    const ws = await makeWorkspace()
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'authorized_only',
    })
    await classifySageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'moderate',
      authorizationLevel: 'authorized_only',
    })
    const item = await createSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'moderate',
    })
    await expect(
      linkSageEvidenceItem(deps, ctxFor(actor()), { workspaceId: ws.id, itemId: item.id }),
    ).rejects.toThrow(/authorization/)
  })

  it('links authorized-only evidence when the actor is authorized', async () => {
    const ws = await makeWorkspace()
    await addSageWorkspaceMember(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: actor().actorId,
    })
    await grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: actor().actorId,
      level: 'authorized_only',
      accessReason: 'x',
      approvedBy: 'admin',
    })
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'authorized_only',
    })
    await classifySageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'moderate',
      authorizationLevel: 'authorized_only',
    })
    const item = await createSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'moderate',
    })
    const linked = await linkSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      itemId: item.id,
    })
    expect(linked.lifecycleState).toBe('linked')
    expect(sink.has(SAGE_AUDIT_ACTIONS.EVIDENCE_LINKED)).toBe(true)
  })

  it('marks items from excluded sources as excluded from external review', async () => {
    const ws = await makeWorkspace()
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'excluded',
    })
    await classifySageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'insufficient',
      authorizationLevel: 'excluded',
    })
    const item = await createSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'low',
    })
    expect(item.excludedFromExternalReview).toBe(true)
  })
})

describe('boundary flags, review notes, decision records', () => {
  it('adds a boundary flag and emits an audit event', async () => {
    const ws = await makeWorkspace()
    const flag = await addSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagType: 'prohibited_use',
      note: 'test',
    })
    expect(flag.flagType).toBe('prohibited_use')
    expect(sink.has(SAGE_AUDIT_ACTIONS.BOUNDARY_FLAGGED)).toBe(true)
  })

  it('requires a named reviewer for a review note', async () => {
    const ws = await makeWorkspace()
    await expect(
      addSageReviewNote(deps, ctxFor(actor()), { workspaceId: ws.id, reviewerId: '', note: 'x' }),
    ).rejects.toThrow(/reviewer/)
  })

  it('records a review note with a named reviewer', async () => {
    const ws = await makeWorkspace()
    const note = await addSageReviewNote(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      reviewerId: 'reviewer_1',
      note: 'looks fine',
    })
    expect(note.reviewerId).toBe('reviewer_1')
    expect(sink.has(SAGE_AUDIT_ACTIONS.REVIEW_NOTED)).toBe(true)
  })

  it('rejects a decision record without a named human reviewer', async () => {
    const ws = await makeWorkspace()
    await expect(
      createSageDecisionRecord(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        decision: 'proceed',
        humanReviewerId: '',
      }),
    ).rejects.toThrow(/human reviewer/)
  })

  it('records a decision with a named human reviewer', async () => {
    const ws = await makeWorkspace()
    const rec = await createSageDecisionRecord(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      decision: 'proceed',
      humanReviewerId: 'reviewer_1',
      rationale: 'human-authored',
    })
    expect(rec.humanReviewerId).toBe('reviewer_1')
    expect(sink.has(SAGE_AUDIT_ACTIONS.DECISION_RECORDED)).toBe(true)
  })
})

describe('export workflow', () => {
  it('creates an export request that is not approved by default', async () => {
    const ws = await makeWorkspace()
    const req = await requestSageExport(deps, ctxFor(actor()), { workspaceId: ws.id })
    expect(req.status).toBe('requested')
    expect(req.status).not.toBe('approved')
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_REQUESTED)).toBe(true)
  })

  it('blocks a requester from approving their own export', async () => {
    const ws = await makeWorkspace()
    const req = await requestSageExport(deps, ctxFor(actor()), { workspaceId: ws.id })
    await expect(
      approveSageExport(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        exportRequestId: req.id,
      }),
    ).rejects.toThrow(/requester/)
  })

  it('allows a different approver to approve', async () => {
    const ws = await makeWorkspace()
    const req = await requestSageExport(deps, ctxFor(actor()), { workspaceId: ws.id })
    const approver = actor({ actorId: 'approver_1' })
    const approval = await approveSageExport(deps, ctxFor(approver), {
      workspaceId: ws.id,
      exportRequestId: req.id,
    })
    expect(approval.decision).toBe('approved')
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_APPROVED)).toBe(true)
  })

  it('blocks an external reviewer from approving an export', async () => {
    const ws = await makeWorkspace()
    const req = await requestSageExport(deps, ctxFor(actor()), { workspaceId: ws.id })
    const reviewer = actor({ actorId: 'ext_1' })
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'ext_1' })
    await assignSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'ext_1',
      role: 'external_reviewer',
      accessReason: 'review',
      approvedBy: 'admin',
    })
    await expect(
      approveSageExport(deps, ctxFor(reviewer), { workspaceId: ws.id, exportRequestId: req.id }),
    ).rejects.toThrow(/external reviewer/)
  })

  it('blocks approval without explicit export-approve permission (admins do not auto-approve)', async () => {
    const ws = await makeWorkspace()
    const req = await requestSageExport(deps, ctxFor(actor()), { workspaceId: ws.id })
    const orgAdmin = actor({
      actorId: 'org_admin',
      permissions: [SAGE_PERMISSIONS.WORKSPACE_READ, SAGE_PERMISSIONS.MEMBER_MANAGE],
    })
    await expect(
      approveSageExport(deps, ctxFor(orgAdmin), { workspaceId: ws.id, exportRequestId: req.id }),
    ).rejects.toThrow(/permission/i)
  })

  it('blocks exporting excluded evidence', async () => {
    const ws = await makeWorkspace()
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'excluded',
    })
    await classifySageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'insufficient',
      authorizationLevel: 'excluded',
    })
    const item = await createSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'low',
    })
    const req = await requestSageExport(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      evidenceItemIds: [item.id],
    })
    const approver = actor({ actorId: 'approver_1' })
    await expect(
      approveSageExport(deps, ctxFor(approver), { workspaceId: ws.id, exportRequestId: req.id }),
    ).rejects.toThrow(/external-review output/)
  })

  it('requires a reason to deny an export', async () => {
    const ws = await makeWorkspace()
    const req = await requestSageExport(deps, ctxFor(actor()), { workspaceId: ws.id })
    await expect(
      denySageExport(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        exportRequestId: req.id,
        reason: '',
      }),
    ).rejects.toThrow(/reason/)
  })

  it('denies an export with a reason', async () => {
    const ws = await makeWorkspace()
    const req = await requestSageExport(deps, ctxFor(actor()), { workspaceId: ws.id })
    const approval = await denySageExport(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      exportRequestId: req.id,
      reason: 'out of scope',
    })
    expect(approval.decision).toBe('denied')
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_DENIED)).toBe(true)
  })
})

describe('workspace summary', () => {
  it('returns counts/status with no score/rank/certification fields', async () => {
    const ws = await makeWorkspace()
    const summary = await getSageWorkspaceSummary(deps, ctxFor(actor()), { workspaceId: ws.id })
    const keys = JSON.stringify(summary).toLowerCase()
    expect(keys).not.toMatch(/score|rank|certif/)
    expect(summary.counts.evidenceSources).toBe(0)
    expect(summary.boundaryProfilePresent).toBe(true)
  })

  it('respects the org boundary (non-disclosure: NOT_FOUND)', async () => {
    const ws = await makeWorkspace()
    const otherOrg = actor({ orgId: 'org_2' })
    await expect(
      getSageWorkspaceSummary(deps, ctxFor(otherOrg), { workspaceId: ws.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('reflects counts after activity', async () => {
    const ws = await makeWorkspace()
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'public',
    })
    await classifySageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'high',
      authorizationLevel: 'public',
    })
    await createSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'moderate',
    })
    await addSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagType: 'review_required',
    })
    await requestSageExport(deps, ctxFor(actor()), { workspaceId: ws.id })
    const summary = await getSageWorkspaceSummary(deps, ctxFor(actor()), { workspaceId: ws.id })
    expect(summary.counts.evidenceSources).toBe(1)
    expect(summary.counts.evidenceItems).toBe(1)
    expect(summary.counts.boundaryFlags).toBe(1)
    expect(summary.counts.openExportRequests).toBe(1)
  })
})

describe('audit emission coverage', () => {
  it('records an audit event for every material action in a full flow', async () => {
    const a = actor()
    const ws = await makeWorkspace(a)
    await addSageWorkspaceMember(deps, ctxFor(a), { workspaceId: ws.id, actorId: 'user_2' })
    await assignSageRole(deps, ctxFor(a), {
      workspaceId: ws.id,
      actorId: 'user_2',
      role: 'evidence_steward',
      accessReason: 'x',
      approvedBy: 'admin',
    })
    const grant = await grantSageEvidenceAuthorization(deps, ctxFor(a), {
      workspaceId: ws.id,
      actorId: 'user_2',
      level: 'authorized_only',
      accessReason: 'x',
      approvedBy: 'admin',
    })
    await revokeSageEvidenceAuthorizationSafe(grant.id, ws.id, a)
    const src = await createSageEvidenceSource(deps, ctxFor(a), {
      workspaceId: ws.id,
      sourceType: 'public',
    })
    await classifySageEvidenceSource(deps, ctxFor(a), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'high',
      authorizationLevel: 'public',
    })
    const item = await createSageEvidenceItem(deps, ctxFor(a), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'moderate',
    })
    await linkSageEvidenceItem(deps, ctxFor(a), { workspaceId: ws.id, itemId: item.id })
    await addSageBoundaryFlag(deps, ctxFor(a), { workspaceId: ws.id, flagType: 'sensitivity' })
    await addSageReviewNote(deps, ctxFor(a), {
      workspaceId: ws.id,
      reviewerId: 'reviewer_1',
      note: 'ok',
    })
    await createSageDecisionRecord(deps, ctxFor(a), {
      workspaceId: ws.id,
      decision: 'proceed',
      humanReviewerId: 'reviewer_1',
    })
    const req = await requestSageExport(deps, ctxFor(a), { workspaceId: ws.id })
    await approveSageExport(deps, ctxFor(actor({ actorId: 'approver_1' })), {
      workspaceId: ws.id,
      exportRequestId: req.id,
    })

    const expected = [
      SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED,
      SAGE_AUDIT_ACTIONS.MEMBER_ADDED,
      SAGE_AUDIT_ACTIONS.ROLE_ASSIGNED,
      SAGE_AUDIT_ACTIONS.EVIDENCE_AUTHORIZATION_GRANTED,
      SAGE_AUDIT_ACTIONS.EVIDENCE_AUTHORIZATION_REVOKED,
      SAGE_AUDIT_ACTIONS.EVIDENCE_SOURCE_CREATED,
      SAGE_AUDIT_ACTIONS.SOURCE_CLASSIFIED,
      SAGE_AUDIT_ACTIONS.EVIDENCE_ITEM_CREATED,
      SAGE_AUDIT_ACTIONS.EVIDENCE_LINKED,
      SAGE_AUDIT_ACTIONS.BOUNDARY_FLAGGED,
      SAGE_AUDIT_ACTIONS.REVIEW_NOTED,
      SAGE_AUDIT_ACTIONS.DECISION_RECORDED,
      SAGE_AUDIT_ACTIONS.EXPORT_REQUESTED,
      SAGE_AUDIT_ACTIONS.EXPORT_APPROVED,
    ]
    for (const action of expected) {
      expect(sink.has(action)).toBe(true)
    }
  })

  it('every recorded payload carries actorId, orgId, action, and resource', async () => {
    await makeWorkspace()
    for (const rec of sink.records) {
      expect(rec.actorId).toBeTruthy()
      expect(rec.orgId).toBeTruthy()
      expect(rec.action.startsWith('sage.')).toBe(true)
      expect(rec.resource.startsWith('sage_')).toBe(true)
    }
  })
})

// Helper that uses the exported revoke service (kept out of the main import list to
// avoid an unused-import lint error when only used here).
async function revokeSageEvidenceAuthorizationSafe(
  authorizationId: string,
  workspaceId: string,
  a: SageServiceActor,
) {
  const { revokeSageEvidenceAuthorization } = await import('./services')
  await revokeSageEvidenceAuthorization(deps, ctxFor(a), {
    workspaceId,
    authorizationId,
    reason: 'no longer needed',
  })
}
