// ─── @nzila/sage-core — repository port + in-memory implementation ───────────
// Port interface can be backed by SQL later (migration 0032). The in-memory
// implementation mirrors the same operations for executable, testable services.

import type {
  SageAuthorizationLevel,
  SageBoundaryFlag,
  SageDecisionRecord,
  SageEvidenceAuthorization,
  SageEvidenceItem,
  SageEvidenceSource,
  SageExportApproval,
  SageExportRequest,
  SageReviewNote,
  SageRoleAssignment,
  SageSourceQuality,
  SageWorkspace,
  SageWorkspaceMember,
} from './types.js'

export interface SageRepository {
  createWorkspace(input: Omit<SageWorkspace, 'id'>): Promise<SageWorkspace>
  getWorkspace(workspaceId: string): Promise<SageWorkspace | undefined>

  addWorkspaceMember(input: Omit<SageWorkspaceMember, 'id'>): Promise<SageWorkspaceMember>
  getWorkspaceMember(
    workspaceId: string,
    actorId: string,
  ): Promise<SageWorkspaceMember | undefined>

  listRoleAssignments(workspaceId: string, actorId: string): Promise<SageRoleAssignment[]>
  assignRole(input: Omit<SageRoleAssignment, 'id'>): Promise<SageRoleAssignment>
  revokeRole(roleAssignmentId: string, revokedAt: string): Promise<void>

  listEvidenceAuthorizations(
    workspaceId: string,
    actorId: string,
  ): Promise<SageEvidenceAuthorization[]>
  grantEvidenceAuthorization(
    input: Omit<SageEvidenceAuthorization, 'id'>,
  ): Promise<SageEvidenceAuthorization>
  revokeEvidenceAuthorization(authorizationId: string, revokedAt: string): Promise<void>

  createEvidenceSource(input: Omit<SageEvidenceSource, 'id'>): Promise<SageEvidenceSource>
  getEvidenceSource(sourceId: string): Promise<SageEvidenceSource | undefined>
  classifyEvidenceSource(
    sourceId: string,
    update: { sourceQuality: SageSourceQuality; authorizationLevel: SageAuthorizationLevel },
  ): Promise<SageEvidenceSource>

  createEvidenceItem(input: Omit<SageEvidenceItem, 'id'>): Promise<SageEvidenceItem>
  getEvidenceItem(itemId: string): Promise<SageEvidenceItem | undefined>
  linkEvidenceItem(itemId: string, linkedAt: string): Promise<SageEvidenceItem>

  addBoundaryFlag(input: Omit<SageBoundaryFlag, 'id'>): Promise<SageBoundaryFlag>
  addReviewNote(input: Omit<SageReviewNote, 'id'>): Promise<SageReviewNote>
  createDecisionRecord(input: Omit<SageDecisionRecord, 'id'>): Promise<SageDecisionRecord>

  createExportRequest(input: Omit<SageExportRequest, 'id'>): Promise<SageExportRequest>
  getExportRequest(exportRequestId: string): Promise<SageExportRequest | undefined>
  setExportRequestStatus(
    exportRequestId: string,
    status: SageExportRequest['status'],
  ): Promise<void>
  createExportApproval(input: Omit<SageExportApproval, 'id'>): Promise<SageExportApproval>

  // Read models for the workspace summary (counts only).
  countWorkspaceEvidenceSources(workspaceId: string): Promise<number>
  countWorkspaceEvidenceItems(workspaceId: string): Promise<number>
  countWorkspaceBoundaryFlags(workspaceId: string): Promise<number>
  countWorkspaceDecisionRecords(workspaceId: string): Promise<number>
  countWorkspaceOpenExportRequests(workspaceId: string): Promise<number>
}

let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `${prefix}_${counter}`
}

/** In-memory repository for tests/development (mirrors the audit package's InMemory* pattern). */
export class InMemorySageRepository implements SageRepository {
  private workspaces = new Map<string, SageWorkspace>()
  private members: SageWorkspaceMember[] = []
  private roles: SageRoleAssignment[] = []
  private evidenceAuthorizations: SageEvidenceAuthorization[] = []
  private sources = new Map<string, SageEvidenceSource>()
  private items = new Map<string, SageEvidenceItem>()
  private boundaryFlags: SageBoundaryFlag[] = []
  private reviewNotes: SageReviewNote[] = []
  private decisionRecords: SageDecisionRecord[] = []
  private exportRequests = new Map<string, SageExportRequest>()
  private exportApprovals: SageExportApproval[] = []

  async createWorkspace(input: Omit<SageWorkspace, 'id'>): Promise<SageWorkspace> {
    const ws: SageWorkspace = { ...input, id: nextId('ws') }
    this.workspaces.set(ws.id, ws)
    return ws
  }

  async getWorkspace(workspaceId: string): Promise<SageWorkspace | undefined> {
    return this.workspaces.get(workspaceId)
  }

  async addWorkspaceMember(
    input: Omit<SageWorkspaceMember, 'id'>,
  ): Promise<SageWorkspaceMember> {
    const existing = await this.getWorkspaceMember(input.workspaceId, input.actorId)
    if (existing) return existing
    const member: SageWorkspaceMember = { ...input, id: nextId('mem') }
    this.members.push(member)
    return member
  }

  async getWorkspaceMember(
    workspaceId: string,
    actorId: string,
  ): Promise<SageWorkspaceMember | undefined> {
    return this.members.find((m) => m.workspaceId === workspaceId && m.actorId === actorId)
  }

