import { describe, it, expect, beforeEach } from 'vitest'
import { InMemorySageRepository } from './repository'
import { InMemorySageAuditSink } from './audit-sink'
import { SAGE_PERMISSIONS } from './permissions'
import { SAGE_AUDIT_ACTIONS } from './audit-events'
import { SageServiceError } from './service-errors'
import type { SageServiceContext, SageServiceActor } from './service-context'
import type { SageApplicationRole, SageAuthorizationLevel } from './types'
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
  getSageDecisionRecord,
  getSageEvidenceSource,
  grantSageEvidenceAuthorization,
  linkSageEvidenceItem,
  listSageBoundaryFlags,
  listSageDecisionRecords,
  listSageEvidenceItems,
  listSageEvidenceSources,
  listSageReviewNotes,
  listSageWorkspaces,
  requestSageExport,
  resolveSageBoundaryFlag,
  reviewSageBoundaryFlag,
  revokeSageRole,
  type SageServiceDeps,
} from './services'

const ALL_PERMS = Object.values(SAGE_PERMISSIONS)

function actor(overrides: Partial<SageServiceActor> = {}): SageServiceActor {
  return {
    actorId: 'actor_1',
    orgId: 'org_1',
    actorKind: 'human',
    permissions: [...ALL_PERMS],
    ...overrides,
  }
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
  const ws = await createSageWorkspace(deps, ctxFor(a), {
    name: 'Example Service Review Office',
    institutionType: 'crown_corporation',
    riskSurface: 'general_governance',
  })
  // The creator is bootstrapped as workspace_owner; also grant evidence_steward
  // so evidence-flow tests can exercise create/classify/link end-to-end, plus the
  // governance roles (security_reviewer → BOUNDARY_FLAG; decision_record_approver
  // → REVIEW_NOTE + DECISION_RECORD) so Phase 6 flows run end-to-end.
  for (const role of ['evidence_steward', 'security_reviewer', 'decision_record_approver'] as const) {
    await deps.repo.assignRole({
      workspaceId: ws.id,
      orgId: ws.orgId,
      actorId: a.actorId,
      sageApplicationRole: role,
      workspaceScope: ws.id,
      accessReason: 'test',
      approvedBy: a.actorId,
      createdAt: '2026-07-12T00:00:00.000Z',
      revokedAt: null,
    })
  }
  return ws
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
    // Oversight is read-only: no automatic evidence access (needs membership + role).
    await expect(
      createSageEvidenceSource(deps, ctxFor(oversight), {
        workspaceId: ws.id,
        sourceType: 'public',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
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
      targetType: 'workspace',
      note: 'test',
    })
    expect(flag.flagType).toBe('prohibited_use')
    expect(flag.status).toBe('open')
    expect(sink.has(SAGE_AUDIT_ACTIONS.BOUNDARY_FLAGGED)).toBe(true)
  })

  it('records a review note attributed to the authenticated actor', async () => {
    const ws = await makeWorkspace()
    const note = await addSageReviewNote(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      note: 'looks fine',
      noteType: 'observation',
      targetType: 'workspace',
    })
    // reviewerId is server-derived (the authenticated actor), never from input.
    expect(note.reviewerId).toBe('actor_1')
    expect(note.noteType).toBe('observation')
    expect(sink.has(SAGE_AUDIT_ACTIONS.REVIEW_NOTED)).toBe(true)
  })

  it('rejects a decision record without an uncertainty statement', async () => {
    const ws = await makeWorkspace()
    await expect(
      createSageDecisionRecord(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        decision: 'proceed',
        uncertainty: '',
      }),
    ).rejects.toThrow(/uncertainty|limitation/)
  })

  it('records a decision with the authenticated actor as the named human reviewer', async () => {
    const ws = await makeWorkspace()
    const rec = await createSageDecisionRecord(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      decision: 'proceed',
      rationale: 'human-authored',
      uncertainty: 'limited sample',
    })
    expect(rec.humanReviewerId).toBe('actor_1') // derived from the session
    expect(sink.has(SAGE_AUDIT_ACTIONS.DECISION_RECORDED)).toBe(true)
  })
})

describe('governance authorization envelope (derivative-data protection)', () => {
  // Build a workspace with a SENSITIVE evidence source the owner can access.
  async function setupSensitive() {
    const a = actor()
    const ws = await makeWorkspace(a)
    await grantSageEvidenceAuthorization(deps, ctxFor(a), {
      workspaceId: ws.id,
      actorId: a.actorId,
      level: 'sensitive',
      accessReason: 'owner review',
      approvedBy: 'admin',
    })
    const src = await createSageEvidenceSource(deps, ctxFor(a), {
      workspaceId: ws.id,
      sourceType: 'public',
    })
    await classifySageEvidenceSource(deps, ctxFor(a), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'moderate',
      authorizationLevel: 'sensitive',
    })
    const item = await createSageEvidenceItem(deps, ctxFor(a), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'low',
    })
    return { a, ws, src, item }
  }

  // A member who has a governance role but NO sensitive evidence grant.
  async function addUngrantedReader(ws: { id: string; orgId: string }, a = actor()) {
    await addSageWorkspaceMember(deps, ctxFor(a), { workspaceId: ws.id, actorId: 'reader' })
    await assignSageRole(deps, ctxFor(a), {
      workspaceId: ws.id,
      actorId: 'reader',
      role: 'decision_record_approver',
      accessReason: 'r',
      approvedBy: a.actorId,
    })
    return ctxFor(actor({ actorId: 'reader', actorKind: 'human', permissions: [] }))
  }

  it('a boundary flag on sensitive evidence inherits the sensitive level', async () => {
    const { a, ws, src } = await setupSensitive()
    const flag = await addSageBoundaryFlag(deps, ctxFor(a), {
      workspaceId: ws.id,
      flagType: 'sensitivity',
      targetType: 'evidence_source',
      targetId: src.id,
    })
    expect(flag.authorizationLevel).toBe('sensitive')
    expect(flag.authorizationBasis).toBe('target_inherited')
  })

  it('a workspace-level flag defaults to the internal floor', async () => {
    const ws = await makeWorkspace()
    const flag = await addSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagType: 'review_required',
      targetType: 'workspace',
    })
    expect(flag.authorizationLevel).toBe('internal')
    expect(flag.authorizationBasis).toBe('workspace_default')
  })

  it('a reviewer may raise the level (never lower it)', async () => {
    const ws = await makeWorkspace()
    const flag = await addSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagType: 'review_required',
      targetType: 'workspace',
      requestedAuthorizationLevel: 'sensitive',
    })
    expect(flag.authorizationLevel).toBe('sensitive')
    expect(flag.authorizationBasis).toBe('reviewer_restricted')
  })

  it('rejects a request that would downgrade the inherited level', async () => {
    const { a, ws, src } = await setupSensitive()
    await expect(
      addSageBoundaryFlag(deps, ctxFor(a), {
        workspaceId: ws.id,
        flagType: 'sensitivity',
        targetType: 'evidence_source',
        targetId: src.id,
        requestedAuthorizationLevel: 'public',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('hides a sensitive boundary flag from a member without a matching grant', async () => {
    const { a, ws, src } = await setupSensitive()
    await addSageBoundaryFlag(deps, ctxFor(a), {
      workspaceId: ws.id,
      flagType: 'sensitivity',
      targetType: 'evidence_source',
      targetId: src.id,
    })
    // Owner (granted) sees it; ungranted reader does not.
    expect(await listSageBoundaryFlags(deps, ctxFor(a), { workspaceId: ws.id })).toHaveLength(1)
    const readerCtx = await addUngrantedReader(ws, a)
    expect(await listSageBoundaryFlags(deps, readerCtx, { workspaceId: ws.id })).toHaveLength(0)
  })

  it('a review note inherits the sensitive level and is hidden from ungranted readers', async () => {
    const { a, ws, src } = await setupSensitive()
    const note = await addSageReviewNote(deps, ctxFor(a), {
      workspaceId: ws.id,
      note: 'confidential observation',
      noteType: 'observation',
      targetType: 'evidence_source',
      targetId: src.id,
    })
    expect(note.authorizationLevel).toBe('sensitive')
    const readerCtx = await addUngrantedReader(ws, a)
    expect(await listSageReviewNotes(deps, readerCtx, { workspaceId: ws.id })).toHaveLength(0)
  })

  it('a decision referencing sensitive evidence inherits that level and is non-disclosed', async () => {
    const { a, ws, item } = await setupSensitive()
    const rec = await createSageDecisionRecord(deps, ctxFor(a), {
      workspaceId: ws.id,
      decision: 'proceed',
      uncertainty: 'limited',
      referencedEvidenceItemIds: [item.id],
    })
    expect(rec.authorizationLevel).toBe('sensitive')
    expect(rec.authorizationBasis).toBe('evidence_inherited')

    const readerCtx = await addUngrantedReader(ws, a)
    // Whole record omitted from the list — not merely reference-redacted.
    expect(await listSageDecisionRecords(deps, readerCtx, { workspaceId: ws.id })).toHaveLength(0)
    // Direct fetch is non-disclosed as NOT_FOUND.
    await expect(
      getSageDecisionRecord(deps, readerCtx, { workspaceId: ws.id, decisionId: rec.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('a decision referencing excluded evidence is marked out of external review', async () => {
    const a = actor()
    const ws = await makeWorkspace(a)
    const src = await createSageEvidenceSource(deps, ctxFor(a), {
      workspaceId: ws.id,
      sourceType: 'excluded',
    })
    await classifySageEvidenceSource(deps, ctxFor(a), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'insufficient',
      authorizationLevel: 'excluded',
    })
    await grantSageEvidenceAuthorization(deps, ctxFor(a), {
      workspaceId: ws.id,
      actorId: a.actorId,
      level: 'excluded',
      accessReason: 'owner review',
      approvedBy: 'admin',
    })
    const item = await createSageEvidenceItem(deps, ctxFor(a), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'low',
    })
    const rec = await createSageDecisionRecord(deps, ctxFor(a), {
      workspaceId: ws.id,
      decision: 'proceed',
      uncertainty: 'limited',
      referencedEvidenceItemIds: [item.id],
    })
    expect(rec.excludedFromExternalReview).toBe(true)
    expect(rec.authorizationLevel).toBe('excluded')
  })

  it('resolving a flag cannot downgrade its authorization and preserves it by default', async () => {
    const { a, ws, src } = await setupSensitive()
    const flag = await addSageBoundaryFlag(deps, ctxFor(a), {
      workspaceId: ws.id,
      flagType: 'sensitivity',
      targetType: 'evidence_source',
      targetId: src.id,
    })
    await expect(
      resolveSageBoundaryFlag(deps, ctxFor(a), {
        workspaceId: ws.id,
        flagId: flag.id,
        resolution: 'resolved',
        resolutionNote: 'handled',
        requestedAuthorizationLevel: 'public',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const resolved = await resolveSageBoundaryFlag(deps, ctxFor(a), {
      workspaceId: ws.id,
      flagId: flag.id,
      resolution: 'resolved',
      resolutionNote: 'handled',
    })
    expect(resolved.authorizationLevel).toBe('sensitive')
  })
})

describe('authenticated-human actor assurance', () => {
  it('rejects a service principal from adding a review note', async () => {
    const ws = await makeWorkspace()
    const service = actor({ actorKind: 'service' })
    await expect(
      addSageReviewNote(deps, ctxFor(service), {
        workspaceId: ws.id,
        note: 'x',
        noteType: 'observation',
        targetType: 'workspace',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a service principal from resolving a boundary flag', async () => {
    const ws = await makeWorkspace()
    const flag = await addSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagType: 'review_required',
      targetType: 'workspace',
    })
    const service = actor({ actorKind: 'service' })
    await expect(
      resolveSageBoundaryFlag(deps, ctxFor(service), {
        workspaceId: ws.id,
        flagId: flag.id,
        resolution: 'resolved',
        resolutionNote: 'x',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a service principal from recording a decision', async () => {
    const ws = await makeWorkspace()
    const service = actor({ actorKind: 'service' })
    await expect(
      createSageDecisionRecord(deps, ctxFor(service), {
        workspaceId: ws.id,
        decision: 'proceed',
        uncertainty: 'limited',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a system actor from recording a decision', async () => {
    const ws = await makeWorkspace()
    const system = actor({ actorKind: 'system' })
    await expect(
      createSageDecisionRecord(deps, ctxFor(system), {
        workspaceId: ws.id,
        decision: 'proceed',
        uncertainty: 'limited',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('fails closed when the actor kind is absent', async () => {
    const ws = await makeWorkspace()
    const unknown = actor({ actorKind: undefined })
    await expect(
      createSageDecisionRecord(deps, ctxFor(unknown), {
        workspaceId: ws.id,
        decision: 'proceed',
        uncertainty: 'limited',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('still allows a non-human actor to RAISE a boundary flag (not a named-human act)', async () => {
    const ws = await makeWorkspace()
    const service = actor({ actorKind: 'service' })
    const flag = await addSageBoundaryFlag(deps, ctxFor(service), {
      workspaceId: ws.id,
      flagType: 'review_required',
      targetType: 'workspace',
    })
    expect(flag.status).toBe('open')
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
      targetType: 'workspace',
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
    await addSageBoundaryFlag(deps, ctxFor(a), { workspaceId: ws.id, flagType: 'sensitivity', targetType: 'workspace' })
    await addSageReviewNote(deps, ctxFor(a), {
      workspaceId: ws.id,
      note: 'ok',
      noteType: 'observation',
      targetType: 'workspace',
    })
    await createSageDecisionRecord(deps, ctxFor(a), {
      workspaceId: ws.id,
      decision: 'proceed',
      uncertainty: 'limited sample',
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

describe('SAGE evidence read services (authorization filtering)', () => {
  async function setupSource(authorizationLevel?: SageAuthorizationLevel) {
    const ws = await makeWorkspace() // actor_1: workspace_owner + evidence_steward
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'public',
    })
    if (authorizationLevel) {
      await classifySageEvidenceSource(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        sourceId: src.id,
        sourceQuality: 'moderate',
        authorizationLevel,
      })
    }
    return { ws, src }
  }

  it('lists sources for an authorized member', async () => {
    const { ws } = await setupSource()
    const list = await listSageEvidenceSources(deps, ctxFor(actor()), { workspaceId: ws.id })
    expect(list).toHaveLength(1)
  })

  it('does not disclose another organization\u2019s evidence', async () => {
    const { ws, src } = await setupSource()
    await expect(
      getSageEvidenceSource(deps, ctxFor(actor({ orgId: 'org_2' })), {
        workspaceId: ws.id,
        sourceId: src.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      listSageEvidenceSources(deps, ctxFor(actor({ orgId: 'org_2' })), { workspaceId: ws.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects a cross-workspace source lookup with NOT_FOUND', async () => {
    const { src } = await setupSource()
    const otherWs = await makeWorkspace()
    await expect(
      getSageEvidenceSource(deps, ctxFor(actor()), { workspaceId: otherWs.id, sourceId: src.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('requires membership + active role to list', async () => {
    const { ws } = await setupSource()
    await expect(
      listSageEvidenceSources(deps, ctxFor(actor({ actorId: 'stranger', permissions: [] })), {
        workspaceId: ws.id,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('hides authorized_only evidence until an explicit active grant exists', async () => {
    const { ws } = await setupSource('authorized_only')
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'reader' })
    await assignSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'reader',
      role: 'read_only_observer',
      accessReason: 'r',
      approvedBy: 'actor_1',
    })
    const readerCtx = ctxFor(actor({ actorId: 'reader', permissions: [] }))
    expect(await listSageEvidenceSources(deps, readerCtx, { workspaceId: ws.id })).toHaveLength(0)

    const grant = await grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'reader',
      level: 'authorized_only',
      accessReason: 'r',
      approvedBy: 'actor_1',
    })
    expect(await listSageEvidenceSources(deps, readerCtx, { workspaceId: ws.id })).toHaveLength(1)

    // A revoked grant hides it again.
    await revokeSageEvidenceAuthorizationSafe(grant.id, ws.id, actor())
    expect(await listSageEvidenceSources(deps, readerCtx, { workspaceId: ws.id })).toHaveLength(0)
  })

  it('does not expose sensitive evidence through WORKSPACE_ADMIN oversight', async () => {
    const { ws } = await setupSource('sensitive')
    const oversight = actor({ actorId: 'ov', permissions: [SAGE_PERMISSIONS.WORKSPACE_ADMIN] })
    // Oversight can read the workspace but is not a member with an evidence grant.
    expect(await listSageEvidenceSources(deps, ctxFor(oversight), { workspaceId: ws.id })).toHaveLength(0)
  })

  it('lists items only for accessible sources', async () => {
    const { ws, src } = await setupSource('internal')
    const item = await createSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'moderate',
    })
    const items = await listSageEvidenceItems(deps, ctxFor(actor()), { workspaceId: ws.id })
    expect(items.map((i) => i.id)).toContain(item.id)
  })
})

describe('SAGE evidence lifecycle concurrency + mutation authorization', () => {
  async function classifiedSourceWithItem(level: SageAuthorizationLevel) {
    const ws = await makeWorkspace() // creator: workspace_owner + evidence_steward + member
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: level === 'public' ? 'public' : 'authorized_only',
    })
    await classifySageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'moderate',
      authorizationLevel: level,
    })
    const item = await createSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'moderate',
    })
    return { ws, src, item }
  }

  it('classifies a source at most once under concurrent requests (compare-and-set)', async () => {
    const ws = await makeWorkspace()
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'public',
    })
    // Two different classifications race on the same unclassified source.
    const results = await Promise.allSettled([
      classifySageEvidenceSource(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        sourceId: src.id,
        sourceQuality: 'moderate',
        authorizationLevel: 'internal',
      }),
      classifySageEvidenceSource(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        sourceId: src.id,
        sourceQuality: 'high',
        authorizationLevel: 'public',
      }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' })
    // Exactly one classification took effect.
    const after = await getSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
    })
    expect(after.classified).toBe(true)
  })

  it('links an item at most once under concurrent requests and emits a single audit event', async () => {
    const { ws, item } = await classifiedSourceWithItem('public')
    const before = sink.records.filter(
      (r) => r.action === SAGE_AUDIT_ACTIONS.EVIDENCE_LINKED,
    ).length
    const results = await Promise.allSettled([
      linkSageEvidenceItem(deps, ctxFor(actor()), { workspaceId: ws.id, itemId: item.id }),
      linkSageEvidenceItem(deps, ctxFor(actor()), { workspaceId: ws.id, itemId: item.id }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' })
    const after = sink.records.filter(
      (r) => r.action === SAGE_AUDIT_ACTIONS.EVIDENCE_LINKED,
    ).length
    expect(after - before).toBe(1) // one transition → one audit event
  })

  it('blocks linking sensitive evidence without an explicit grant', async () => {
    const { ws, item } = await classifiedSourceWithItem('sensitive')
    await expect(
      linkSageEvidenceItem(deps, ctxFor(actor()), { workspaceId: ws.id, itemId: item.id }),
    ).rejects.toThrow(/sensitive.*authorization/)
  })

  it('links sensitive evidence only with an explicit active grant', async () => {
    const { ws, item } = await classifiedSourceWithItem('sensitive')
    await grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: actor().actorId,
      level: 'sensitive',
      accessReason: 'x',
      approvedBy: 'admin',
    })
    const linked = await linkSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      itemId: item.id,
    })
    expect(linked.lifecycleState).toBe('linked')
  })

  it('ignores a revoked grant when authorizing a sensitive link', async () => {
    const { ws, item } = await classifiedSourceWithItem('sensitive')
    const grant = await grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: actor().actorId,
      level: 'sensitive',
      accessReason: 'x',
      approvedBy: 'admin',
    })
    await revokeSageEvidenceAuthorizationSafe(grant.id, ws.id, actor())
    await expect(
      linkSageEvidenceItem(deps, ctxFor(actor()), { workspaceId: ws.id, itemId: item.id }),
    ).rejects.toThrow(/sensitive.*authorization/)
  })

  it('never lets WORKSPACE_ADMIN oversight link evidence (oversight is read-only)', async () => {
    const { ws, item } = await classifiedSourceWithItem('public')
    const oversight = actor({ actorId: 'ov', permissions: [SAGE_PERMISSIONS.WORKSPACE_ADMIN] })
    await expect(
      linkSageEvidenceItem(deps, ctxFor(oversight), { workspaceId: ws.id, itemId: item.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('SAGE Phase 6 — human governance (authorization, invariants, CAS)', () => {
  async function memberWith(ws: { id: string }, actorId: string, role: string) {
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId })
    await assignSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId,
      role: role as never,
      accessReason: 'test',
      approvedBy: 'actor_1',
    })
  }

  it('denies review notes / decisions to a member without a governance role', async () => {
    const ws = await makeWorkspace()
    await memberWith(ws, 'reader', 'read_only_observer')
    const reader = ctxFor(actor({ actorId: 'reader', permissions: [] }))
    await expect(
      addSageReviewNote(deps, reader, {
        workspaceId: ws.id,
        note: 'x',
        noteType: 'observation',
        targetType: 'workspace',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      createSageDecisionRecord(deps, reader, {
        workspaceId: ws.id,
        decision: 'proceed',
        uncertainty: 'n/a',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('requires membership + an active, non-revoked, non-expired role', async () => {
    const ws = await makeWorkspace()
    // Stranger (no membership) is forbidden.
    await expect(
      addSageBoundaryFlag(deps, ctxFor(actor({ actorId: 'stranger', permissions: [] })), {
        workspaceId: ws.id,
        flagType: 'sensitivity',
        targetType: 'workspace',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // Revoked governance role is denied.
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'rev' })
    const role = await assignSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'rev',
      role: 'security_reviewer',
      accessReason: 'x',
      approvedBy: 'actor_1',
    })
    await revokeSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      roleAssignmentId: role.id,
      reason: 'x',
    })
    await expect(
      addSageBoundaryFlag(deps, ctxFor(actor({ actorId: 'rev', permissions: [] })), {
        workspaceId: ws.id,
        flagType: 'sensitivity',
        targetType: 'workspace',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    // Expired (time-bound) governance role is denied.
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'exp' })
    await deps.repo.assignRole({
      workspaceId: ws.id,
      orgId: ws.orgId,
      actorId: 'exp',
      sageApplicationRole: 'security_reviewer',
      workspaceScope: ws.id,
      timeBoundAccessExpiresAt: '2020-01-01T00:00:00.000Z',
      accessReason: 'x',
      approvedBy: 'actor_1',
      createdAt: '2019-01-01T00:00:00.000Z',
      revokedAt: null,
    })
    await expect(
      addSageBoundaryFlag(deps, ctxFor(actor({ actorId: 'exp', permissions: [] })), {
        workspaceId: ws.id,
        flagType: 'sensitivity',
        targetType: 'workspace',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a synthetic / non-human decision reviewer identity', async () => {
    const ws = await makeWorkspace(actor({ actorId: 'system' }))
    await expect(
      createSageDecisionRecord(deps, ctxFor(actor({ actorId: 'system' })), {
        workspaceId: ws.id,
        decision: 'proceed',
        uncertainty: 'n/a',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('rejects a boundary flag whose evidence target is in another workspace', async () => {
    const wsA = await makeWorkspace()
    const wsB = await makeWorkspace()
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: wsB.id,
      sourceType: 'public',
    })
    await expect(
      addSageBoundaryFlag(deps, ctxFor(actor()), {
        workspaceId: wsA.id,
        flagType: 'sensitivity',
        targetType: 'evidence_source',
        targetId: src.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('enforces evidence-reference authorization for decisions (grant + revoke)', async () => {
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
    // Without a grant, the creator cannot reference authorized_only evidence.
    await expect(
      createSageDecisionRecord(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        decision: 'proceed',
        uncertainty: 'n/a',
        referencedEvidenceItemIds: [item.id],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const grant = await grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'actor_1',
      level: 'authorized_only',
      accessReason: 'x',
      approvedBy: 'actor_1',
    })
    const ok = await createSageDecisionRecord(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      decision: 'proceed',
      uncertainty: 'n/a',
      referencedEvidenceItemIds: [item.id],
    })
    expect(ok.referencedEvidenceItemIds).toEqual([item.id])

    // Revoking the grant blocks new references again.
    await revokeSageEvidenceAuthorizationSafe(grant.id, ws.id, actor())
    await expect(
      createSageDecisionRecord(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        decision: 'proceed again',
        uncertainty: 'n/a',
        referencedEvidenceItemIds: [item.id],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('resolves a boundary flag once; a concurrent resolver conflicts (one audit event)', async () => {
    const ws = await makeWorkspace()
    const flag = await addSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagType: 'review_required',
      targetType: 'workspace',
    })
    const before = sink.records.filter((r) => r.action === SAGE_AUDIT_ACTIONS.BOUNDARY_RESOLVED).length
    const results = await Promise.allSettled([
      resolveSageBoundaryFlag(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        flagId: flag.id,
        resolution: 'resolved',
        resolutionNote: 'addressed',
      }),
      resolveSageBoundaryFlag(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        flagId: flag.id,
        resolution: 'retained',
        resolutionNote: 'kept',
      }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' })
    const after = sink.records.filter((r) => r.action === SAGE_AUDIT_ACTIONS.BOUNDARY_RESOLVED).length
    expect(after - before).toBe(1)
    // The original flag is preserved (still present, now terminal).
    const [preserved] = await listSageBoundaryFlags(deps, ctxFor(actor()), { workspaceId: ws.id })
    expect(['resolved', 'retained']).toContain(preserved.status)
  })

  it('requires a resolution note and rejects re-resolution of a terminal flag', async () => {
    const ws = await makeWorkspace()
    const flag = await addSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagType: 'review_required',
      targetType: 'workspace',
    })
    await expect(
      resolveSageBoundaryFlag(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        flagId: flag.id,
        resolution: 'resolved',
        resolutionNote: '   ',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    await resolveSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagId: flag.id,
      resolution: 'resolved',
      resolutionNote: 'done',
    })
    await expect(
      resolveSageBoundaryFlag(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        flagId: flag.id,
        resolution: 'resolved',
        resolutionNote: 'again',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('reviews a flag (open → under_review) via compare-and-set', async () => {
    const ws = await makeWorkspace()
    const flag = await addSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagType: 'review_required',
      targetType: 'workspace',
    })
    const reviewed = await reviewSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagId: flag.id,
    })
    expect(reviewed.status).toBe('under_review')
    // A second review (no longer 'open') conflicts.
    await expect(
      reviewSageBoundaryFlag(deps, ctxFor(actor()), { workspaceId: ws.id, flagId: flag.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('non-discloses whole governance records derived from inaccessible evidence', async () => {
    const ws = await makeWorkspace()
    const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceType: 'authorized_only',
    })
    await classifySageEvidenceSource(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      sourceQuality: 'moderate',
      authorizationLevel: 'sensitive',
    })
    // Creator has a sensitive grant (self) to file the flag + decision.
    await grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'actor_1',
      level: 'sensitive',
      accessReason: 'x',
      approvedBy: 'actor_1',
    })
    await addSageBoundaryFlag(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      flagType: 'sensitivity',
      targetType: 'evidence_source',
      targetId: src.id,
    })
    const item = await createSageEvidenceItem(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      sourceId: src.id,
      confidenceLevel: 'moderate',
    })
    const decision = await createSageDecisionRecord(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      decision: 'proceed',
      uncertainty: 'n/a',
      referencedEvidenceItemIds: [item.id],
    })

    // A reader WITHOUT the sensitive grant: the sensitive flag AND the derived
    // sensitive decision are hidden whole — the reader never sees the narrative,
    // and a direct fetch is non-disclosed as NOT_FOUND.
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'reader' })
    await assignSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'reader',
      role: 'read_only_observer',
      accessReason: 'x',
      approvedBy: 'actor_1',
    })
    const reader = ctxFor(actor({ actorId: 'reader', permissions: [] }))
    expect(await listSageBoundaryFlags(deps, reader, { workspaceId: ws.id })).toHaveLength(0)
    expect(await listSageDecisionRecords(deps, reader, { workspaceId: ws.id })).toHaveLength(0)
    await expect(
      getSageDecisionRecord(deps, reader, { workspaceId: ws.id, decisionId: decision.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('redacts references the reader cannot access on an otherwise-visible decision', async () => {
    const ws = await makeWorkspace()
    // Owner grants self both levels so the decision can reference mixed evidence.
    for (const level of ['authorized_only', 'sensitive'] as const) {
      await grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        actorId: 'actor_1',
        level,
        accessReason: 'x',
        approvedBy: 'actor_1',
      })
    }
    async function makeItem(level: SageAuthorizationLevel) {
      const src = await createSageEvidenceSource(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        sourceType: 'public',
      })
      await classifySageEvidenceSource(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        sourceId: src.id,
        sourceQuality: 'moderate',
        authorizationLevel: level,
      })
      return createSageEvidenceItem(deps, ctxFor(actor()), {
        workspaceId: ws.id,
        sourceId: src.id,
        confidenceLevel: 'moderate',
      })
    }
    const authorizedItem = await makeItem('authorized_only')
    const sensitiveItem = await makeItem('sensitive')
    const decision = await createSageDecisionRecord(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      decision: 'proceed',
      uncertainty: 'n/a',
      referencedEvidenceItemIds: [authorizedItem.id, sensitiveItem.id],
    })
    // Decision inherits the most restrictive level (sensitive).
    expect(decision.authorizationLevel).toBe('sensitive')

    // A reader with ONLY a sensitive grant can see the record (sensitive) but
    // NOT the authorized_only reference (grants are exact-level, not tiered).
    await addSageWorkspaceMember(deps, ctxFor(actor()), { workspaceId: ws.id, actorId: 'reader' })
    await assignSageRole(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'reader',
      role: 'read_only_observer',
      accessReason: 'x',
      approvedBy: 'actor_1',
    })
    await grantSageEvidenceAuthorization(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      actorId: 'reader',
      level: 'sensitive',
      accessReason: 'x',
      approvedBy: 'actor_1',
    })
    const reader = ctxFor(actor({ actorId: 'reader', permissions: [] }))
    const detail = await getSageDecisionRecord(deps, reader, {
      workspaceId: ws.id,
      decisionId: decision.id,
    })
    expect(detail.referencedEvidenceItemIds).toEqual([sensitiveItem.id])
  })

  it('does not disclose another org’s decision record (NOT_FOUND)', async () => {
    const ws = await makeWorkspace()
    const decision = await createSageDecisionRecord(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      decision: 'proceed',
      uncertainty: 'n/a',
    })
    await expect(
      getSageDecisionRecord(deps, ctxFor(actor({ orgId: 'org_2' })), {
        workspaceId: ws.id,
        decisionId: decision.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('lists review notes attributed to the authenticated reviewer', async () => {
    const ws = await makeWorkspace()
    await addSageReviewNote(deps, ctxFor(actor()), {
      workspaceId: ws.id,
      note: 'human observation',
      noteType: 'concern',
      targetType: 'workspace',
    })
    const notes = await listSageReviewNotes(deps, ctxFor(actor()), { workspaceId: ws.id })
    expect(notes).toHaveLength(1)
    expect(notes[0].reviewerId).toBe('actor_1')
    expect(notes[0].noteType).toBe('concern')
  })
})