  async listRoleAssignments(
    workspaceId: string,
    actorId: string,
  ): Promise<SageRoleAssignment[]> {
    return this.roles.filter((r) => r.workspaceId === workspaceId && r.actorId === actorId)
  }

  async assignRole(input: Omit<SageRoleAssignment, 'id'>): Promise<SageRoleAssignment> {
    const role: SageRoleAssignment = { ...input, id: nextId('role') }
    this.roles.push(role)
    return role
  }

  async revokeRole(roleAssignmentId: string, revokedAt: string): Promise<void> {
    const role = this.roles.find((r) => r.id === roleAssignmentId)
    if (role) role.revokedAt = revokedAt
  }

  async listEvidenceAuthorizations(
    workspaceId: string,
    actorId: string,
  ): Promise<SageEvidenceAuthorization[]> {
    return this.evidenceAuthorizations.filter(
      (a) => a.workspaceId === workspaceId && a.actorId === actorId,
    )
  }

  async grantEvidenceAuthorization(
    input: Omit<SageEvidenceAuthorization, 'id'>,
  ): Promise<SageEvidenceAuthorization> {
    const grant: SageEvidenceAuthorization = { ...input, id: nextId('evauth') }
    this.evidenceAuthorizations.push(grant)
    return grant
  }

  async revokeEvidenceAuthorization(authorizationId: string, revokedAt: string): Promise<void> {
    const grant = this.evidenceAuthorizations.find((a) => a.id === authorizationId)
    if (grant) grant.revokedAt = revokedAt
  }

  async createEvidenceSource(
    input: Omit<SageEvidenceSource, 'id'>,
  ): Promise<SageEvidenceSource> {
    const src: SageEvidenceSource = { ...input, id: nextId('src') }
    this.sources.set(src.id, src)
    return src
  }

  async getEvidenceSource(sourceId: string): Promise<SageEvidenceSource | undefined> {
    return this.sources.get(sourceId)
  }

  async classifyEvidenceSource(
    sourceId: string,
    update: { sourceQuality: SageSourceQuality; authorizationLevel: SageAuthorizationLevel },
  ): Promise<SageEvidenceSource> {
    const src = this.sources.get(sourceId)
    if (!src) throw new Error('source not found')
    src.sourceQuality = update.sourceQuality
    src.authorizationLevel = update.authorizationLevel
    src.classified = true
    return src
  }

  async createEvidenceItem(input: Omit<SageEvidenceItem, 'id'>): Promise<SageEvidenceItem> {
    const item: SageEvidenceItem = { ...input, id: nextId('item') }
    this.items.set(item.id, item)
    return item
  }

  async getEvidenceItem(itemId: string): Promise<SageEvidenceItem | undefined> {
    return this.items.get(itemId)
  }

  async linkEvidenceItem(itemId: string, linkedAt: string): Promise<SageEvidenceItem> {
    const item = this.items.get(itemId)
    if (!item) throw new Error('item not found')
    item.lifecycleState = 'linked'
    item.updatedAt = linkedAt
    return item
  }

  async addBoundaryFlag(input: Omit<SageBoundaryFlag, 'id'>): Promise<SageBoundaryFlag> {
    const flag: SageBoundaryFlag = { ...input, id: nextId('flag') }
    this.boundaryFlags.push(flag)
    return flag
  }

  async addReviewNote(input: Omit<SageReviewNote, 'id'>): Promise<SageReviewNote> {
    const note: SageReviewNote = { ...input, id: nextId('note') }
    this.reviewNotes.push(note)
    return note
  }

  async createDecisionRecord(
    input: Omit<SageDecisionRecord, 'id'>,
  ): Promise<SageDecisionRecord> {
    const record: SageDecisionRecord = { ...input, id: nextId('dec') }
    this.decisionRecords.push(record)
    return record
  }

  async createExportRequest(
    input: Omit<SageExportRequest, 'id'>,
  ): Promise<SageExportRequest> {
    const req: SageExportRequest = { ...input, id: nextId('exp') }
    this.exportRequests.set(req.id, req)
    return req
  }

  async getExportRequest(exportRequestId: string): Promise<SageExportRequest | undefined> {
    return this.exportRequests.get(exportRequestId)
  }

  async setExportRequestStatus(
    exportRequestId: string,
    status: SageExportRequest['status'],
  ): Promise<void> {
    const req = this.exportRequests.get(exportRequestId)
    if (req) req.status = status
  }

  async createExportApproval(
    input: Omit<SageExportApproval, 'id'>,
  ): Promise<SageExportApproval> {
    const approval: SageExportApproval = { ...input, id: nextId('appr') }
    this.exportApprovals.push(approval)
    return approval
  }

  async countWorkspaceEvidenceSources(workspaceId: string): Promise<number> {
    return [...this.sources.values()].filter((s) => s.workspaceId === workspaceId).length
  }

  async countWorkspaceEvidenceItems(workspaceId: string): Promise<number> {
    return [...this.items.values()].filter((i) => i.workspaceId === workspaceId).length
  }

  async countWorkspaceBoundaryFlags(workspaceId: string): Promise<number> {
    return this.boundaryFlags.filter((f) => f.workspaceId === workspaceId).length
  }

  async countWorkspaceDecisionRecords(workspaceId: string): Promise<number> {
    return this.decisionRecords.filter((d) => d.workspaceId === workspaceId).length
  }

  async countWorkspaceOpenExportRequests(workspaceId: string): Promise<number> {
    return [...this.exportRequests.values()].filter(
      (r) => r.workspaceId === workspaceId && r.status === 'requested',
    ).length
  }
}
